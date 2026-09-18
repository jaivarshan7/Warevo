-- ============================================================================
-- Migration: 20261003_000000_enforce_immutability.sql
-- Description: Phase 6B - Enforce Immutability on History, Movement, and Audit Logs
--
-- Applies RESTRICTIVE policies denying direct UPDATE and DELETE on:
--   - AuditLog
--   - OrderStatusHistory
--   - InventoryMovement
--   - VerificationResponse (DELETE denied; UPDATE denied once VERIFIED)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AuditLog Immutability
-- ----------------------------------------------------------------------------
CREATE POLICY "deny_direct_update_audit_log"
ON public."AuditLog"
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny_direct_delete_audit_log"
ON public."AuditLog"
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);


-- ----------------------------------------------------------------------------
-- 2. OrderStatusHistory Immutability
-- ----------------------------------------------------------------------------
ALTER TABLE public."OrderStatusHistory" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_status_history_select_policy"
ON public."OrderStatusHistory"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."Order" o
        WHERE o."id" = "OrderStatusHistory"."orderId"
          AND public.can_access_tenant(o."tenantId")
          AND (
              public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
              OR public.can_access_client(o."clientId")
          )
    )
);

CREATE POLICY "deny_direct_update_order_status_history"
ON public."OrderStatusHistory"
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny_direct_delete_order_status_history"
ON public."OrderStatusHistory"
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);


-- ----------------------------------------------------------------------------
-- 3. InventoryMovement Immutability
-- ----------------------------------------------------------------------------
ALTER TABLE public."InventoryMovement" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_movement_select_policy"
ON public."InventoryMovement"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

-- Allow authenticated insert within own tenant (for initial catalog intake)
CREATE POLICY "inventory_movement_insert_policy"
ON public."InventoryMovement"
FOR INSERT
TO authenticated
WITH CHECK (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
);

CREATE POLICY "deny_direct_update_inventory_movement"
ON public."InventoryMovement"
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny_direct_delete_inventory_movement"
ON public."InventoryMovement"
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);


-- ----------------------------------------------------------------------------
-- 4. VerificationResponse Tampering Protection
-- ----------------------------------------------------------------------------
CREATE POLICY "deny_direct_delete_verification_response"
ON public."VerificationResponse"
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);

-- Direct update blocked once verified
CREATE POLICY "deny_direct_update_verified_response"
ON public."VerificationResponse"
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (
    "status" != 'VERIFIED'
)
WITH CHECK (
    "status" != 'VERIFIED'
);
