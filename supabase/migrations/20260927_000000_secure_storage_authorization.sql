-- ============================================================================
-- Migration: 20260927_000000_secure_storage_authorization.sql
-- Description: Phase 4B - Storage Security Remediation
--
-- Remediations:
--   1. Change `invoices` bucket from public to private (public = false).
--   2. Implement database-record verified SELECT authorization for `payment-proofs`
--      mirroring Phase 3 read isolation (verifying Payment, Invoice, Tenant,
--      Client, and CompanyGroup).
--   3. Tighten INSERT authorization for `payment-proofs` to active, authorized
--      payment roles, excluding WAREHOUSE_STAFF and unverified uploaders.
--   4. Tighten DELETE authorization for `payment-proofs` to active staff roles,
--      properly handling global PLATFORM_ADMIN.
--   5. Secure `invoices` storage object policies behind active, authenticated
--      tenant staff authorization.
--
-- Does NOT modify:
--   - resolve_current_actor()
--   - rpc_record_payment_secure()
--   - rpc_attach_payment_proof()
--   - rpc_cancel_payment_record()
--   - rpc_create_order_with_invoice()
--   - Phase 3 can_read_invoice() and can_read_payment()
--   - Phase 2B / Phase 3 RLS policies on tables
--   - Frontend application code
-- ============================================================================

-- ============================================================================
-- 1. Configure Buckets: Make `invoices` private
-- ============================================================================
UPDATE storage.buckets
SET public = false
WHERE id = 'invoices';


