import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const statements = [
  "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role",
  "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role",
  "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role",
  "GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role",
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role",
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role",
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role"
];

async function run() {
  for (const sql of statements) {
    console.log("Executing:", sql);
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("All permissions granted successfully!");
}

run()
  .catch((err) => console.error("Error granting permissions:", err))
  .finally(() => prisma.$disconnect());
