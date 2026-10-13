-- ============================================================================
-- Migration: 20261019_000000_delivery_verification_override_and_timestamps.sql
-- Description:
--   1. Convert timestamp columns to TIMESTAMPTZ (UTC) across OrderStatusHistory,
--      VerificationResponse, DeliveryVerification, AuditLog, and Order
--   2. Add source and verifiedByRole columns to VerificationResponse and DeliveryVerification
--   3. Enhance rpc_submit_verification to support warehouse-side overrides with audit trail
--   4. Implement rpc_add_delivery_evidence to append warehouse/client evidence without overwrite
--   5. Update can_upload_delivery_evidence_storage to allow authorized warehouse staff upload
-- ============================================================================

-- ============================================================================
-- PART 1: Convert timestamp columns to TIMESTAMPTZ (UTC)
-- ============================================================================

ALTER TABLE public."OrderStatusHistory" 
    ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE public."VerificationResponse" 
    ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE public."DeliveryVerification" 
    ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC',
    ALTER COLUMN "verifiedAt" TYPE TIMESTAMPTZ USING "verifiedAt" AT TIME ZONE 'UTC';

ALTER TABLE public."AuditLog" 
    ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE public."Order" 
    ALTER COLUMN "deliveryVerifiedAt" TYPE TIMESTAMPTZ USING "deliveryVerifiedAt" AT TIME ZONE 'UTC',
    ALTER COLUMN "storeVerifiedAt" TYPE TIMESTAMPTZ USING "storeVerifiedAt" AT TIME ZONE 'UTC',
    ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC',
    ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';


-- ============================================================================
-- PART 2: Add source & actor columns to VerificationResponse & DeliveryVerification
-- ============================================================================

ALTER TABLE public."VerificationResponse" 
    ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'CLIENT',
    ADD COLUMN IF NOT EXISTS "verifiedByRole" TEXT;

ALTER TABLE public."DeliveryVerification" 
    ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'CLIENT',
    ADD COLUMN IF NOT EXISTS "verifiedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "verifiedByRole" TEXT;


