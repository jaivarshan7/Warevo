import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tables = [
  "_prisma_migrations",
  "Tenant",
  "User",
  "Warehouse",
  "WarehouseLocation",
  "Category",
  "Product",
  "Client",
  "CompanyGroup",
  "Order",
  "OrderItem",
  "OrderStatusHistory",
  "Inventory",
  "InventoryMovement",
  "Invoice",
  "InvoiceItem",
  "Payment",
  "Notification",
  "AuditLog",
  "DeliveryVerification",
  "DeliveryVerificationItem",
  "VerificationChecklist",
  "VerificationItem",
  "VerificationResponse",
  "WarehouseSetting",
  "PlatformSetting",
  "Document",
  "EWayBill",
  "ImportedInvoice",
  "ImportedInvoiceItem"
];

async function run() {
  console.log("Enabling RLS on all public tables...");

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;`);
      console.log(`Enabled RLS on ${table}`);

      if (table === "_prisma_migrations") {
        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Deny public on prisma_migrations" ON public."_prisma_migrations";`);
        await prisma.$executeRawUnsafe(`CREATE POLICY "Deny public on prisma_migrations" ON public."_prisma_migrations" FOR ALL TO service_role USING (true);`);
      } else {
        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public."${table}";`);
        await prisma.$executeRawUnsafe(`CREATE POLICY "Allow all for anon and authenticated" ON public."${table}" FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);`);
      }
    } catch (err: any) {
      console.warn(`Warning on ${table}:`, err.message);
    }
  }

  const results: any = await prisma.$queryRawUnsafe(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);

  const enabled = results.filter((t: any) => t.rowsecurity).length;
  console.log(`\nSuccess: RLS is now enabled on ${enabled} of ${results.length} tables!`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
