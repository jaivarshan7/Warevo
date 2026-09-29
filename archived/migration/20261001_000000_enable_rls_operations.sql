-- ============================================================================
-- Migration: 20261001_000000_enable_rls_operations.sql
-- Description: Phase 6B - Operational Tables RLS
--
-- Tables secured:
--   - Category, Product, Inventory
--   - Order, OrderItem
--   - VerificationResponse
--   - DeliveryVerification, DeliveryVerificationItem, VerificationChecklist, VerificationItem
--   - ImportedInvoice, ImportedInvoiceItem, EWayBill, Document
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Category, Product, Inventory
-- ----------------------------------------------------------------------------
ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Inventory" ENABLE ROW LEVEL SECURITY;

-- Category
CREATE POLICY "category_select_policy"
ON public."Category"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "category_staff_mutation_policy"
ON public."Category"
FOR ALL
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
)
WITH CHECK (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
);

-- Product
CREATE POLICY "product_select_policy"
ON public."Product"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "product_staff_mutation_policy"
ON public."Product"
FOR ALL
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
)
WITH CHECK (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
);

-- Inventory
CREATE POLICY "inventory_select_policy"
ON public."Inventory"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "inventory_staff_mutation_policy"
ON public."Inventory"
FOR ALL
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
)
WITH CHECK (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
);


-- ----------------------------------------------------------------------------
-- 2. Order & OrderItem
-- ----------------------------------------------------------------------------
ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItem" ENABLE ROW LEVEL SECURITY;

-- Order SELECT: Staff in tenant OR client authorized for this order's client
CREATE POLICY "order_select_policy"
ON public."Order"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND (
        public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
        OR public.can_access_client("clientId")
    )
);

-- OrderItem SELECT: Access granted if parent order is readable
CREATE POLICY "order_item_select_policy"
ON public."OrderItem"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."Order" o
        WHERE o."id" = "OrderItem"."orderId"
          AND public.can_access_tenant(o."tenantId")
          AND (
              public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
              OR public.can_access_client(o."clientId")
          )
    )
);


-- ----------------------------------------------------------------------------
-- 3. VerificationResponse
-- ----------------------------------------------------------------------------
ALTER TABLE public."VerificationResponse" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verification_response_select_policy"
ON public."VerificationResponse"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND (
        public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
        OR public.can_access_client("clientId")
    )
);


-- ----------------------------------------------------------------------------
-- 4. DeliveryVerification, DeliveryVerificationItem, VerificationChecklist, VerificationItem
-- ----------------------------------------------------------------------------
ALTER TABLE public."DeliveryVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DeliveryVerificationItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VerificationChecklist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VerificationItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_verification_select_policy"
ON public."DeliveryVerification"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "delivery_verification_item_select_policy"
ON public."DeliveryVerificationItem"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."DeliveryVerification" dv
        WHERE dv."id" = "DeliveryVerificationItem"."verificationId"
          AND public.can_access_tenant(dv."tenantId")
    )
);

CREATE POLICY "verification_checklist_select_policy"
ON public."VerificationChecklist"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "verification_item_select_policy"
ON public."VerificationItem"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."VerificationChecklist" vc
        WHERE vc."id" = "VerificationItem"."checklistId"
          AND public.can_access_tenant(vc."tenantId")
    )
);


-- ----------------------------------------------------------------------------
-- 5. ImportedInvoice, ImportedInvoiceItem, EWayBill, Document
-- ----------------------------------------------------------------------------
ALTER TABLE public."ImportedInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImportedInvoiceItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EWayBill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Document" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imported_invoice_select_policy"
ON public."ImportedInvoice"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "imported_invoice_item_select_policy"
ON public."ImportedInvoiceItem"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."ImportedInvoice" ii
        WHERE ii."id" = "ImportedInvoiceItem"."importedInvoiceId"
          AND public.can_access_tenant(ii."tenantId")
    )
);

CREATE POLICY "eway_bill_select_policy"
ON public."EWayBill"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "document_select_policy"
ON public."Document"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);
