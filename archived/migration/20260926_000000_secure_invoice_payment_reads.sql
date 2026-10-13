-- ============================================================================
-- Migration: 20260926_000000_secure_invoice_payment_reads.sql
-- Description: Phase 3 - Database-Level Read Isolation for Invoice & Payment
--
-- Creates SECURITY DEFINER helper functions that enforce:
--   - Tenant boundary isolation
--   - Role-based access (staff roles see all within tenant)
--   - Client/CompanyGroup visibility for CLIENT and CLIENT_ACCOUNTANT
--   - PLATFORM_ADMIN cross-tenant access
--   - Denial for WAREHOUSE_STAFF, inactive users, anonymous
--
-- Replaces legacy "Allow all for anon and authenticated" SELECT policies
-- with role-aware RLS policies.
--
-- Does NOT modify:
--   - resolve_current_actor()
--   - rpc_record_payment_secure()
--   - rpc_attach_payment_proof()
--   - rpc_cancel_payment_record()
--   - rpc_create_order_with_invoice()
--   - Phase 2B restrictive mutation denial policies
--   - RLS on any other table
-- ============================================================================

-- ============================================================================
-- 1. Helper Function: can_read_invoice
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

    -- 3. User not found or inactive → denied
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    IF v_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    -- 4. PLATFORM_ADMIN → platform-wide access
    IF v_role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- 5. Cross-tenant → denied
    IF v_tenant_id IS NULL OR v_tenant_id != p_invoice_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- 6. Tenant staff roles → full tenant access
    IF v_role IN ('WAREHOUSE_OWNER', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_MODERATOR') THEN
        RETURN TRUE;
    END IF;

    -- 7. Client roles → client/company-group scoped access
    IF v_role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
        -- Lookup the Client record linked to this user
        SELECT
            c."id",
            c."companyGroupId"
        INTO
            v_client_id,
            v_company_group_id
        FROM public."Client" c
        WHERE c."userId" = v_user_id;

        -- No linked Client record → denied
        IF NOT FOUND THEN
            RETURN FALSE;
        END IF;

        -- Direct client match
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

        -- Client role but no matching client or group → denied
        RETURN FALSE;
    END IF;

    -- 8. Any other role (e.g. WAREHOUSE_STAFF) → denied
    RETURN FALSE;
END;
$$;

-- Privileges: authenticated only
REVOKE ALL ON FUNCTION public.can_read_invoice(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_invoice(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.can_read_invoice(TEXT, TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.can_read_invoice(TEXT, TEXT) TO authenticated;


-- ============================================================================
-- 2. Helper Function: can_read_payment
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_read_payment(
    p_payment_tenant_id TEXT,
    p_payment_invoice_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_invoice_tenant_id TEXT;
    v_invoice_client_id TEXT;
BEGIN
    -- 1. Reject unauthenticated callers
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Lookup the associated Invoice
    SELECT
        inv."tenantId",
        inv."clientId"
    INTO
        v_invoice_tenant_id,
        v_invoice_client_id
    FROM public."Invoice" inv
    WHERE inv."id" = p_payment_invoice_id;

    -- Invoice not found → denied
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 3. Consistency check: payment tenant must match invoice tenant
    IF p_payment_tenant_id != v_invoice_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- 4. Delegate to can_read_invoice
    RETURN public.can_read_invoice(v_invoice_tenant_id, v_invoice_client_id);
END;
$$;

-- Privileges: authenticated only
REVOKE ALL ON FUNCTION public.can_read_payment(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_payment(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.can_read_payment(TEXT, TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.can_read_payment(TEXT, TEXT) TO authenticated;


-- ============================================================================
-- 3. Replace legacy SELECT policies on Invoice
-- ============================================================================

-- Drop the legacy permissive "Allow all" policy on Invoice
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Invoice";

-- Create role-aware read policy
CREATE POLICY "Allow read on Invoice" ON public."Invoice"
FOR SELECT TO authenticated
USING (public.can_read_invoice("tenantId", "clientId"));


-- ============================================================================
-- 4. Replace legacy SELECT policies on Payment
-- ============================================================================

-- Drop the legacy permissive "Allow all" policy on Payment
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Payment";

-- Create role-aware read policy
CREATE POLICY "Allow read on Payment" ON public."Payment"
FOR SELECT TO authenticated
USING (public.can_read_payment("tenantId", "invoiceId"));
