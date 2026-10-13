-- Enable Row-Level Security (RLS) on all public tables in Warevo

DO $$ 
DECLARE
  t text;
  tables text[] := ARRAY[
    '_prisma_migrations',
    'Tenant',
    'User',
    'Warehouse',
    'WarehouseLocation',
    'Category',
    'Product',
    'Client',
    'CompanyGroup',
    'Order',
    'OrderItem',
    'OrderStatusHistory',
    'Inventory',
    'InventoryMovement',
    'Invoice',
    'InvoiceItem',
    'Payment',
    'Notification',
    'AuditLog',
    'DeliveryVerification',
    'DeliveryVerificationItem',
    'VerificationChecklist',
    'VerificationItem',
    'VerificationResponse',
    'WarehouseSetting',
    'PlatformSetting',
    'Document',
    'EWayBill',
    'ImportedInvoice',
    'ImportedInvoiceItem'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Policy for Prisma migrations (internal, accessible only by postgres / service_role)
DROP POLICY IF EXISTS "Deny public on prisma_migrations" ON public._prisma_migrations;
CREATE POLICY "Deny public on prisma_migrations" ON public._prisma_migrations FOR ALL TO service_role USING (true);

-- Create working policies for Warevo application tables
DO $$ 
DECLARE
  t text;
  tables text[] := ARRAY[
    'Tenant',
    'User',
    'Warehouse',
    'WarehouseLocation',
    'Category',
    'Product',
    'Client',
    'CompanyGroup',
    'Order',
    'OrderItem',
    'OrderStatusHistory',
    'Inventory',
    'InventoryMovement',
    'Invoice',
    'InvoiceItem',
    'Payment',
    'Notification',
    'AuditLog',
    'DeliveryVerification',
    'DeliveryVerificationItem',
    'VerificationChecklist',
    'VerificationItem',
    'VerificationResponse',
    'WarehouseSetting',
    'PlatformSetting',
    'Document',
    'EWayBill',
    'ImportedInvoice',
    'ImportedInvoiceItem'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop existing if any
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Allow all for anon and authenticated', t);
    -- Add permissive policy so frontend and RPC operations function properly
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);', 'Allow all for anon and authenticated', t);
  END LOOP;
END $$;
