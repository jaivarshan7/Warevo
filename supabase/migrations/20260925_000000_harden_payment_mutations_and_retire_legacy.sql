-- ============================================================================
-- Migration: 20260925_000000_harden_payment_mutations_and_retire_legacy.sql
-- Description: Phase 2B - Retire legacy rpc_record_payment and enforce direct
--              mutation denial on Payment & Invoice while leaving SELECT untouched
-- ============================================================================

-- 1. Safely drop legacy rpc_record_payment (0 callers remain in application)
DROP FUNCTION IF EXISTS public.rpc_record_payment(TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, "Role");

-- 2. Revoke table-level mutation privileges (INSERT, UPDATE, DELETE) from anon and authenticated
REVOKE INSERT, UPDATE, DELETE ON TABLE public."Payment" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public."Invoice" FROM anon, authenticated;

-- Ensure postgres (table owner / SECURITY DEFINER) and service_role retain necessary access
GRANT ALL ON TABLE public."Payment" TO postgres, service_role;
GRANT ALL ON TABLE public."Invoice" TO postgres, service_role;

-- 3. Add RESTRICTIVE RLS policies to unconditionally DENY direct client INSERT, UPDATE, DELETE
-- Note: Restrictive policies are combined using AND with existing permissive policies.
-- By enforcing false on INSERT/UPDATE/DELETE, direct mutations from anon/authenticated are strictly denied.
-- Existing SELECT behavior is left completely untouched (no restrictive policy on SELECT).

DROP POLICY IF EXISTS "Deny direct insert on Payment" ON public."Payment";
CREATE POLICY "Deny direct insert on Payment" ON public."Payment"
AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct update on Payment" ON public."Payment";
CREATE POLICY "Deny direct update on Payment" ON public."Payment"
AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct delete on Payment" ON public."Payment";
CREATE POLICY "Deny direct delete on Payment" ON public."Payment"
AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "Deny direct insert on Invoice" ON public."Invoice";
CREATE POLICY "Deny direct insert on Invoice" ON public."Invoice"
AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct update on Invoice" ON public."Invoice";
CREATE POLICY "Deny direct update on Invoice" ON public."Invoice"
AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct delete on Invoice" ON public."Invoice";
CREATE POLICY "Deny direct delete on Invoice" ON public."Invoice"
AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
