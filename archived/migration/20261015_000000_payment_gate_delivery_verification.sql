-- ============================================================================
-- Migration: 20261015_000000_payment_gate_delivery_verification.sql
-- Description: Gated payment authorization on delivery verification (order.deliveryVerifiedAt IS NOT NULL).
--              Transition unpaid invoice to PAYMENT_PENDING upon delivery verification.
-- ============================================================================

-- ============================================================================
-- PART 1: Update rpc_submit_verification to transition unpaid invoices to PAYMENT_PENDING
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
AS $$
DECLARE
    v_actor RECORD;
    v_order RECORD;
    v_user RECORD;
    v_client_employee RECORD;
    v_item JSONB;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit delivery verification';
    END IF;

    -- Authoritative user ID from session
    p_user_id := v_actor.actor_id;

    SELECT * INTO v_user FROM "User" WHERE "id" = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % not found', p_user_id;
    END IF;

    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    IF v_order.status = 'ISSUED' THEN
        RAISE EXCEPTION 'Order % is still in ISSUED status and cannot be verified until dispatched', v_order."orderNumber";
    END IF;

    IF v_order.status != 'DISPATCHED' THEN
        RAISE EXCEPTION 'This order (%) is not ready for client verification. Current status: %', v_order."orderNumber", v_order.status;
    END IF;

    IF p_status::text IN ('RECEIVED', 'VERIFICATION_PENDING', 'PENDING') THEN
        RAISE EXCEPTION 'Invalid verification status: %. Only VERIFIED, PARTIALLY_VERIFIED, or REJECTED are permitted', p_status;
    END IF;

    -- Tenant isolation check
    IF v_user."tenantId" IS NOT NULL AND v_user."tenantId" != v_order."tenantId" THEN
        RAISE EXCEPTION 'Cross-tenant verification access denied';
    END IF;

    -- Role & Granular Permission Validation
    IF v_user.role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT') THEN
        RAISE EXCEPTION 'Accounting users cannot submit delivery verifications';
    END IF;

    IF v_user.role = 'CLIENT' THEN
        SELECT ce.*, c."companyGroupId"
        INTO v_client_employee
        FROM "ClientEmployee" ce
        JOIN "Client" c ON c."id" = ce."clientId"
        WHERE ce."userId" = v_user.id AND ce."tenantId" = v_order."tenantId" AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Active client employee profile not associated with authenticated user';
        END IF;

        -- STORE and ACCOUNT cannot verify delivery
        IF v_client_employee."employeeRole" = 'STORE' THEN
            RAISE EXCEPTION 'Storekeepers (STORE) are restricted to inventory verification and cannot perform delivery verification';
        END IF;

        IF v_client_employee."employeeRole" = 'ACCOUNT' THEN
            RAISE EXCEPTION 'Accountants (ACCOUNT) cannot perform delivery verification';
        END IF;

        -- Verify granular permission DELIVERY_VERIFY
        IF NOT public.has_permission('DELIVERY_VERIFY') THEN
            RAISE EXCEPTION 'Permission denied: DELIVERY_VERIFY permission required';
        END IF;

        -- Company isolation: must match order's clientId (or corporate group for MD/GM)
        IF NOT public.can_access_client(v_order."clientId") THEN
            RAISE EXCEPTION 'Client employee is not authorized for this client order';
        END IF;
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

    -- Upsert VerificationResponse
    INSERT INTO "VerificationResponse" (
        "id", "tenantId", "orderId", "clientId", "userId", "status", "responses", "comments", "attachments", "createdAt"
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
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ("orderId") DO UPDATE
    SET "status" = p_status,
        "responses" = p_responses,
        "comments" = p_comments,
        "attachments" = p_attachments,
        "userId" = p_user_id;

    -- Update Order: Record delivery verification timestamp and user
    -- Order remains DISPATCHED until store/inventory verification is completed
    UPDATE "Order"
    SET "deliveryVerifiedAt" = CURRENT_TIMESTAMP,
        "deliveryVerifiedById" = p_user_id,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_order."id";

    -- Advance unpaid invoices for this order to PAYMENT_PENDING immediately upon delivery verification
    UPDATE "Invoice"
    SET "paymentStatus" = 'PAYMENT_PENDING',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "orderId" = v_order."id" AND "paymentStatus" = 'UNPAID';

    -- Record Audit Log
    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_user_id,
        v_actor.role::"Role",
        'SUBMIT_DELIVERY_VERIFICATION',
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
            'comments', p_comments
        ),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order."id",
        'orderNumber', v_order."orderNumber",
        'deliveryVerified', true,
        'inventoryPending', true,
        'orderStatus', v_order."status",
        'verifiedAt', CURRENT_TIMESTAMP,
        'verifiedBy', p_user_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) TO authenticated;