-- ============================================================================
-- PART 3: Update rpc_submit_verification (Warehouse Override & Audit Trail)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_submit_verification(
    p_order_id TEXT,
    p_status public."VerificationStatus",
    p_responses JSONB,
    p_comments TEXT DEFAULT NULL,
    p_attachments JSONB DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_user RECORD;
    v_client_employee RECORD;
    v_actor RECORD;
    v_auth_uid TEXT;
    v_item JSONB;
    v_source TEXT;
    v_is_warehouse_override BOOLEAN := FALSE;
    v_history_notes TEXT;
    v_action TEXT;
BEGIN
    -- Resolve authenticated actor using get_current_actor() or auth.uid() -> User.supabaseUserId
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF v_actor.actor_id IS NOT NULL THEN
        SELECT * INTO v_user FROM public."User" WHERE "id" = v_actor.actor_id;
    ELSIF auth.uid() IS NOT NULL THEN
        SELECT * INTO v_user FROM public."User" WHERE "supabaseUserId" = auth.uid()::text;
    ELSIF p_user_id IS NOT NULL AND p_user_id != '' THEN
        SELECT * INTO v_user FROM public."User" WHERE "id" = p_user_id OR "supabaseUserId" = p_user_id;
    END IF;

    IF v_user.id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit delivery verification';
    END IF;

    -- Canonical WMS User ID
    p_user_id := v_user.id;

    SELECT * INTO v_order FROM public."Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Workflow state checks
    IF v_order.status = 'ISSUED' THEN
        RAISE EXCEPTION 'Order % is still in ISSUED status and cannot be verified until dispatched', v_order."orderNumber";
    END IF;

    IF v_order.status != 'DISPATCHED' THEN
        RAISE EXCEPTION 'This order (%) is not ready for delivery verification. Current status: %', v_order."orderNumber", v_order.status;
    END IF;

    IF p_status::text IN ('RECEIVED', 'VERIFICATION_PENDING', 'PENDING') THEN
        RAISE EXCEPTION 'Invalid verification status: %. Only VERIFIED, PARTIALLY_VERIFIED, or REJECTED are permitted', p_status;
    END IF;

    -- Tenant isolation check
    IF v_user."tenantId" IS NOT NULL AND v_user."tenantId" != v_order."tenantId" THEN
        RAISE EXCEPTION 'Cross-tenant verification access denied';
    END IF;

    -- Accounting roles cannot perform physical delivery verification
    IF v_user.role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT') THEN
        RAISE EXCEPTION 'Accounting users cannot submit delivery verifications';
    END IF;

    -- Authorization & Source Classification
    IF v_user.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_STAFF', 'WAREHOUSE_MODERATOR', 'PLATFORM_ADMIN') THEN
        v_is_warehouse_override := TRUE;
        v_source := 'WAREHOUSE_OVERRIDE';
    ELSIF v_user.role = 'CLIENT' THEN
        v_is_warehouse_override := FALSE;
        v_source := 'CLIENT';

        SELECT ce.*, c."companyGroupId"
        INTO v_client_employee
        FROM public."ClientEmployee" ce
        JOIN public."Client" c ON c."id" = ce."clientId"
        WHERE ce."userId" = v_user.id AND ce."tenantId" = v_order."tenantId" AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Active client employee profile not associated with authenticated user';
        END IF;

        IF v_client_employee."employeeRole" = 'STORE' THEN
            RAISE EXCEPTION 'Storekeepers (STORE) are restricted to inventory verification and cannot perform delivery verification';
        END IF;

        IF v_client_employee."employeeRole" = 'ACCOUNT' THEN
            RAISE EXCEPTION 'Accountants (ACCOUNT) cannot perform delivery verification';
        END IF;

        IF NOT public.has_permission('DELIVERY_VERIFY') THEN
            RAISE EXCEPTION 'Permission denied: DELIVERY_VERIFY permission required';
        END IF;

        IF NOT public.can_access_client(v_order."clientId") THEN
            RAISE EXCEPTION 'Client employee is not authorized for this client order';
        END IF;
    ELSE
        RAISE EXCEPTION 'User role % is not authorized to verify delivery', v_user.role;
    END IF;

    -- Validate Checklist Items
    IF p_status = 'VERIFIED' THEN
        IF p_responses IS NULL OR jsonb_typeof(p_responses) != 'array' OR jsonb_array_length(p_responses) < 7 THEN
            RAISE EXCEPTION 'All 7 delivery inspection checklist items must be provided for verification';
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_responses)
        LOOP
            IF COALESCE((v_item->>'checked')::BOOLEAN, FALSE) IS NOT TRUE THEN
                RAISE EXCEPTION 'All inspection checklist items must be checked to confirm verification';
            END IF;
        END LOOP;
    END IF;

    -- Upsert VerificationResponse atomically
    INSERT INTO public."VerificationResponse" (
        "id", "tenantId", "orderId", "clientId", "userId", "status", "responses", "comments", "attachments", "source", "verifiedByRole", "createdAt"
    ) VALUES (
        concat('vr_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."clientId",
        p_user_id,
        p_status,
        p_responses,
        p_comments,
        p_attachments,
        v_source,
        v_user.role::text,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ("orderId") DO UPDATE
    SET "status" = p_status,
        "responses" = p_responses,
        "comments" = p_comments,
        "attachments" = COALESCE(p_attachments, public."VerificationResponse"."attachments"),
        "userId" = p_user_id,
        "source" = v_source,
        "verifiedByRole" = v_user.role::text;

    -- Update Order: Record delivery verification timestamp and user
    UPDATE public."Order"
    SET "deliveryVerifiedAt" = CURRENT_TIMESTAMP,
        "deliveryVerifiedById" = p_user_id,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_order."id";

    -- Advance unpaid invoices for this order to PAYMENT_PENDING immediately upon delivery verification
    UPDATE public."Invoice"
    SET "paymentStatus" = 'PAYMENT_PENDING',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "orderId" = v_order."id" AND "paymentStatus" = 'UNPAID';

    -- Prepare notes and action for Audit and Status History
    IF v_is_warehouse_override THEN
        v_history_notes := concat('Delivery verification overridden by ', replace(v_user.role::text, '_', ' '), ': ', COALESCE(p_comments, 'Verified by warehouse staff'));
        v_action := 'WAREHOUSE_DELIVERY_VERIFICATION_OVERRIDE';
    ELSE
        v_history_notes := concat('Delivery verification submitted by client receiver: ', COALESCE(p_comments, 'Verified'));
        v_action := 'SUBMIT_DELIVERY_VERIFICATION';
    END IF;

    -- Record Order Status History
    INSERT INTO public."OrderStatusHistory" (
        "id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt"
    ) VALUES (
        concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."status",
        v_order."status",
        p_user_id,
        v_history_notes,
        CURRENT_TIMESTAMP
    );

    -- Record Audit Log
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_user_id,
        v_user.role::"Role",
        v_action,
        'Order',
        v_order."id",
        jsonb_build_object(
            'status', v_order."status",
            'deliveryVerifiedAt', v_order."deliveryVerifiedAt"
        ),
        jsonb_build_object(
            'status', v_order."status",
            'deliveryVerifiedAt', CURRENT_TIMESTAMP,
            'verifiedBy', p_user_id,
            'source', v_source,
            'verifiedByRole', v_user.role::text,
            'comments', p_comments
        ),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order."id",
        'orderNumber', v_order."orderNumber",
        'deliveryVerified', true,
        'source', v_source,
        'isOverride', v_is_warehouse_override,
        'verifiedByRole', v_user.role::text,
        'verifiedBy', p_user_id,
        'verifiedAt', CURRENT_TIMESTAMP
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_verification(TEXT, public."VerificationStatus", JSONB, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_submit_verification(TEXT, public."VerificationStatus", JSONB, TEXT, JSONB, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_verification(TEXT, public."VerificationStatus", JSONB, TEXT, JSONB, TEXT) TO authenticated;


-- ============================================================================
-- PART 4: Implement rpc_add_delivery_evidence
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_add_delivery_evidence(
    p_order_id TEXT,
    p_attachments JSONB,
    p_source TEXT DEFAULT 'WAREHOUSE'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_order RECORD;
    v_vr RECORD;
    v_source TEXT;
    v_combined_attachments JSONB;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to upload delivery evidence';
    END IF;

    SELECT * INTO v_order FROM public."Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Tenant isolation
    IF v_actor.role != 'PLATFORM_ADMIN' AND (v_actor.tenant_id IS NULL OR v_actor.tenant_id != v_order."tenantId") THEN
        RAISE EXCEPTION 'Cross-tenant access denied';
    END IF;

    -- Role and permission check
    IF v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'PLATFORM_ADMIN') THEN
        v_source := 'WAREHOUSE';
    ELSIF v_actor.role = 'CLIENT' THEN
        IF NOT (public.has_permission('DELIVERY_VERIFY') AND public.can_access_client(v_order."clientId")) THEN
            RAISE EXCEPTION 'Permission denied to upload delivery evidence';
        END IF;
        v_source := 'CLIENT';
    ELSE
        RAISE EXCEPTION 'Role % not authorized to upload delivery evidence', v_actor.role;
    END IF;

    IF p_attachments IS NULL OR jsonb_typeof(p_attachments) != 'array' OR jsonb_array_length(p_attachments) = 0 THEN
        RAISE EXCEPTION 'Valid array of attachments required';
    END IF;

    -- Fetch or initialize VerificationResponse
    SELECT * INTO v_vr FROM public."VerificationResponse" WHERE "orderId" = p_order_id;
    IF FOUND THEN
        v_combined_attachments := COALESCE(v_vr."attachments", '[]'::jsonb) || p_attachments;
        UPDATE public."VerificationResponse"
        SET "attachments" = v_combined_attachments
        WHERE "id" = v_vr."id";
    ELSE
        v_combined_attachments := p_attachments;
        INSERT INTO public."VerificationResponse" (
            "id", "tenantId", "orderId", "clientId", "userId", "status", "responses", "comments", "attachments", "source", "verifiedByRole", "createdAt"
        ) VALUES (
            concat('vr_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            v_order."tenantId",
            v_order."id",
            v_order."clientId",
            v_actor.actor_id,
            'PENDING',
            '[]'::jsonb,
            NULL,
            v_combined_attachments,
            v_source,
            v_actor.role::text,
            CURRENT_TIMESTAMP
        );
    END IF;

    -- Audit Log
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        CASE WHEN v_source = 'WAREHOUSE' THEN 'WAREHOUSE_EVIDENCE_UPLOADED' ELSE 'CLIENT_EVIDENCE_UPLOADED' END,
        'VerificationResponse',
        p_order_id,
        jsonb_build_object('attachmentCount', jsonb_array_length(COALESCE(v_vr."attachments", '[]'::jsonb))),
        jsonb_build_object('attachmentCount', jsonb_array_length(v_combined_attachments), 'newAttachments', p_attachments, 'source', v_source),
        CURRENT_TIMESTAMP
    );

    -- Status History Note
    INSERT INTO public."OrderStatusHistory" (
        "id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt"
    ) VALUES (
        concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."status",
        v_order."status",
        v_actor.actor_id,
        CASE WHEN v_source = 'WAREHOUSE' 
             THEN concat('Warehouse delivery evidence uploaded (', jsonb_array_length(p_attachments), ' file(s))')
             ELSE concat('Client delivery evidence uploaded (', jsonb_array_length(p_attachments), ' file(s))')
        END,
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', p_order_id,
        'source', v_source,
        'attachments', v_combined_attachments
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_add_delivery_evidence(TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_add_delivery_evidence(TEXT, JSONB, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_add_delivery_evidence(TEXT, JSONB, TEXT) TO authenticated;


-- ============================================================================
-- PART 5: Storage Upload Policy Parity for Warehouse Staff
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_upload_delivery_evidence_storage(
    p_object_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_path_tenant_id TEXT;
    v_path_order_id  TEXT;
    v_order RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RETURN FALSE;
    END IF;

    v_path_tenant_id := split_part(p_object_name, '/', 1);
    v_path_order_id  := split_part(p_object_name, '/', 2);

    IF v_path_tenant_id = '' OR v_path_order_id = '' THEN
        RETURN FALSE;
    END IF;

    SELECT * INTO v_order FROM public."Order" WHERE "id" = v_path_order_id;
    IF NOT FOUND OR v_order."tenantId" != v_path_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' AND v_actor.tenant_id != v_order."tenantId" THEN
        RETURN FALSE;
    END IF;

    -- Warehouse operations staff can upload evidence anytime for their tenant's orders
    IF v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'PLATFORM_ADMIN') THEN
        RETURN TRUE;
    ELSIF v_actor.role = 'CLIENT' THEN
        -- Client can upload while order is DISPATCHED and before store verification is finalized
        IF v_order.status = 'DISPATCHED' AND v_order."storeVerifiedAt" IS NULL THEN
            IF public.has_permission('DELIVERY_VERIFY') AND public.can_access_client(v_order."clientId") THEN
                RETURN TRUE;
            END IF;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_upload_delivery_evidence_storage(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_upload_delivery_evidence_storage(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_upload_delivery_evidence_storage(TEXT) TO authenticated;
