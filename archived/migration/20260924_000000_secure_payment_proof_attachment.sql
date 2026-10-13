-- ============================================================================
-- Migration: 20260924_000000_secure_payment_proof_attachment.sql
-- Description: Phase 2B - Secure RPCs for payment proof attachment and payment cancellation
-- ============================================================================

-- 1. Secure RPC for attaching payment proof
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
    v_actor_user_id   TEXT;
    v_actor_tenant_id TEXT;
    v_actor_role      TEXT;
    v_actor_status    TEXT;
    v_payment         RECORD;
    v_invoice         RECORD;
BEGIN
    -- 1. Resolve current actor securely from database session
    SELECT user_id, tenant_id, role, status
    INTO v_actor_user_id, v_actor_tenant_id, v_actor_role, v_actor_status
    FROM public.resolve_current_actor();

    -- 2. Verify actor payment authorization (payments:manage)
    IF NOT (v_actor_role IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTS_TEAM', 'ACCOUNTANT', 'CLIENT_ACCOUNTANT')) THEN
        RAISE EXCEPTION 'Permission denied: payment proof attachment is not allowed for role %', v_actor_role;
    END IF;

    -- 3. Validate proof URL is non-empty
    IF p_proof_url IS NULL OR TRIM(p_proof_url) = '' THEN
        RAISE EXCEPTION 'Proof URL cannot be empty';
    END IF;

    -- 4. Load and validate Payment
    SELECT * INTO v_payment FROM "Payment" WHERE "id" = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment % not found', p_payment_id;
    END IF;

    -- 5. Verify payment belongs to specified invoice
    IF v_payment."invoiceId" != p_invoice_id THEN
        RAISE EXCEPTION 'Permission denied: payment does not belong to invoice';
    END IF;

    -- 6. Tenant isolation check on Payment
    IF v_actor_role != 'PLATFORM_ADMIN' THEN
        IF v_actor_tenant_id IS NULL OR v_actor_tenant_id != v_payment."tenantId" THEN
            RAISE EXCEPTION 'Permission denied: payment belongs to another tenant';
        END IF;
    END IF;

    -- 7. Load and validate Invoice
    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    -- 8. Verify tenant consistency between Payment and Invoice
    IF v_payment."tenantId" != v_invoice."tenantId" THEN
        RAISE EXCEPTION 'Data inconsistency: payment tenant does not match invoice tenant';
    END IF;

    -- 9. Validate Storage path isolation:
    -- Expected format: {tenantId}/{invoiceId}/{paymentId}/{filename}
    IF NOT (p_proof_url LIKE (v_payment."tenantId" || '/' || v_payment."invoiceId" || '/' || v_payment."id" || '/%')) THEN
        RAISE EXCEPTION 'Invalid proof URL format: storage path must match payment and invoice context';
    END IF;

    -- 10. Update ONLY the proofUrl field on Payment
    UPDATE "Payment"
    SET "proofUrl" = p_proof_url
    WHERE "id" = v_payment."id";

    -- 11. Record in AuditLog using resolved actor
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
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_payment."tenantId",
        v_actor_user_id,
        v_actor_role::"Role",
        'Attached payment proof',
        'Payment',
        v_payment."id",
        jsonb_build_object(
            'paymentId', v_payment."id",
            'invoiceId', v_payment."invoiceId",
            'proofUrl', p_proof_url
        ),
        CURRENT_TIMESTAMP
    );

    -- 12. Return payload
    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment."id",
        'invoiceId', v_payment."invoiceId",
        'proofUrl', p_proof_url
    );
END;
$$;

