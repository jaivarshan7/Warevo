import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function run() {
  const sqlPath = path.join(process.cwd(), "supabase", "migrations", "20260904_warehouse_os_core.sql");
  const rawSql = fs.readFileSync(sqlPath, "utf-8");

  // Split by top-level delimiter comments
  const chunks = rawSql
    .split(/\n(?=-- \d+\.|\nGRANT )/)
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Found ${chunks.length} SQL chunks to execute.`);

  for (const chunk of chunks) {
    // If it contains multiple grants on separate lines, split them
    if (chunk.startsWith("GRANT") || chunk.includes("GRANT EXECUTE")) {
      const grants = chunk
        .split(";")
        .map((g) => g.trim())
        .filter((g) => g.startsWith("GRANT"));
      for (const grant of grants) {
        console.log("Executing grant:", grant.substring(0, 60), "...");
        await prisma.$executeRawUnsafe(grant);
      }
    } else {
      console.log("Executing function block...");
      await prisma.$executeRawUnsafe(chunk);
    }
  }

  console.log("All Supabase RPC functions and grants deployed successfully!");
}

run()
  .catch((e) => console.error("Migration error:", e))
  .finally(() => prisma.$disconnect());