-- ============================================================================
-- PART 2: Update rpc_record_payment_secure to require delivery verification and FINAL invoice
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_record_payment_secure(
    p_invoice_id TEXT,
    p_amount NUMERIC,
    p_method TEXT DEFAULT 'BANK_TRANSFER',
    p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_invoice RECORD;
    v_order RECORD;
    v_payment_id TEXT;
    v_method TEXT;
    v_reference TEXT;
    v_total_paid NUMERIC(12,2);
    v_new_payment_status "PaymentStatus";
    v_client_employee RECORD;
BEGIN
    -- 1. Resolve current actor securely from database session
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- 2. Verify actor payment authorization
    IF v_actor.role IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTS_TEAM', 'ACCOUNTANT', 'CLIENT_ACCOUNTANT') THEN
        -- Standard authorized staff / accounting roles
        NULL;
    ELSIF v_actor.role = 'CLIENT' THEN
        -- Check ClientEmployee specific permission
        SELECT ce.* INTO v_client_employee
        FROM public."ClientEmployee" ce
        WHERE ce."userId" = v_actor.actor_id AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Permission denied: no active client employee record found for user';
        END IF;

        -- Explicit rejection for RECEIVER and STORE client roles
        IF v_client_employee."employeeRole" IN ('RECEIVER', 'STORE') THEN
            RAISE EXCEPTION 'Permission denied: Client employee role % is not authorized to record payments',
                v_client_employee."employeeRole";
        END IF;

        -- Authorize via granular permission check
        IF NOT public.has_permission('PAYMENTS_RECORD') THEN
            RAISE EXCEPTION 'Permission denied: payment management is not allowed for current role';
        END IF;
    ELSE
        RAISE EXCEPTION 'Permission denied: payment management is not allowed for role %', v_actor.role;
    END IF;

    -- 3. Validate payment amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- 4. Load and validate invoice
    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    -- 5. Validate invoice status is FINAL
    IF v_invoice.status != 'FINAL' THEN
        RAISE EXCEPTION 'Invoice % is not in FINAL status', p_invoice_id;
    END IF;

    -- 6. Load associated order and enforce Delivery Verification gate
    IF v_invoice."orderId" IS NULL THEN
        RAISE EXCEPTION 'Invoice % is not associated with an order', p_invoice_id;
    END IF;

    SELECT * INTO v_order FROM "Order" WHERE "id" = v_invoice."orderId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % for invoice % not found', v_invoice."orderId", p_invoice_id;
    END IF;

    IF v_order."deliveryVerifiedAt" IS NULL THEN
        RAISE EXCEPTION 'Payment is available after delivery verification';
    END IF;

    -- 7. Tenant and Client isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id IS NULL OR v_actor.tenant_id != v_invoice."tenantId" THEN
            RAISE EXCEPTION 'Permission denied: invoice belongs to another tenant';
        END IF;

        -- Verify client actor has access to this client's invoice (respecting group-wide for MD/GM)
        IF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
            IF NOT public.can_access_client(v_invoice."clientId") THEN
                RAISE EXCEPTION 'Permission denied: invoice belongs to another client company';
            END IF;
        END IF;
    END IF;

    -- 8. Generate payment details
    v_payment_id := concat('pay_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    v_method := COALESCE(NULLIF(TRIM(p_method), ''), 'BANK_TRANSFER');
    v_reference := NULLIF(TRIM(p_reference), '');
    IF v_reference IS NULL THEN
        v_reference := concat('PAY-', right((extract(epoch from clock_timestamp()) * 1000)::bigint::text, 6));
    END IF;

    -- 9. Insert Payment record
    INSERT INTO "Payment" (
        "id", "tenantId", "invoiceId", "amount", "status", "method", "reference", "proofUrl", "paidAt", "createdAt"
    ) VALUES (
        v_payment_id,
        v_invoice."tenantId",
        v_invoice."id",
        p_amount,
        'PAID',
        v_method,
        v_reference,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

    -- 10. Calculate total paid from trusted database records
    SELECT COALESCE(SUM("amount"), 0) INTO v_total_paid
    FROM "Payment"
    WHERE "invoiceId" = v_invoice."id" AND "status" = 'PAID';

    -- 11. Determine new payment status on the Invoice
    IF v_total_paid >= v_invoice."total" THEN
        v_new_payment_status := 'PAID';
    ELSIF v_total_paid > 0 THEN
        v_new_payment_status := 'PARTIALLY_PAID';
    ELSE
        v_new_payment_status := 'PAYMENT_PENDING';
    END IF;

    -- 12. Update Invoice payment status
    UPDATE "Invoice"
    SET "paymentStatus" = v_new_payment_status,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_invoice."id";

    -- 13. Record in AuditLog using resolved actor
    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_invoice."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'RECORD_PAYMENT',
        'Payment',
        v_payment_id,
        jsonb_build_object(
            'amount', p_amount,
            'paymentStatus', v_new_payment_status,
            'method', v_method,
            'reference', v_reference,
            'totalPaid', v_total_paid,
            'invoiceTotal', v_invoice."total"
        ),
        CURRENT_TIMESTAMP
    );

    -- 14. Return payload
    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment_id,
        'invoiceId', v_invoice."id",
        'paymentStatus', v_new_payment_status,
        'totalPaid', v_total_paid
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_record_payment_secure(TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_record_payment_secure(TEXT, NUMERIC, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_record_payment_secure(TEXT, NUMERIC, TEXT, TEXT) TO authenticated;


-- ============================================================================
-- PART 3: Update rpc_attach_payment_proof to require delivery verification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_attach_payment_proof(
    p_payment_id TEXT,
    p_invoice_id TEXT,
    p_proof_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_payment RECORD;
    v_invoice RECORD;
    v_order RECORD;
    v_client_employee RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- Verify actor authorization
    IF v_actor.role IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTS_TEAM', 'ACCOUNTANT', 'CLIENT_ACCOUNTANT') THEN
        NULL;
    ELSIF v_actor.role = 'CLIENT' THEN
        SELECT ce.* INTO v_client_employee
        FROM public."ClientEmployee" ce
        WHERE ce."userId" = v_actor.actor_id AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Permission denied: active client employee record not found';
        END IF;

        IF v_client_employee."employeeRole" IN ('RECEIVER', 'STORE') THEN
            RAISE EXCEPTION 'Permission denied: Client employee role % is not authorized to upload payment proof',
                v_client_employee."employeeRole";
        END IF;

        IF NOT public.has_permission('PAYMENT_PROOF_UPLOAD') THEN
            RAISE EXCEPTION 'Permission denied: payment proof upload is not allowed';
        END IF;
    ELSE
        RAISE EXCEPTION 'Permission denied: payment proof attachment is not allowed for role %', v_actor.role;
    END IF;

    IF p_proof_url IS NULL OR TRIM(p_proof_url) = '' THEN
        RAISE EXCEPTION 'Proof URL cannot be empty';
    END IF;

    SELECT * INTO v_payment FROM "Payment" WHERE "id" = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment % not found', p_payment_id;
    END IF;

    IF v_payment."invoiceId" != p_invoice_id THEN
        RAISE EXCEPTION 'Permission denied: payment does not belong to invoice';
    END IF;

    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    -- Enforce associated order exists and delivery verification completed
    IF v_invoice."orderId" IS NULL THEN
        RAISE EXCEPTION 'Invoice % is not associated with an order', p_invoice_id;
    END IF;

    SELECT * INTO v_order FROM "Order" WHERE "id" = v_invoice."orderId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % for invoice % not found', v_invoice."orderId", p_invoice_id;
    END IF;

    IF v_order."deliveryVerifiedAt" IS NULL THEN
        RAISE EXCEPTION 'Payment proof upload is available after delivery verification';
    END IF;

    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id IS NULL OR v_actor.tenant_id != v_payment."tenantId" THEN
            RAISE EXCEPTION 'Permission denied: payment belongs to another tenant';
        END IF;

        IF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
            IF NOT public.can_access_client(v_invoice."clientId") THEN
                RAISE EXCEPTION 'Permission denied: invoice belongs to another client company';
            END IF;
        END IF;
    END IF;

    UPDATE "Payment"
    SET "proofUrl" = p_proof_url
    WHERE "id" = p_payment_id;

    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_payment."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'ATTACH_PAYMENT_PROOF',
        'Payment',
        p_payment_id,
        jsonb_build_object('proofUrl', p_proof_url, 'invoiceId', p_invoice_id),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'paymentId', p_payment_id,
        'invoiceId', p_invoice_id,
        'proofUrl', p_proof_url
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_attach_payment_proof(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_attach_payment_proof(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_attach_payment_proof(TEXT, TEXT, TEXT) TO authenticated;