-- Revoke public execution for rpc_attach_payment_proof
REVOKE ALL ON FUNCTION public.rpc_attach_payment_proof(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_attach_payment_proof(TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_attach_payment_proof(TEXT, TEXT, TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.rpc_attach_payment_proof(TEXT, TEXT, TEXT) TO authenticated;


-- 2. Secure RPC for cancelling / cleanup of a payment record
CREATE OR REPLACE FUNCTION public.rpc_cancel_payment_record(
    p_payment_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_user_id      TEXT;
    v_actor_tenant_id    TEXT;
    v_actor_role         TEXT;
    v_actor_status       TEXT;
    v_payment            RECORD;
    v_invoice            RECORD;
    v_total_paid         NUMERIC(12,2);
    v_new_payment_status "PaymentStatus";
BEGIN
    -- 1. Resolve current actor securely from database session
    SELECT user_id, tenant_id, role, status
    INTO v_actor_user_id, v_actor_tenant_id, v_actor_role, v_actor_status
    FROM public.resolve_current_actor();

    -- 2. Verify actor payment authorization (payments:manage)
    IF NOT (v_actor_role IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTS_TEAM', 'ACCOUNTANT', 'CLIENT_ACCOUNTANT')) THEN
        RAISE EXCEPTION 'Permission denied: payment cancellation is not allowed for role %', v_actor_role;
    END IF;

    -- 3. Load Payment
    SELECT * INTO v_payment FROM "Payment" WHERE "id" = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment % not found', p_payment_id;
    END IF;

    -- 4. Verify tenant isolation
    IF v_actor_role != 'PLATFORM_ADMIN' THEN
        IF v_actor_tenant_id IS NULL OR v_actor_tenant_id != v_payment."tenantId" THEN
            RAISE EXCEPTION 'Permission denied: payment belongs to another tenant';
        END IF;
    END IF;

    -- 5. Check if already cancelled
    IF v_payment."status" = 'CANCELLED' THEN
        RAISE EXCEPTION 'Payment % is already cancelled', p_payment_id;
    END IF;

    -- 6. Load Invoice
    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = v_payment."invoiceId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', v_payment."invoiceId";
    END IF;

    -- 7. Update Payment status to CANCELLED (native PaymentStatus enum)
    UPDATE "Payment"
    SET "status" = 'CANCELLED'
    WHERE "id" = v_payment."id";

    -- 8. Recalculate total paid from remaining PAID payments
    SELECT COALESCE(SUM("amount"), 0) INTO v_total_paid
    FROM "Payment"
    WHERE "invoiceId" = v_invoice."id" AND "status" = 'PAID';

    -- 9. Determine new payment status for Invoice
    IF v_total_paid >= v_invoice."total" THEN
        v_new_payment_status := 'PAID';
    ELSIF v_total_paid > 0 THEN
        v_new_payment_status := 'PARTIALLY_PAID';
    ELSE
        v_new_payment_status := 'UNPAID';
    END IF;

    -- 10. Update Invoice payment status
    UPDATE "Invoice"
    SET "paymentStatus" = v_new_payment_status,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_invoice."id";

    -- 11. Revert order status if invoice was previously paid and order is currently PAID
    IF v_new_payment_status != 'PAID' AND v_invoice."orderId" IS NOT NULL THEN
        UPDATE "Order"
        SET "status" = 'PAYMENT_PENDING',
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = v_invoice."orderId" AND "status" = 'PAID';
    END IF;

    -- 12. Record in AuditLog
    INSERT INTO "AuditLog" (
        "id",
        "tenantId",
        "userId",
        "userRole",
        "action",
        "entity",
        "entityId",
        "previousValue",
        "newValue",
        "createdAt"
    )
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_payment."tenantId",
        v_actor_user_id,
        v_actor_role::"Role",
        'Cancelled payment',
        'Payment',
        v_payment."id",
        jsonb_build_object('status', v_payment."status", 'amount', v_payment."amount"),
        jsonb_build_object('status', 'CANCELLED', 'invoicePaymentStatus', v_new_payment_status, 'totalPaid', v_total_paid),
        CURRENT_TIMESTAMP
    );

    -- 13. Return payload
    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment."id",
        'invoiceId', v_invoice."id",
        'status', 'CANCELLED',
        'newPaymentStatus', v_new_payment_status,
        'totalPaid', v_total_paid
    );
END;
$$;

-- Revoke public execution for rpc_cancel_payment_record
REVOKE ALL ON FUNCTION public.rpc_cancel_payment_record(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_cancel_payment_record(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_cancel_payment_record(TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_payment_record(TEXT) TO authenticated;
