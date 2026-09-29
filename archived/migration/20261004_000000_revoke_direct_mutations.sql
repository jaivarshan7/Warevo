-- ============================================================================
-- Migration: 20261004_000000_revoke_direct_mutations.sql
-- Description: Phase 6B - Revoke Direct Mutations on Protected Business Entities
--
-- Enforces that business mutations MUST occur through dedicated secure RPCs:
--   - Order: direct INSERT, UPDATE, DELETE blocked (use rpc_create_order_with_invoice,
--     rpc_transition_order, rpc_submit_verification)
--   - OrderItem: direct INSERT, UPDATE, DELETE blocked
--   - InvoiceItem: direct INSERT, UPDATE, DELETE blocked
--   - Notification: direct INSERT, DELETE blocked (system creates notifications via RPCs)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Order direct mutation blocking
-- ----------------------------------------------------------------------------
CREATE POLICY "deny_direct_insert_order"
ON public."Order"
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny_direct_update_order"
ON public."Order"
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny_direct_delete_order"
ON public."Order"
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);


-- ----------------------------------------------------------------------------
-- 2. OrderItem direct mutation blocking
-- ----------------------------------------------------------------------------
CREATE POLICY "deny_direct_insert_order_item"
ON public."OrderItem"
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny_direct_update_order_item"
ON public."OrderItem"
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny_direct_delete_order_item"
ON public."OrderItem"
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);


-- ----------------------------------------------------------------------------
-- 3. InvoiceItem direct mutation blocking
-- ----------------------------------------------------------------------------
ALTER TABLE public."InvoiceItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_item_select_policy"
ON public."InvoiceItem"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."Invoice" i
        WHERE i."id" = "InvoiceItem"."invoiceId"
          AND public.can_read_invoice(i."tenantId", i."clientId")
    )
);

CREATE POLICY "deny_direct_insert_invoice_item"
ON public."InvoiceItem"
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny_direct_update_invoice_item"
ON public."InvoiceItem"
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny_direct_delete_invoice_item"
ON public."InvoiceItem"
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);


-- ----------------------------------------------------------------------------
-- 4. Notification direct insertion & deletion blocking
-- ----------------------------------------------------------------------------
CREATE POLICY "deny_direct_insert_notification"
ON public."Notification"
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny_direct_delete_notification"
ON public."Notification"
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);
