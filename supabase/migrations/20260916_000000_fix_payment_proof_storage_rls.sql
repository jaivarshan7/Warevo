-- Fix Storage RLS Path Index for Payment Proofs and Invoices
-- Corrects tenant extraction from storage path
--
-- ISSUE: The storage path format is {tenantId}/{invoiceId}/{paymentId}/{filename}
-- but policies were using split_part(name, '/', 2) which extracts {invoiceId}
-- instead of {tenantId}.
--
-- FIX: Change split_part(name, '/', 2) to split_part(name, '/', 1)
-- to correctly extract tenantId from the first path segment.

-- ============================================================================
-- PAYMENT-PROOFS BUCKET POLICIES
-- ============================================================================

-- Drop and recreate INSERT policy for payment-proofs
DROP POLICY IF EXISTS "Allow authenticated upload to payment-proofs" ON storage.objects;
CREATE POLICY "Allow authenticated upload to payment-proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM (
        SELECT "supabaseUserId", "tenantId"::text AS tenant_text
        FROM public."User"
        WHERE "tenantId" IS NOT NULL
      ) u
      WHERE u."supabaseUserId" = auth.uid()::text::text
      AND split_part(name, '/', 1) = u.tenant_text
    )
  );

-- Drop and recreate SELECT policy for payment-proofs
DROP POLICY IF EXISTS "Allow authenticated select from payment-proofs" ON storage.objects;
CREATE POLICY "Allow authenticated select from payment-proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1
      FROM (
        SELECT "supabaseUserId", "tenantId"::text AS tenant_text
        FROM public."User"
        WHERE "tenantId" IS NOT NULL
      ) u
      WHERE u."supabaseUserId" = auth.uid()::text
      AND split_part(name, '/', 1) = u.tenant_text
    )
  );

-- Drop and recreate DELETE policy for payment-proofs
DROP POLICY IF EXISTS "Allow authenticated delete from payment-proofs" ON storage.objects;
CREATE POLICY "Allow authenticated delete from payment-proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1
      FROM (
        SELECT "id", "supabaseUserId", "tenantId"::text AS tenant_text, "role"
        FROM public."User"
        WHERE "tenantId" IS NOT NULL
      ) u
      WHERE u."supabaseUserId" = auth.uid()::text
      AND u."role" IN ('ACCOUNTS_TEAM', 'ACCOUNTANT', 'WAREHOUSE_OWNER', 'PLATFORM_ADMIN')
      AND split_part(name, '/', 1) = u.tenant_text
    )
  );

-- ============================================================================
-- INVOICES BUCKET POLICIES
-- ============================================================================

-- Drop and recreate INSERT policy for invoices
DROP POLICY IF EXISTS "Allow authenticated upload to invoices" ON storage.objects;
CREATE POLICY "Allow authenticated upload to invoices"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoices'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM (
        SELECT "supabaseUserId", "tenantId"::text AS tenant_text
        FROM public."User"
        WHERE "tenantId" IS NOT NULL
      ) u
      WHERE u."supabaseUserId" = auth.uid()::text
      AND split_part(name, '/', 1) = u.tenant_text
    )
  );

-- Drop and recreate SELECT policy for invoices
DROP POLICY IF EXISTS "Allow authenticated select from invoices" ON storage.objects;
CREATE POLICY "Allow authenticated select from invoices"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoices'
    AND EXISTS (
      SELECT 1
      FROM (
        SELECT "supabaseUserId", "tenantId"::text AS tenant_text
        FROM public."User"
        WHERE "tenantId" IS NOT NULL
      ) u
      WHERE u."supabaseUserId" = auth.uid()::text
      AND split_part(name, '/', 1) = u.tenant_text
    )
  );

-- Drop and recreate DELETE policy for invoices
DROP POLICY IF EXISTS "Allow authenticated delete from invoices" ON storage.objects;
CREATE POLICY "Allow authenticated delete from invoices"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoices'
    AND EXISTS (
      SELECT 1
      FROM (
        SELECT "id", "supabaseUserId", "tenantId"::text AS tenant_text, "role"
        FROM public."User"
        WHERE "tenantId" IS NOT NULL
      ) u
      WHERE u."supabaseUserId" = auth.uid()::text
      AND u."role" IN ('ACCOUNTS_TEAM', 'ACCOUNTANT', 'WAREHOUSE_OWNER', 'PLATFORM_ADMIN')
      AND split_part(name, '/', 1) = u.tenant_text
    )
  );