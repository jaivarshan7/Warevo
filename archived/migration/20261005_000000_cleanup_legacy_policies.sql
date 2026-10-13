-- ============================================================================
-- Migration: 20261005_000000_cleanup_legacy_policies.sql
-- Description: Phase 6B - Cleanup Insecure Broad Legacy Policies
--
-- Drops the legacy permissive policy "Allow all for anon and authenticated"
-- across all tables where it was originally introduced in 20260905_enable_rls.sql.
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."AuditLog";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Category";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Client";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."CompanyGroup";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."DeliveryVerification";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."DeliveryVerificationItem";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Document";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."EWayBill";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."ImportedInvoice";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."ImportedInvoiceItem";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Inventory";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."InventoryMovement";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."InvoiceItem";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Notification";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Order";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."OrderItem";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."OrderStatusHistory";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."PlatformSetting";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Product";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Tenant";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."User";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."VerificationChecklist";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."VerificationItem";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."VerificationResponse";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."Warehouse";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."WarehouseLocation";
DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."WarehouseSetting";
