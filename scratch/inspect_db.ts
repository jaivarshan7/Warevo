import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`
    SELECT enum_range(NULL::"Role");
  `;
  console.log("PostgreSQL enum Role values:", result);

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, tenantId: true }
  });
  console.log("All DB users:");
  console.table(users);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
