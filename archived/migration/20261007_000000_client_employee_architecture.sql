-- ============================================================================
-- Migration: 20261007_000000_client_employee_architecture.sql
-- Description: Phase 6C - Client Company / Client Employee Architecture
--
-- Establishes the true multi-tier client hierarchy:
--   Tenant
--     └── Corporate Group (optional)
--           └── Client Company (Company entity)
--                 └── Client Employee (Person / Contact entity)
--                       └── WMS User (Application Identity)
--                             └── Supabase auth.users (Auth Identity)
--
-- Goals:
--   1. Clean experimental test data from dev database.
--   2. Alter Client table to represent ONLY a company.
--   3. Create ClientEmployee table representing person/contact.
--   4. Update authorization helpers (can_access_client, can_read_invoice).
--   5. Update RPCs (rpc_submit_verification, rpc_create_order_with_invoice).
--   6. Enable RLS on ClientEmployee.
--   7. Seed clean development test companies and employees.
--
-- Preserves:
--   - Phase 6B invoice prefix & sequencing design
--   - Payment and storage security
--   - Exact RPC signatures
-- ============================================================================

-- ============================================================================
-- STEP 1: Clean Experimental Test Data in Correct Dependency Order
-- ============================================================================

DELETE FROM "public"."VerificationResponse";
DELETE FROM "public"."DeliveryVerificationItem";
DELETE FROM "public"."DeliveryVerification";
DELETE FROM "public"."Payment";
DELETE FROM "public"."InvoiceItem";
DELETE FROM "public"."Invoice";
DELETE FROM "public"."OrderItem";
DELETE FROM "public"."OrderStatusHistory";
DELETE FROM "public"."Notification" WHERE "orderId" IS NOT NULL;
DELETE FROM "public"."Order";
DELETE FROM "public"."Client";


-- ============================================================================
-- STEP 2: Alter Client Table (Company Entity Only)
-- ============================================================================

-- Drop old foreign key, unique constraints, and indexes related to person/user
ALTER TABLE "public"."Client" DROP CONSTRAINT IF EXISTS "Client_userId_fkey";
DROP INDEX IF EXISTS "public"."Client_userId_key";
ALTER TABLE "public"."Client" DROP CONSTRAINT IF EXISTS "Client_tenantId_mobile_key";
DROP INDEX IF EXISTS "public"."Client_tenantId_mobile_key";

-- Drop person/employee columns from Client
ALTER TABLE "public"."Client" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "public"."Client" DROP COLUMN IF EXISTS "employeeRole";
ALTER TABLE "public"."Client" DROP COLUMN IF EXISTS "contactPerson";
ALTER TABLE "public"."Client" DROP COLUMN IF EXISTS "mobile";
ALTER TABLE "public"."Client" DROP COLUMN IF EXISTS "email";

-- Add unique constraint for company name per tenant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Client_tenantId_companyName_key'
    ) THEN
        ALTER TABLE "public"."Client"
            ADD CONSTRAINT "Client_tenantId_companyName_key" UNIQUE ("tenantId", "companyName");
    END IF;
END $$;


-- ============================================================================
-- STEP 3: Create ClientEmployee Table (Person / Contact Entity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."ClientEmployee" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeRole" "public"."ClientEmployeeRole" NOT NULL DEFAULT 'RECEIVER'::"public"."ClientEmployeeRole",
    "contactPerson" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE'::"public"."UserStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientEmployee_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClientEmployee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientEmployee_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClientEmployee_tenantId_mobile_key" UNIQUE ("tenantId", "mobile"),
    CONSTRAINT "ClientEmployee_userId_key" UNIQUE ("userId")
);

CREATE INDEX IF NOT EXISTS "ClientEmployee_tenantId_idx" ON "public"."ClientEmployee"("tenantId");
CREATE INDEX IF NOT EXISTS "ClientEmployee_clientId_idx" ON "public"."ClientEmployee"("clientId");
CREATE INDEX IF NOT EXISTS "ClientEmployee_userId_idx" ON "public"."ClientEmployee"("userId");


-- ============================================================================
-- STEP 4: Enable RLS and Add Policies for ClientEmployee
-- ============================================================================

ALTER TABLE "public"."ClientEmployee" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_employee_select_policy" ON "public"."ClientEmployee";
CREATE POLICY "client_employee_select_policy"
ON "public"."ClientEmployee"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND (
        public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
        OR public.can_access_client("clientId")
    )
);

DROP POLICY IF EXISTS "client_employee_staff_mutation_policy" ON "public"."ClientEmployee";
CREATE POLICY "client_employee_staff_mutation_policy"
ON "public"."ClientEmployee"
FOR ALL
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'ACCOUNTANT'])
)
WITH CHECK (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'ACCOUNTANT'])
);

