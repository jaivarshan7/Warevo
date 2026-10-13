-- ============================================================================
-- Migration: 20260923_000000_secure_payment_recording.sql
-- Description: Phase 2A - Secure payment recording RPC backed by resolve_current_actor()
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
    v_actor_user_id   TEXT;
    v_actor_tenant_id TEXT;
    v_actor_role      TEXT;
    v_actor_status    TEXT;
    v_invoice         RECORD;
    v_payment_id      TEXT;
    v_method          TEXT;
    v_reference       TEXT;
    v_total_paid      NUMERIC(12,2);
    v_new_payment_status "PaymentStatus";
BEGIN
    -- 1. Resolve current actor securely from database session
    SELECT user_id, tenant_id, role, status
    INTO v_actor_user_id, v_actor_tenant_id, v_actor_role, v_actor_status
    FROM public.resolve_current_actor();

    -- 2. Verify actor payment authorization
    IF NOT (v_actor_role IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTS_TEAM', 'ACCOUNTANT', 'CLIENT_ACCOUNTANT')) THEN
        RAISE EXCEPTION 'Permission denied: payment management is not allowed for role %', v_actor_role;
    END IF;

    -- 3. Validate amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- 4. Load and validate invoice
    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    -- 5. Tenant isolation check
    -- PLATFORM_ADMIN is allowed cross-tenant operation; all other roles must strictly match
    IF v_actor_role != 'PLATFORM_ADMIN' THEN
        IF v_actor_tenant_id IS NULL OR v_actor_tenant_id != v_invoice."tenantId" THEN
            RAISE EXCEPTION 'Permission denied: invoice belongs to another tenant';
        END IF;
    END IF;

    -- 6. Generate payment details
    v_payment_id := concat('pay_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    v_method := COALESCE(NULLIF(TRIM(p_method), ''), 'BANK_TRANSFER');
    v_reference := NULLIF(TRIM(p_reference), '');
    IF v_reference IS NULL THEN
        v_reference := concat('PAY-', right((extract(epoch from clock_timestamp()) * 1000)::bigint::text, 6));
    END IF;

    -- 7. Insert Payment record (proofUrl is set to NULL initially; attached in proof flow)
    INSERT INTO "Payment" (
        "id",
        "tenantId",
        "invoiceId",
        "amount",
        "status",
        "method",
        "reference",
        "proofUrl",
        "paidAt",
        "createdAt"
    )
    VALUES (
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

    -- 8. Calculate total paid from trusted database records
    SELECT COALESCE(SUM("amount"), 0) INTO v_total_paid
    FROM "Payment"
    WHERE "invoiceId" = v_invoice."id" AND "status" = 'PAID';

    -- 9. Determine new payment status & update order workflow if fully paid
    IF v_total_paid >= v_invoice."total" THEN
        v_new_payment_status := 'PAID';
        -- Update related order status to PAID if currently PAYMENT_PENDING or INVOICED
        IF v_invoice."orderId" IS NOT NULL THEN
            UPDATE "Order"
            SET "status" = 'PAID', "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = v_invoice."orderId" AND "status" IN ('INVOICED', 'PAYMENT_PENDING');
        END IF;
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
        v_invoice."tenantId",
        v_actor_user_id,
        v_actor_role::"Role",
        'Recorded payment',
        'Payment',
        v_payment_id,
        jsonb_build_object(
            'amount', p_amount,
            'paymentStatus', v_new_payment_status,
            'method', v_method,
            'reference', v_reference
        ),
        CURRENT_TIMESTAMP
    );

    -- 12. Return payload
    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment_id,
        'invoiceId', v_invoice."id",
        'paymentStatus', v_new_payment_status,
        'totalPaid', v_total_paid
    );
END;
$$;

-- Revoke public execution
REVOKE ALL ON FUNCTION public.rpc_record_payment_secure(TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_record_payment_secure(TEXT, NUMERIC, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_record_payment_secure(TEXT, NUMERIC, TEXT, TEXT) FROM service_role;

-- Grant execution only to authenticated users
GRANT EXECUTE ON FUNCTION public.rpc_record_payment_secure(TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