-- ============================================================================
-- 2. Helper: can_read_payment_proof_storage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_read_payment_proof_storage(
    p_object_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_path_tenant_id  TEXT;
    v_path_invoice_id TEXT;
    v_path_payment_id TEXT;
    v_pay_tenant_id   TEXT;
    v_pay_invoice_id  TEXT;
    v_inv_tenant_id   TEXT;
    v_inv_client_id   TEXT;
BEGIN
    -- 1. Must be authenticated
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Parse path segments: {tenantId}/{invoiceId}/{paymentId}/{filename}
    v_path_tenant_id  := split_part(p_object_name, '/', 1);
    v_path_invoice_id := split_part(p_object_name, '/', 2);
    v_path_payment_id := split_part(p_object_name, '/', 3);

    -- Path must have all 3 required parent segments
    IF v_path_tenant_id = '' OR v_path_invoice_id = '' OR v_path_payment_id = '' THEN
        RETURN FALSE;
    END IF;

    -- 3. Verify Payment exists and fetch its tenantId and invoiceId
    SELECT p."tenantId", p."invoiceId"
    INTO v_pay_tenant_id, v_pay_invoice_id
    FROM public."Payment" p
    WHERE p."id" = v_path_payment_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 4. Verify Payment consistency with path
    IF v_pay_tenant_id != v_path_tenant_id OR v_pay_invoice_id != v_path_invoice_id THEN
        RETURN FALSE;
    END IF;

    -- 5. Verify Invoice exists, matches path & payment tenantId, and fetch clientId
    SELECT inv."tenantId", inv."clientId"
    INTO v_inv_tenant_id, v_inv_client_id
    FROM public."Invoice" inv
    WHERE inv."id" = v_path_invoice_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_inv_tenant_id != v_path_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- 6. Authorize actor using Phase 3 can_read_invoice
    RETURN public.can_read_invoice(v_inv_tenant_id, v_inv_client_id);
END;
$$;

-- Restrict helper privileges
REVOKE ALL ON FUNCTION public.can_read_payment_proof_storage(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_payment_proof_storage(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.can_read_payment_proof_storage(TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.can_read_payment_proof_storage(TEXT) TO authenticated;


-- ============================================================================
-- 3. Helper: can_upload_payment_proof_storage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_upload_payment_proof_storage(
    p_object_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_tenant_id TEXT;
    v_user_role      TEXT;
    v_user_status    TEXT;
    v_path_tenant_id TEXT;
BEGIN
    -- 1. Must be authenticated
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Resolve actor
    SELECT u."tenantId", u."role"::TEXT, u."status"::TEXT
    INTO v_user_tenant_id, v_user_role, v_user_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    IF NOT FOUND OR v_user_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    -- 3. Authorized payment roles (WAREHOUSE_STAFF strictly excluded)
    IF v_user_role NOT IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_MODERATOR', 'CLIENT', 'CLIENT_ACCOUNTANT') THEN
        RETURN FALSE;
    END IF;

    -- 4. Path must have at least 4 segments: {tenantId}/{invoiceId}/{paymentId}/{filename}
    v_path_tenant_id := split_part(p_object_name, '/', 1);
    IF v_path_tenant_id = '' OR split_part(p_object_name, '/', 2) = '' OR split_part(p_object_name, '/', 3) = '' OR split_part(p_object_name, '/', 4) = '' THEN
        RETURN FALSE;
    END IF;

    -- 5. Tenant validation: PLATFORM_ADMIN can upload across tenants; others only own tenant
    IF v_user_role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    IF v_user_tenant_id IS NULL OR v_user_tenant_id != v_path_tenant_id THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- Restrict helper privileges
REVOKE ALL ON FUNCTION public.can_upload_payment_proof_storage(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_upload_payment_proof_storage(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.can_upload_payment_proof_storage(TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.can_upload_payment_proof_storage(TEXT) TO authenticated;


-- ============================================================================
-- 4. Helper: can_delete_payment_proof_storage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_delete_payment_proof_storage(
    p_object_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_tenant_id TEXT;
    v_user_role      TEXT;
    v_user_status    TEXT;
    v_path_tenant_id TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT u."tenantId", u."role"::TEXT, u."status"::TEXT
    INTO v_user_tenant_id, v_user_role, v_user_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    IF NOT FOUND OR v_user_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    -- Only staff management roles allowed to delete payment proofs
    IF v_user_role NOT IN ('ACCOUNTS_TEAM', 'ACCOUNTANT', 'WAREHOUSE_OWNER', 'PLATFORM_ADMIN') THEN
        RETURN FALSE;
    END IF;

    IF v_user_role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    v_path_tenant_id := split_part(p_object_name, '/', 1);
    IF v_user_tenant_id IS NULL OR v_user_tenant_id != v_path_tenant_id THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- Restrict helper privileges
REVOKE ALL ON FUNCTION public.can_delete_payment_proof_storage(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_delete_payment_proof_storage(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.can_delete_payment_proof_storage(TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.can_delete_payment_proof_storage(TEXT) TO authenticated;


-- ============================================================================
-- 5. Helper: can_read_invoice_storage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_read_invoice_storage(
    p_object_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_tenant_id TEXT;
    v_user_role      TEXT;
    v_user_status    TEXT;
    v_path_tenant_id TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT u."tenantId", u."role"::TEXT, u."status"::TEXT
    INTO v_user_tenant_id, v_user_role, v_user_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    IF NOT FOUND OR v_user_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    IF v_user_role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    v_path_tenant_id := split_part(p_object_name, '/', 1);
    IF v_user_role IN ('WAREHOUSE_OWNER', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_MODERATOR') THEN
        RETURN (v_user_tenant_id IS NOT NULL AND v_user_tenant_id = v_path_tenant_id);
    END IF;

    RETURN FALSE;
END;
$$;

-- Restrict helper privileges
REVOKE ALL ON FUNCTION public.can_read_invoice_storage(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_invoice_storage(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.can_read_invoice_storage(TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.can_read_invoice_storage(TEXT) TO authenticated;


-- ============================================================================
-- 6. Storage Policies: payment-proofs
-- ============================================================================

-- SELECT policy: verified against database records
DROP POLICY IF EXISTS "Allow authenticated select from payment-proofs" ON storage.objects;
CREATE POLICY "Allow authenticated select from payment-proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.can_read_payment_proof_storage(name)
  );

-- INSERT policy: restricted to active authorized payment upload roles
DROP POLICY IF EXISTS "Allow authenticated upload to payment-proofs" ON storage.objects;
CREATE POLICY "Allow authenticated upload to payment-proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
    AND public.can_upload_payment_proof_storage(name)
  );

-- DELETE policy: restricted to active staff roles with tenant matching
DROP POLICY IF EXISTS "Allow authenticated delete from payment-proofs" ON storage.objects;
CREATE POLICY "Allow authenticated delete from payment-proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.can_delete_payment_proof_storage(name)
  );


-- ============================================================================
-- 7. Storage Policies: invoices
-- ============================================================================

-- SELECT policy: authenticated staff only
DROP POLICY IF EXISTS "Allow authenticated select from invoices" ON storage.objects;
CREATE POLICY "Allow authenticated select from invoices"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoices'
    AND public.can_read_invoice_storage(name)
  );

-- INSERT policy: authenticated staff only
DROP POLICY IF EXISTS "Allow authenticated upload to invoices" ON storage.objects;
CREATE POLICY "Allow authenticated upload to invoices"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoices'
    AND auth.role() = 'authenticated'
    AND public.can_read_invoice_storage(name)
  );

-- DELETE policy: authenticated staff only
DROP POLICY IF EXISTS "Allow authenticated delete from invoices" ON storage.objects;
CREATE POLICY "Allow authenticated delete from invoices"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoices'
    AND public.can_delete_payment_proof_storage(name)
  );