GRANT ALL ON TABLE "public"."ClientEmployee" TO authenticated;
GRANT ALL ON TABLE "public"."ClientEmployee" TO service_role;


-- ============================================================================
-- STEP 5: Update can_access_client Authorization Helper
-- Resolves client access via ClientEmployee -> Client
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_client(p_target_client_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_client_tenant_id TEXT;
    v_client_company_group_id TEXT;
    v_actor_client_id TEXT;
    v_actor_company_group_id TEXT;
BEGIN
    -- Get current actor
    SELECT * INTO v_actor FROM public.get_current_actor();

    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- PLATFORM_ADMIN -> full access
    IF v_actor.role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- Fetch target client company details
    SELECT c."tenantId", c."companyGroupId"
    INTO v_client_tenant_id, v_client_company_group_id
    FROM public."Client" c
    WHERE c."id" = p_target_client_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Tenant boundary check (non-PLATFORM_ADMIN must match)
    IF v_actor.tenant_id != v_client_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- Staff roles -> full tenant client access
    IF v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_STAFF') THEN
        RETURN TRUE;
    END IF;

    -- Client roles -> scoped access via ClientEmployee
    IF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT', 'PRODUCT_RECEIVER', 'MANAGER', 'GM', 'MD') THEN
        -- Find actor's linked client company via ClientEmployee
        SELECT ce."clientId", c."companyGroupId"
        INTO v_actor_client_id, v_actor_company_group_id
        FROM public."ClientEmployee" ce
        JOIN public."Client" c ON c."id" = ce."clientId"
        WHERE ce."userId" = v_actor.actor_id;

        IF NOT FOUND THEN
            RETURN FALSE;
        END IF;

        -- Direct client company match
        IF p_target_client_id = v_actor_client_id THEN
            RETURN TRUE;
        END IF;

        -- Company group match
        IF v_actor_company_group_id IS NOT NULL AND v_client_company_group_id = v_actor_company_group_id THEN
            RETURN TRUE;
        END IF;

        -- No match -> denied
        RETURN FALSE;
    END IF;

    -- Other roles -> denied
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_client(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_client(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_client(TEXT) TO authenticated;


-- ============================================================================
-- STEP 6: Update can_read_invoice Authorization Helper
-- Resolves client access via ClientEmployee -> Client
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_read_invoice(
    p_invoice_tenant_id TEXT,
    p_invoice_client_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id        TEXT;
    v_tenant_id      TEXT;
    v_role           TEXT;
    v_status         TEXT;
    v_client_id      TEXT;
    v_company_group_id TEXT;
    v_group_match    BOOLEAN;
BEGIN
    -- 1. Reject unauthenticated callers
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Resolve actor from User table using auth.uid()
    SELECT
        u."id",
        u."tenantId",
        u."role"::TEXT,
        u."status"::TEXT
    INTO
        v_user_id,
        v_tenant_id,
        v_role,
        v_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    -- 3. User not found or inactive -> denied
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    IF v_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    -- 4. PLATFORM_ADMIN -> platform-wide access
    IF v_role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- 5. Cross-tenant -> denied
    IF v_tenant_id IS NULL OR v_tenant_id != p_invoice_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- 6. Tenant staff roles -> full tenant access
    IF v_role IN ('WAREHOUSE_OWNER', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_MODERATOR') THEN
        RETURN TRUE;
    END IF;

    -- 7. Client roles -> client/company-group scoped access via ClientEmployee
    IF v_role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
        -- Lookup the Client Company linked to this user via ClientEmployee
        SELECT
            ce."clientId",
            c."companyGroupId"
        INTO
            v_client_id,
            v_company_group_id
        FROM public."ClientEmployee" ce
        JOIN public."Client" c ON c."id" = ce."clientId"
        WHERE ce."userId" = v_user_id;

        -- No linked ClientEmployee record -> denied
        IF NOT FOUND THEN
            RETURN FALSE;
        END IF;

        -- Direct client company match
        IF p_invoice_client_id = v_client_id THEN
            RETURN TRUE;
        END IF;

        -- Company group match: check if invoice's client belongs to same group
        IF v_company_group_id IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1
                FROM public."Client" gc
                WHERE gc."id" = p_invoice_client_id
                  AND gc."companyGroupId" = v_company_group_id
                  AND gc."tenantId" = v_tenant_id
            ) INTO v_group_match;

            IF v_group_match THEN
                RETURN TRUE;
            END IF;
        END IF;

        -- Neither direct nor group match -> denied
        RETURN FALSE;
    END IF;

    -- All other roles -> denied
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_invoice(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_invoice(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_invoice(TEXT, TEXT) TO authenticated;


-- ============================================================================
-- STEP 7: Update rpc_submit_verification
-- Exact 6-parameter signature preserved:
-- (text, "VerificationStatus", jsonb, text, jsonb, text) -> jsonb
-- Resolves client employee authorization via ClientEmployee
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_submit_verification(
    p_order_id text,
    p_status "VerificationStatus",
    p_responses jsonb,
    p_comments text DEFAULT NULL::text,
    p_attachments jsonb DEFAULT NULL::jsonb,
    p_user_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_actor RECORD;
    v_order RECORD;
    v_user RECORD;
    v_client_employee RECORD;
    v_new_order_status "OrderStatus";
    v_item JSONB;
BEGIN
    -- Resolve authenticated actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit delivery verification';
    END IF;

    -- Authoritative user ID from session
    p_user_id := v_actor.actor_id;

    -- Validate user exists
    SELECT * INTO v_user FROM "User" WHERE "id" = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % not found', p_user_id;
    END IF;

    -- Retrieve order
    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Workflow state checks:
    IF v_order.status = 'ISSUED' THEN
        RAISE EXCEPTION 'Order % is still in ISSUED status and cannot be verified until dispatched', v_order."orderNumber";
    END IF;

    IF v_order.status != 'DISPATCHED' THEN
        RAISE EXCEPTION 'This order (%) is not ready for client verification. Current status: %', v_order."orderNumber", v_order.status;
    END IF;

    IF p_status::text IN ('RECEIVED', 'VERIFICATION_PENDING', 'PENDING') THEN
        RAISE EXCEPTION 'Invalid verification status: %. Only VERIFIED, PARTIALLY_VERIFIED, or REJECTED are permitted', p_status;
    END IF;

    -- Authorization & Client/Tenant Ownership Validation:
    IF v_user.role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT') THEN
        RAISE EXCEPTION 'Accounting users cannot submit delivery verifications';
    END IF;

    IF v_user."tenantId" IS NOT NULL AND v_user."tenantId" != v_order."tenantId" THEN
        RAISE EXCEPTION 'Cross-tenant verification access denied';
    END IF;

    -- Enforce Client Receiver authorization via ClientEmployee
    IF v_user.role = 'CLIENT' THEN
        SELECT ce.*, c."companyGroupId"
        INTO v_client_employee
        FROM "ClientEmployee" ce
        JOIN "Client" c ON c."id" = ce."clientId"
        WHERE ce."userId" = v_user.id AND ce."tenantId" = v_order."tenantId"
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Client employee profile not associated with authenticated user';
        END IF;

        IF v_client_employee."employeeRole" IS NULL OR v_client_employee."employeeRole" != 'RECEIVER' THEN
            RAISE EXCEPTION 'Only Client Receivers (employeeRole: RECEIVER) are authorized to verify deliveries';
        END IF;

        IF v_client_employee."clientId" != v_order."clientId" THEN
            IF v_client_employee."companyGroupId" IS NULL OR v_client_employee."companyGroupId" != (
                SELECT "companyGroupId" FROM "Client" WHERE "id" = v_order."clientId"
            ) THEN
                RAISE EXCEPTION 'Client Receiver is not authorized for this client order';
            END IF;
        END IF;
    END IF;

    -- Validate Required Checklist Items
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

    v_new_order_status := p_status::text::"OrderStatus";

    -- 1. Upsert VerificationResponse atomically (clientId = Company, userId = Verifying Person)
    INSERT INTO "VerificationResponse" (
        "id", "tenantId", "orderId", "clientId", "userId", "status", "responses", "comments", "attachments", "createdAt"
    )
    VALUES (
        concat('vr_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."clientId",
        p_user_id,
        p_status,
        p_responses,
        p_comments,
        p_attachments,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ("orderId") DO UPDATE
    SET "status" = p_status,
        "responses" = p_responses,
        "comments" = p_comments,
        "attachments" = p_attachments,
        "userId" = p_user_id;

    -- 2. Update Order status and verification status atomically
    UPDATE "Order"
    SET "verificationStatus" = p_status,
        "status" = v_new_order_status,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_order."id";

    -- 3. Record Order Status History
    INSERT INTO "OrderStatusHistory" ("id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt")
    VALUES (
        concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."status",
        v_new_order_status,
        p_user_id,
        COALESCE(p_comments, concat('Delivery verification completed with status: ', p_status)),
        CURRENT_TIMESTAMP
    );

    -- 4. Record Audit Log
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_user_id,
        v_actor.role::"Role",
        'SUBMIT_DELIVERY_VERIFICATION',
        'Order',
        v_order."id",
        jsonb_build_object(
            'previousStatus', v_order."status",
            'previousVerificationStatus', v_order."verificationStatus"
        ),
        jsonb_build_object(
            'newStatus', v_new_order_status,
            'newVerificationStatus', p_status,
            'comments', p_comments,
            'responsesCount', jsonb_array_length(p_responses)
        ),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order."id",
        'orderNumber', v_order."orderNumber",
        'verificationStatus', p_status,
        'orderStatus', v_new_order_status,
        'verifiedAt', CURRENT_TIMESTAMP,
        'verifiedBy', p_user_id
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) TO authenticated;


-- ============================================================================
-- STEP 8: Update rpc_create_order_with_invoice
-- Exact 10-parameter signature preserved:
-- (text, text, text, text[], text, timestamptz, text, "OrderStatus", jsonb, jsonb) -> jsonb
-- Resolves selectedContactIds as ClientEmployee IDs
-- Preserves Phase 6B invoice sequencing and prefix logic from WarehouseSetting
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_create_order_with_invoice(
    p_tenant_id text,
    p_client_id text,
    p_created_by_id text,
    p_selected_contact_ids text[],
    p_assigned_staff_id text DEFAULT NULL::text,
    p_expected_delivery timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_notes text DEFAULT NULL::text,
    p_status "OrderStatus" DEFAULT 'ISSUED'::"OrderStatus",
    p_eway_bill jsonb DEFAULT NULL::jsonb,
    p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_actor RECORD;
    v_created_by_id TEXT;
    v_staff_tenant_id TEXT;
    v_order_id TEXT;
    v_order_number TEXT;
    v_order_date TIMESTAMPTZ := CURRENT_TIMESTAMP;
    v_subtotal NUMERIC(12, 2) := 0;
    v_tax_total NUMERIC(12, 2) := 0;
    v_discount_total NUMERIC(12, 2) := 0;
    v_total_amount NUMERIC(12, 2) := 0;
    v_last_order_num INTEGER := 0;
    v_next_order_num INTEGER := 1;
    v_invoice_id TEXT;
    v_invoice_number TEXT;
    v_configured_prefix TEXT;
    v_next_invoice_seq INTEGER;
    v_max_existing INTEGER := 0;
    v_status "InvoiceStatus" := 'FINAL';
    v_cgst NUMERIC(12, 2) := 0;
    v_sgst NUMERIC(12, 2) := 0;
    v_item JSONB;
    v_item_subtotal NUMERIC(12, 2);
    v_item_tax NUMERIC(12, 2);
    v_item_discount NUMERIC(12, 2);
    v_item_total NUMERIC(12, 2);
    v_item_order_id TEXT;
    v_invoice_item_id TEXT;
    v_item_quantity INTEGER;
    v_item_unit_price NUMERIC(12, 2);
    v_item_tax_rate NUMERIC(12, 2);
    v_order_history_id TEXT;
    v_audit_log_id TEXT;
    v_warehouse_setting RECORD;
    v_contact_id TEXT;
    v_user_id TEXT;
    v_notification_id TEXT;
    v_inv_match TEXT[];
BEGIN
    -- 1. Resolve session actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- PLATFORM_ADMIN can act on any tenant; all others strictly locked to own tenant
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id IS NULL OR v_actor.tenant_id != p_tenant_id THEN
            RAISE EXCEPTION 'Tenant isolation violation: actor does not belong to specified tenant';
        END IF;
    END IF;

    -- Authorize staff role
    IF NOT (v_actor.role = ANY(ARRAY[
        'WAREHOUSE_OWNER',
        'WAREHOUSE_MODERATOR',
        'WAREHOUSE_STAFF',
        'ACCOUNTANT',
        'PLATFORM_ADMIN'
    ])) THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot create orders', v_actor.role;
    END IF;

    -- Authoritative creator identity
    v_created_by_id := v_actor.actor_id;

    -- Validate client belongs to target tenant and is accessible
    IF NOT public.can_access_client(p_client_id) THEN
        RAISE EXCEPTION 'Access denied: client % is not accessible or does not exist', p_client_id;
    END IF;

    -- Validate assigned staff
    IF p_assigned_staff_id IS NOT NULL THEN
        SELECT "tenantId" INTO v_staff_tenant_id
        FROM "User"
        WHERE "id" = p_assigned_staff_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Assigned staff user % not found', p_assigned_staff_id;
        END IF;

        IF v_staff_tenant_id IS NOT NULL AND v_staff_tenant_id != p_tenant_id THEN
            RAISE EXCEPTION 'Assigned staff user belongs to a different tenant';
        END IF;
    END IF;

    -- 2. Generate Tenant-Scoped Order Number (ORD-YYYY-XXXXXX)
    SELECT COALESCE(
        MAX(
            SUBSTRING("orderNumber" FROM '[0-9]+$')::INTEGER
        ),
        0
    )
    INTO v_last_order_num
    FROM "Order"
    WHERE "tenantId" = p_tenant_id;

    v_next_order_num := v_last_order_num + 1;
    v_order_number := concat(
        'ORD-',
        TO_CHAR(CURRENT_DATE, 'YYYY'),
        '-',
        LPAD(v_next_order_num::TEXT, 6, '0')
    );

    v_order_id := concat(
        'ord_',
        substr(md5(random()::text || clock_timestamp()::text), 1, 16)
    );

    -- 3. Calculate financial totals from items
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_item_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);
            v_item_unit_price := COALESCE((v_item->>'unitPrice')::NUMERIC, 0);
            v_item_tax_rate := COALESCE((v_item->>'taxRate')::NUMERIC, 0);
            v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

            v_item_subtotal := v_item_quantity * v_item_unit_price;
            v_item_tax := ROUND(v_item_subtotal * (v_item_tax_rate / 100.0), 2);
            v_item_total := v_item_subtotal + v_item_tax - v_item_discount;

            v_subtotal := v_subtotal + v_item_subtotal;
            v_tax_total := v_tax_total + v_item_tax;
            v_discount_total := v_discount_total + v_item_discount;
            v_total_amount := v_total_amount + v_item_total;
        END LOOP;
    END IF;

    -- Half-half split between CGST and SGST
    v_cgst := ROUND(v_tax_total / 2.0, 2);
    v_sgst := v_tax_total - v_cgst;

    -- 4. Insert Order
    INSERT INTO "Order" (
        "id",
        "tenantId",
        "clientId",
        "orderNumber",
        "orderDate",
        "expectedDelivery",
        "status",
        "verificationStatus",
        "subtotal",
        "taxTotal",
        "discountTotal",
        "totalAmount",
        "notes",
        "createdById",
        "assignedStaffId",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        v_order_id,
        p_tenant_id,
        p_client_id,
        v_order_number,
        v_order_date,
        p_expected_delivery,
        p_status,
        'PENDING',
        v_subtotal,
        v_tax_total,
        v_discount_total,
        v_total_amount,
        p_notes,
        v_created_by_id,
        p_assigned_staff_id,
        v_order_date,
        v_order_date
    );

    -- 5. Insert Order Items
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_item_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);
            v_item_unit_price := COALESCE((v_item->>'unitPrice')::NUMERIC, 0);
            v_item_tax_rate := COALESCE((v_item->>'taxRate')::NUMERIC, 0);
            v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

            v_item_subtotal := v_item_quantity * v_item_unit_price;
            v_item_tax := ROUND(v_item_subtotal * (v_item_tax_rate / 100.0), 2);
            v_item_total := v_item_subtotal + v_item_tax - v_item_discount;

            v_item_order_id := concat(
                'oi_',
                substr(md5(random()::text || clock_timestamp()::text), 1, 16)
            );

            INSERT INTO "OrderItem" (
                "id",
                "orderId",
                "productId",
                "quantity",
                "unitPrice",
                "taxRate",
                "discount",
                "total"
            )
            VALUES (
                v_item_order_id,
                v_order_id,
                v_item->>'productId',
                v_item_quantity,
                v_item_unit_price,
                v_item_tax_rate,
                v_item_discount,
                v_item_total
            );
        END LOOP;
    END IF;

    -- 6. Generate Tenant-Scoped Invoice Number using WarehouseSetting (Phase 6B preserved)
    SELECT * INTO v_warehouse_setting
    FROM "public"."WarehouseSetting"
    WHERE "tenantId" = p_tenant_id
    FOR UPDATE;

    IF FOUND THEN
        v_configured_prefix := COALESCE(v_warehouse_setting."invoicePrefix", '');
        v_next_invoice_seq  := COALESCE(v_warehouse_setting."nextInvoiceNumber", 1);
    ELSE
        v_configured_prefix := '';
        v_next_invoice_seq  := 1;
    END IF;

    -- Safety scan: ensure sequence is strictly greater than any existing invoice number
    SELECT COALESCE(
        MAX(
            CASE
                WHEN ("invoiceNumber" ~ '[0-9]+$') THEN
                    (regexp_match("invoiceNumber", '([0-9]+)$'))[1]::INTEGER
                ELSE 0
            END
        ),
        0
    )
    INTO v_max_existing
    FROM "public"."Invoice"
    WHERE "tenantId" = p_tenant_id;

    IF v_max_existing >= v_next_invoice_seq THEN
        v_next_invoice_seq := v_max_existing + 1;
    END IF;

    -- Format invoice number: configured prefix + 6-digit zero-padded sequence
    v_invoice_number := concat(
        v_configured_prefix,
        LPAD(v_next_invoice_seq::TEXT, 6, '0')
    );

    -- Advance next sequence in WarehouseSetting
    IF FOUND THEN
        UPDATE "public"."WarehouseSetting"
        SET "nextInvoiceNumber" = v_next_invoice_seq + 1,
            "updatedAt"         = CURRENT_TIMESTAMP
        WHERE "tenantId" = p_tenant_id;
    ELSE
        INSERT INTO "public"."WarehouseSetting" (
            "id",
            "tenantId",
            "orderPrefix",
            "invoicePrefix",
            "nextInvoiceNumber",
            "updatedAt"
        )
        VALUES (
            concat('ws_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            p_tenant_id,
            'ORD',
            v_configured_prefix,
            v_next_invoice_seq + 1,
            CURRENT_TIMESTAMP
        );
    END IF;

    -- 7. Insert Invoice
    v_invoice_id := concat(
        'inv_',
        substr(md5(random()::text || clock_timestamp()::text), 1, 16)
    );

    INSERT INTO "Invoice" (
        "id",
        "tenantId",
        "orderId",
        "clientId",
        "invoiceNumber",
        "invoiceDate",
        "status",
        "paymentStatus",
        "subtotal",
        "cgst",
        "sgst",
        "igst",
        "discountTotal",
        "total",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        v_invoice_id,
        p_tenant_id,
        v_order_id,
        p_client_id,
        v_invoice_number,
        v_order_date,
        v_status,
        'UNPAID',
        v_subtotal,
        v_cgst,
        v_sgst,
        0,
        v_discount_total,
        v_total_amount,
        v_order_date,
        v_order_date
    );

    -- 8. Insert Invoice Items
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_item_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);
            v_item_unit_price := COALESCE((v_item->>'unitPrice')::NUMERIC, 0);
            v_item_tax_rate := COALESCE((v_item->>'taxRate')::NUMERIC, 0);
            v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

            v_item_subtotal := v_item_quantity * v_item_unit_price;
            v_item_tax := ROUND(v_item_subtotal * (v_item_tax_rate / 100.0), 2);
            v_item_total := v_item_subtotal + v_item_tax - v_item_discount;

            v_invoice_item_id := concat(
                'ii_',
                substr(md5(random()::text || clock_timestamp()::text), 1, 16)
            );

            INSERT INTO "InvoiceItem" (
                "id",
                "invoiceId",
                "productId",
                "quantity",
                "rate",
                "discount",
                "cgst",
                "sgst",
                "igst",
                "total"
            )
            VALUES (
                v_invoice_item_id,
                v_invoice_id,
                v_item->>'productId',
                v_item_quantity,
                v_item_unit_price,
                v_item_discount,
                ROUND(v_item_tax / 2.0, 2),
                v_item_tax - ROUND(v_item_tax / 2.0, 2),
                0,
                v_item_total
            );
        END LOOP;
    END IF;

    -- 9. Insert Order Status History
    v_order_history_id := concat(
        'osh_',
        substr(md5(random()::text || clock_timestamp()::text), 1, 16)
    );

    INSERT INTO "OrderStatusHistory" (
        "id",
        "tenantId",
        "orderId",
        "previousStatus",
        "newStatus",
        "changedById",
        "notes",
        "createdAt"
    )
    VALUES (
        v_order_history_id,
        p_tenant_id,
        v_order_id,
        NULL,
        p_status,
        v_created_by_id,
        'Initial order created',
        v_order_date
    );

    -- 10. Insert notifications for designated Client Employees
    IF p_selected_contact_ids IS NOT NULL
       AND array_length(p_selected_contact_ids, 1) > 0
    THEN
        FOREACH v_contact_id IN ARRAY p_selected_contact_ids
        LOOP
            -- Look up user ID from ClientEmployee entity
            SELECT ce."userId"
            INTO v_user_id
            FROM "ClientEmployee" ce
            WHERE ce."id" = v_contact_id
              AND ce."clientId" = p_client_id
              AND ce."tenantId" = p_tenant_id;

            IF v_user_id IS NOT NULL THEN
                v_notification_id := concat(
                    'notif_',
                    substr(md5(random()::text || clock_timestamp()::text), 1, 16)
                );

                INSERT INTO "Notification" (
                    "id",
                    "tenantId",
                    "userId",
                    "orderId",
                    "type",
                    "title",
                    "message",
                    "actionUrl",
                    "priority",
                    "read",
                    "createdAt"
                )
                VALUES (
                    v_notification_id,
                    p_tenant_id,
                    v_user_id,
                    v_order_id,
                    'NEW_ORDER',
                    'New Order Created',
                    concat(
                        'Order ',
                        v_order_number,
                        ' has been created for your company.'
                    ),
                    concat('/orders/', v_order_id),
                    'normal',
                    FALSE,
                    v_order_date
                );
            END IF;
        END LOOP;
    END IF;

    -- 11. Insert Audit Log
    v_audit_log_id := concat(
        'aud_',
        substr(md5(random()::text || clock_timestamp()::text), 1, 16)
    );

    INSERT INTO "AuditLog" (
        "id",
        "tenantId",
        "userId",
        "userRole",
        "action",
        "entity",
        "entityId",
        "newValue",
        "createdAt"
    )
    VALUES (
        v_audit_log_id,
        p_tenant_id,
        v_created_by_id,
        v_actor.role::"Role",
        'Created order with final invoice',
        'Order',
        v_order_id,
        jsonb_build_object(
            'orderNumber', v_order_number,
            'status', p_status,
            'invoiceNumber', v_invoice_number,
            'invoiceStatus', v_status,
            'totalAmount', v_total_amount
        ),
        v_order_date
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'order', jsonb_build_object(
            'id', v_order_id,
            'orderNumber', v_order_number,
            'totalAmount', v_total_amount,
            'status', p_status
        ),
        'invoice', jsonb_build_object(
            'id', v_invoice_id,
            'invoiceNumber', v_invoice_number,
            'total', v_total_amount,
            'status', v_status
        )
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_create_order_with_invoice(text,text,text,text[],text,timestamptz,text,"OrderStatus",jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_create_order_with_invoice(text,text,text,text[],text,timestamptz,text,"OrderStatus",jsonb,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_order_with_invoice(text,text,text,text[],text,timestamptz,text,"OrderStatus",jsonb,jsonb) TO authenticated;


-- ============================================================================
-- STEP 9: Seed Clean Development Test Companies & Client Employees
-- ============================================================================

DO $$
DECLARE
    v_tenant_id TEXT := '7398ea38-92ce-4a6f-96ac-135c051c36ac';
    v_kauvery_client_id TEXT := 'cl_kauvery_healthcare';
    v_pvr_client_id TEXT := 'cl_pvr_cinemas';
BEGIN
    -- Only seed if the tenant exists
    IF EXISTS (SELECT 1 FROM "Tenant" WHERE "id" = v_tenant_id) THEN
        -- 1. Insert Kauvery Healthcare Ltd
        INSERT INTO "Client" (
            "id", "tenantId", "companyName", "gstNumber", "billingAddress", "shippingAddress", "companyGroupId", "status", "createdAt", "updatedAt"
        )
        VALUES (
            v_kauvery_client_id,
            v_tenant_id,
            'Kauvery Healthcare Ltd',
            '33AAACK1234F1Z5',
            'No. 199, Luz Church Road, Mylapore, Chennai, Tamil Nadu 600004',
            'No. 199, Luz Church Road, Mylapore, Chennai, Tamil Nadu 600004',
            'cg_2a65e8fe88ea48d4',
            'ACTIVE',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT ("tenantId", "companyName") DO NOTHING;

        -- 2. Insert PVR Cinemas Ltd
        INSERT INTO "Client" (
            "id", "tenantId", "companyName", "gstNumber", "billingAddress", "shippingAddress", "companyGroupId", "status", "createdAt", "updatedAt"
        )
        VALUES (
            v_pvr_client_id,
            v_tenant_id,
            'PVR Cinemas Ltd',
            '33AAACP5678K1Z9',
            'VR Mall, Jawaharlal Nehru Road, Anna Nagar, Chennai, Tamil Nadu 600040',
            'VR Mall, Jawaharlal Nehru Road, Anna Nagar, Chennai, Tamil Nadu 600040',
            'cg_1e029fc10371853f',
            'ACTIVE',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT ("tenantId", "companyName") DO NOTHING;

        -- 3. Link existing WMS users as ClientEmployees under Kauvery Healthcare Ltd
        -- axe (GM)
        INSERT INTO "ClientEmployee" (
            "id", "tenantId", "clientId", "userId", "employeeRole", "contactPerson", "mobile", "email", "status"
        )
        VALUES (
            'ce_kauvery_axe',
            v_tenant_id,
            v_kauvery_client_id,
            '4e5a4c57-509e-4c2c-a2e4-382b291f988d',
            'GM',
            'axe',
            '783786378637',
            'axe@gmail.com',
            'ACTIVE'
        )
        ON CONFLICT ("tenantId", "mobile") DO NOTHING;

        -- ash (RECEIVER)
        INSERT INTO "ClientEmployee" (
            "id", "tenantId", "clientId", "userId", "employeeRole", "contactPerson", "mobile", "email", "status"
        )
        VALUES (
            'ce_kauvery_ash',
            v_tenant_id,
            v_kauvery_client_id,
            '384d2191-a74b-4bb4-8b26-ac301fd95f33',
            'RECEIVER',
            'ash',
            '275327',
            'ash@gmail.com',
            'ACTIVE'
        )
        ON CONFLICT ("tenantId", "mobile") DO NOTHING;

        -- ken (MANAGER)
        INSERT INTO "ClientEmployee" (
            "id", "tenantId", "clientId", "userId", "employeeRole", "contactPerson", "mobile", "email", "status"
        )
        VALUES (
            'ce_kauvery_ken',
            v_tenant_id,
            v_kauvery_client_id,
            'cf0d395c-3cf9-459f-92e1-1ec33078c0d6',
            'MANAGER',
            'ken',
            '727837',
            'ken@gmail.com',
            'ACTIVE'
        )
        ON CONFLICT ("tenantId", "mobile") DO NOTHING;

        -- maxi (ACCOUNT)
        INSERT INTO "ClientEmployee" (
            "id", "tenantId", "clientId", "userId", "employeeRole", "contactPerson", "mobile", "email", "status"
        )
        VALUES (
            'ce_kauvery_maxi',
            v_tenant_id,
            v_kauvery_client_id,
            '5e913785-569e-43a4-8ce7-dbcac6a10f5e',
            'ACCOUNT',
            'maxi',
            '9893029837',
            'maxi@gmail.com',
            'ACTIVE'
        )
        ON CONFLICT ("tenantId", "mobile") DO NOTHING;

        -- 4. Link existing WMS users as ClientEmployees under PVR Cinemas Ltd
        -- ramu (GM)
        INSERT INTO "ClientEmployee" (
            "id", "tenantId", "clientId", "userId", "employeeRole", "contactPerson", "mobile", "email", "status"
        )
        VALUES (
            'ce_pvr_ramu',
            v_tenant_id,
            v_pvr_client_id,
            '91785a38-73a3-434b-9fd4-7de10be08bcf',
            'GM',
            'ramu',
            '7327832783',
            'ramu@gmail.com',
            'ACTIVE'
        )
        ON CONFLICT ("tenantId", "mobile") DO NOTHING;

        -- ram (RECEIVER)
        INSERT INTO "ClientEmployee" (
            "id", "tenantId", "clientId", "userId", "employeeRole", "contactPerson", "mobile", "email", "status"
        )
        VALUES (
            'ce_pvr_ram',
            v_tenant_id,
            v_pvr_client_id,
            'f833abde-a39b-4154-a3bd-9ef5a3529897',
            'RECEIVER',
            'ram',
            '6787898780',
            'ram@gmail.com',
            'ACTIVE'
        )
        ON CONFLICT ("tenantId", "mobile") DO NOTHING;

        -- acc (ACCOUNT)
        INSERT INTO "ClientEmployee" (
            "id", "tenantId", "clientId", "userId", "employeeRole", "contactPerson", "mobile", "email", "status"
        )
        VALUES (
            'ce_pvr_acc',
            v_tenant_id,
            v_pvr_client_id,
            'usr_1dreqpv7htj15zflte',
            'ACCOUNT',
            'acc',
            '42737783',
            'acc@gmail.com',
            'ACTIVE'
        )
        ON CONFLICT ("tenantId", "mobile") DO NOTHING;

        -- kev (RECEIVER)
        INSERT INTO "ClientEmployee" (
            "id", "tenantId", "clientId", "userId", "employeeRole", "contactPerson", "mobile", "email", "status"
        )
        VALUES (
            'ce_pvr_kev',
            v_tenant_id,
            v_pvr_client_id,
            '42caa2e3-ee15-42a9-bebe-bfcf4e42b9e4',
            'RECEIVER',
            'kev',
            '278327',
            'kev@gmail.com',
            'ACTIVE'
        )
        ON CONFLICT ("tenantId", "mobile") DO NOTHING;
    END IF;
END $$;
