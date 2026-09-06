import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tables = [
    "Tenant",
    "Warehouse",
    "User",
    "Client",
    "CompanyGroup",
    "WarehouseLocation",
    "Category",
    "Product",
    "Order",
    "OrderItem",
    "Notification",
    "AuditLog"
  ];

  for (const tbl of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${tbl}" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text`
      );
      console.log(`Set DEFAULT gen_random_uuid() on ${tbl}.id`);
    } catch (e: any) {
      console.warn(`Could not set default on ${tbl}.id:`, e.message);
    }

    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${tbl}" ALTER COLUMN "updatedAt" SET DEFAULT NOW()`
      );
      console.log(`Set DEFAULT NOW() on ${tbl}.updatedAt`);
    } catch (e: any) {
      // some tables might not have updatedAt
    }
  }
}

main().finally(() => prisma.$disconnect());
