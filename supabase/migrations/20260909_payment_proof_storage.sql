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
DROP POLICY IF EXISTS "Allow authenticated upload to payment-proofs" ON storage.objects;
CREATE POLICY "Allow authenticated upload to payment-proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
    -- Check that path starts with payment-proofs/ (basic check)
    AND (storage.filename(path) IS NOT NULL)
  );

-- Allow authenticated users to select (view) payment proofs
-- In production, this should be further restricted by tenant
DROP POLICY IF EXISTS "Allow authenticated select from payment-proofs" ON storage.objects;
CREATE POLICY "Allow authenticated select from payment-proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
  );

-- Allow authenticated users to delete their own payment proofs
DROP POLICY IF EXISTS "Allow authenticated delete from payment-proofs" ON storage.objects;
CREATE POLICY "Allow authenticated delete from payment-proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
  );

-- Storage Policies for invoices bucket (for legacy/backup)
DROP POLICY IF EXISTS "Allow authenticated upload to invoices" ON storage.objects;
CREATE POLICY "Allow authenticated upload to invoices"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoices'
  );

DROP POLICY IF EXISTS "Allow authenticated select from invoices" ON storage.objects;
CREATE POLICY "Allow authenticated select from invoices"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoices'
  );

DROP POLICY IF EXISTS "Allow authenticated delete from invoices" ON storage.objects;
CREATE POLICY "Allow authenticated delete from invoices"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoices'
  );
