-- Phase 5: Payment Proof Storage Security
-- Implements tenant-scoped storage and RLS for payment proofs

-- Create storage bucket for payment proofs if not exists
-- This bucket will store payment proof files (JPG, PNG, PDF)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'payment-proofs'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('payment-proofs', 'payment-proofs', false);
  END IF;
END $$;

-- Make sure invoices bucket exists (for fallback/legacy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'invoices'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('invoices', 'invoices', false);
  END IF;
END $$;

-- Storage Policies for payment-proofs bucket
-- Only authenticated users can interact with payment proofs
-- Each user can only access their own tenant's payment proofs

-- Allow authenticated users to upload files to payment-proofs bucket
-- Tenant isolation: only allow upload if tenantId in path matches user's tenantId
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
      AND split_part(name, '/', 2) = u.tenant_text
    )
  );

-- Allow authenticated users to select (view) payment proofs
-- Tenant isolation: users can only access payment proofs from their own tenant
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
      AND split_part(name, '/', 2) = u.tenant_text
    )
  );

-- Allow specific roles to delete payment proofs
-- Role-based + tenant isolation: only ACCOUNTS_TEAM, ACCOUNTANT, WAREHOUSE_OWNER, PLATFORM_ADMIN may delete
-- AND only from their own tenant
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
      AND split_part(name, '/', 2) = u.tenant_text
    )
  );

-- Storage Policies for invoices bucket (for legacy/backup)
-- Same tenant isolation pattern as payment-proofs

-- Allow authenticated users to upload invoice files
-- Tenant isolation: only allow upload if tenantId in path matches user's tenantId
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
      AND split_part(name, '/', 2) = u.tenant_text
    )
  );

-- Allow authenticated users to select (view) invoices
-- Tenant isolation: users can only access invoices from their own tenant
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
      AND split_part(name, '/', 2) = u.tenant_text
    )
  );

-- Allow specific roles to delete invoice files
-- Role-based + tenant isolation: only ACCOUNTS_TEAM, ACCOUNTANT, WAREHOUSE_OWNER, PLATFORM_ADMIN may delete
-- AND only from their own tenant
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
      AND split_part(name, '/', 2) = u.tenant_text
    )
  );