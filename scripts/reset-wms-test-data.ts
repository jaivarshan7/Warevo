import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

interface ResetConfig {
  adminEmail: string;
  isDryRun: boolean;
  isConfirmed: boolean;
}

const EXPECTED_PROJECT_REF = "rglumbheyypdanfpmuef";
const DISALLOWED_BRANCHES = ["main", "master", "prod", "production"];

function parseArgs(): ResetConfig {
  const args = process.argv.slice(2);
  let adminEmail = "";
  let isDryRun = true;
  let isConfirmed = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      isDryRun = true;
    } else if (arg === "--confirm") {
      isConfirmed = true;
      isDryRun = false;
    } else if (arg === "--admin-email" && i + 1 < args.length) {
      adminEmail = args[i + 1];
      i++;
    }
  }

  return { adminEmail, isDryRun, isConfirmed };
}

async function verifyEnvironment(): Promise<{ projectRef: string; branch: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  if (!supabaseUrl) {
    throw new Error("Supabase URL environment variable is missing.");
  }

  const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = match ? match[1] : "";

  if (projectRef !== EXPECTED_PROJECT_REF) {
    throw new Error(`Project reference mismatch: expected '${EXPECTED_PROJECT_REF}', found '${projectRef}'. Aborting for safety.`);
  }

  // Check git branch
  let branch = "unknown";
  try {
    const { execSync } = require("child_process");
    branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
  } catch (e) {
    // If git not available, fail safe if in prod
  }

  if (DISALLOWED_BRANCHES.includes(branch.toLowerCase())) {
    throw new Error(`Refusing to run reset on protected production branch '${branch}'. Aborting.`);
  }

  return { projectRef, branch };
}

export async function runResetScript(config: ResetConfig) {
  const { projectRef, branch } = await verifyEnvironment();
  console.log(`Environment: staging/dev (Branch: ${branch}, Supabase Ref: ${projectRef})`);

  const prisma = new PrismaClient();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Check PLATFORM_ADMIN candidates
    const adminCandidates = await prisma.user.findMany({
      where: { role: "PLATFORM_ADMIN" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        tenantId: true,
        supabaseUserId: true
      }
    });

    if (adminCandidates.length === 0) {
      throw new Error("No PLATFORM_ADMIN found in database. Aborting.");
    }

    let preservedAdmin = adminCandidates[0];
    if (config.adminEmail) {
      const match = adminCandidates.find(
        (a) => a.email?.toLowerCase() === config.adminEmail.toLowerCase()
      );
      if (!match) {
        throw new Error(`Specified admin email '${config.adminEmail}' not found among PLATFORM_ADMIN users.`);
      }
      preservedAdmin = match;
    } else if (adminCandidates.length > 1) {
      console.log("\n[WARNING] Multiple PLATFORM_ADMIN users detected:");
      for (const a of adminCandidates) {
        console.log(`  - ${a.name} <${a.email}> (User ID: ${a.id}, Supabase Auth ID: ${a.supabaseUserId})`);
      }
      throw new Error("Multiple PLATFORM_ADMIN candidates found. Please supply --admin-email <email>.");
    }

    if (preservedAdmin.status !== "ACTIVE") {
      throw new Error(`Preserved admin '${preservedAdmin.email}' is not in ACTIVE status (${preservedAdmin.status}). Aborting.`);
    }

    if (!preservedAdmin.supabaseUserId) {
      throw new Error(`Preserved admin '${preservedAdmin.email}' has no supabaseUserId linked. Aborting.`);
    }

    // Verify Auth user exists
    const { data: authUserRes, error: authErr } = await supabase.auth.admin.getUserById(
      preservedAdmin.supabaseUserId
    );
    if (authErr || !authUserRes?.user) {
      throw new Error(`Preserved admin has no matching Supabase Auth user (Auth ID: ${preservedAdmin.supabaseUserId}). Aborting.`);
    }

    console.log(`\nADMIN TO PRESERVE:`);
    console.log(`  Name: ${preservedAdmin.name}`);
    console.log(`  Email: ${preservedAdmin.email}`);
    console.log(`  WMS User ID: ${preservedAdmin.id}`);
    console.log(`  Supabase Auth ID: ${preservedAdmin.supabaseUserId}`);
    console.log(`  Tenant ID: ${preservedAdmin.tenantId || "null (Platform Global)"}`);

    // Inventory counts
    const counts: Record<string, { current: number; willDelete: number; willRemain: number }> = {};
    const tablesToClean = [
      "EmailLog",
      "Notification",
      "AuditLog",
      "Payment",
      "InvoiceItem",
      "DeliveryVerificationItem",
      "DeliveryVerification",
      "EWayBill",
      "ImportedInvoiceItem",
      "ImportedInvoice",
      "Document",
      "Invoice",
      "VerificationResponse",
      "VerificationItem",
      "VerificationChecklist",
      "OrderStatusHistory",
      "OrderItem",
      "InventoryMovement",
      "Order",
      "Inventory",
      "WarehouseLocation",
      "Product",
      "Category",
      "ClientEmployee",
      "Client",
      "CompanyGroup",
      "WarehouseSetting",
      "Warehouse",
      "NotificationSettings",
      "User",
      "Tenant"
    ];

    for (const table of tablesToClean) {
      const res: Array<{ count: bigint }> = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM public."${table}";`
      );
      const current = Number(res[0].count);
      let willRemain = 0;
      if (table === "User") {
        willRemain = 1;
      } else if (table === "Tenant") {
        willRemain = preservedAdmin.tenantId ? 1 : 0;
      } else if (table === "WarehouseSetting" || table === "NotificationSettings") {
        willRemain = preservedAdmin.tenantId ? 1 : 0;
      }
      const willDelete = Math.max(0, current - willRemain);
      counts[table] = { current, willDelete, willRemain };
    }

    console.log("\n============================================================");
    console.log("DRY RUN TABLE INVENTORY");
    console.log("============================================================");
    console.log(
      `${"TABLE".padEnd(28)} ${"CURRENT".padStart(10)} ${"WILL DELETE".padStart(12)} ${"WILL REMAIN".padStart(12)}`
    );
    console.log("-".repeat(66));
    for (const [table, c] of Object.entries(counts)) {
      console.log(
        `${table.padEnd(28)} ${String(c.current).padStart(10)} ${String(c.willDelete).padStart(12)} ${String(c.willRemain).padStart(12)}`
      );
    }
    console.log("============================================================");

    // Storage inventory
    const { data: buckets } = await supabase.storage.listBuckets();
    const storageFilesToDelete: Array<{ bucket: string; path: string }> = [];

    for (const b of buckets || []) {
      const files = await listAllBucketFiles(supabase, b.name, "");
      for (const f of files) {
        storageFilesToDelete.push({ bucket: b.name, path: f });
      }
    }
    console.log(`\nStorage Objects: ${storageFilesToDelete.length} files to delete across ${buckets?.length || 0} buckets (Buckets preserved).`);

    // Auth users to delete
    const { data: allAuthUsers } = await supabase.auth.admin.listUsers();
    const authUsersToDelete = (allAuthUsers?.users || []).filter(
      (u) => u.id !== preservedAdmin.supabaseUserId
    );
    console.log(`Supabase Auth Users: ${authUsersToDelete.length} to delete, 1 to remain.`);

    if (config.isDryRun || !config.isConfirmed) {
      console.log("\n[DRY RUN ONLY] No changes were made. Pass --confirm with an authorized command to execute.");
      return;
    }

    console.log("\n============================================================");
    console.log("EXECUTING DESTRUCTIVE DATABASE RESET...");
    console.log("============================================================");

    // Execute database deletions in top-down transaction
    await prisma.$transaction(async (tx) => {
      // 1. Raw SQL tables or Prisma models in safe dependency order
      console.log("Deleting EmailLog...");
      await tx.$executeRawUnsafe(`DELETE FROM public."EmailLog";`);

      console.log("Deleting Notification...");
      await tx.$executeRawUnsafe(`DELETE FROM public."Notification";`);

      console.log("Deleting AuditLog...");
      await tx.$executeRawUnsafe(`DELETE FROM public."AuditLog";`);

      console.log("Deleting Payment...");
      await tx.$executeRawUnsafe(`DELETE FROM public."Payment";`);

      console.log("Deleting InvoiceItem...");
      await tx.$executeRawUnsafe(`DELETE FROM public."InvoiceItem";`);

      console.log("Deleting DeliveryVerificationItem...");
      await tx.$executeRawUnsafe(`DELETE FROM public."DeliveryVerificationItem";`);

      console.log("Deleting DeliveryVerification...");
      await tx.$executeRawUnsafe(`DELETE FROM public."DeliveryVerification";`);

      console.log("Deleting EWayBill...");
      await tx.$executeRawUnsafe(`DELETE FROM public."EWayBill";`);

      console.log("Deleting ImportedInvoiceItem...");
      await tx.$executeRawUnsafe(`DELETE FROM public."ImportedInvoiceItem";`);

      console.log("Deleting ImportedInvoice...");
      await tx.$executeRawUnsafe(`DELETE FROM public."ImportedInvoice";`);

      console.log("Deleting Document...");
      await tx.$executeRawUnsafe(`DELETE FROM public."Document";`);

      console.log("Deleting Invoice...");
      await tx.$executeRawUnsafe(`DELETE FROM public."Invoice";`);

      console.log("Deleting VerificationResponse...");
      await tx.$executeRawUnsafe(`DELETE FROM public."VerificationResponse";`);

      console.log("Deleting VerificationItem...");
      await tx.$executeRawUnsafe(`DELETE FROM public."VerificationItem";`);

      console.log("Deleting VerificationChecklist...");
      await tx.$executeRawUnsafe(`DELETE FROM public."VerificationChecklist";`);

      console.log("Deleting OrderStatusHistory...");
      await tx.$executeRawUnsafe(`DELETE FROM public."OrderStatusHistory";`);

      console.log("Deleting OrderItem...");
      await tx.$executeRawUnsafe(`DELETE FROM public."OrderItem";`);

      console.log("Deleting InventoryMovement...");
      await tx.$executeRawUnsafe(`DELETE FROM public."InventoryMovement";`);

      console.log("Deleting Order...");
      await tx.$executeRawUnsafe(`DELETE FROM public."Order";`);

      console.log("Deleting Inventory...");
      await tx.$executeRawUnsafe(`DELETE FROM public."Inventory";`);

      console.log("Deleting WarehouseLocation...");
      await tx.$executeRawUnsafe(`DELETE FROM public."WarehouseLocation";`);

      console.log("Deleting Product...");
      await tx.$executeRawUnsafe(`DELETE FROM public."Product";`);

      console.log("Deleting Category...");
      await tx.$executeRawUnsafe(`DELETE FROM public."Category";`);

      console.log("Deleting ClientEmployee...");
      await tx.$executeRawUnsafe(`DELETE FROM public."ClientEmployee";`);

      console.log("Deleting Client...");
      await tx.$executeRawUnsafe(`DELETE FROM public."Client";`);

      console.log("Deleting CompanyGroup...");
      await tx.$executeRawUnsafe(`DELETE FROM public."CompanyGroup";`);

      if (!preservedAdmin.tenantId) {
        console.log("Deleting WarehouseSetting...");
        await tx.$executeRawUnsafe(`DELETE FROM public."WarehouseSetting";`);

        console.log("Deleting NotificationSettings...");
        await tx.$executeRawUnsafe(`DELETE FROM public."NotificationSettings";`);
      } else {
        console.log(`Preserving WarehouseSetting and NotificationSettings for tenant ${preservedAdmin.tenantId}...`);
        await tx.$executeRawUnsafe(
          `DELETE FROM public."WarehouseSetting" WHERE "tenantId" != '${preservedAdmin.tenantId}';`
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM public."NotificationSettings" WHERE "tenantId" != '${preservedAdmin.tenantId}';`
        );
        // Ensure default-off notification preferences for preserved tenant
        await tx.$executeRawUnsafe(
          `UPDATE public."WarehouseSetting" SET "notificationPreferences" = jsonb_set(COALESCE("notificationPreferences", '{}'::jsonb), '{clientEmail}', 'false'::jsonb) WHERE "tenantId" = '${preservedAdmin.tenantId}';`
        );
      }

      console.log("Deleting Warehouse...");
      await tx.$executeRawUnsafe(`DELETE FROM public."Warehouse";`);

      console.log(`Deleting non-admin User records (preserving admin ID ${preservedAdmin.id})...`);
      await tx.$executeRawUnsafe(
        `DELETE FROM public."User" WHERE id != '${preservedAdmin.id}';`
      );

      if (!preservedAdmin.tenantId) {
        console.log("Deleting all Tenant records...");
        await tx.$executeRawUnsafe(`DELETE FROM public."Tenant";`);
      } else {
        console.log(`Deleting all Tenant records except admin's tenant (${preservedAdmin.tenantId})...`);
        await tx.$executeRawUnsafe(
          `DELETE FROM public."Tenant" WHERE id != '${preservedAdmin.tenantId}';`
        );
      }
    });

    console.log("Application database records successfully cleaned!");

    // 2. Storage file cleanup
    console.log("\nDeleting test storage files...");
    for (const item of storageFilesToDelete) {
      console.log(`  Deleting storage file: ${item.bucket}/${item.path}`);
      await supabase.storage.from(item.bucket).remove([item.path]);
    }
    console.log("Storage cleanup complete.");

    // 3. Supabase Auth cleanup
    console.log("\nDeleting non-admin Supabase Auth users...");
    for (const u of authUsersToDelete) {
      console.log(`  Deleting Auth user: ${u.email} (${u.id})`);
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.error(`  Failed to delete Auth user ${u.id}:`, delErr);
        throw delErr;
      }
    }
    console.log("Supabase Auth cleanup complete.");

    console.log("\n============================================================");
    console.log("RESET EXECUTION FINISHED SUCCESSFULLY");
    console.log("============================================================");
  } finally {
    await prisma.$disconnect();
  }
}

async function listAllBucketFiles(
  supabase: any,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const result: string[] = [];
  const { data: items, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100 });
  if (error || !items) return result;

  for (const item of items) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // directory
      const sub = await listAllBucketFiles(supabase, bucket, itemPath);
      result.push(...sub);
    } else {
      result.push(itemPath);
    }
  }
  return result;
}

if (require.main === module) {
  const config = parseArgs();
  runResetScript(config).catch((err) => {
    console.error("\n[RESET FAILED]:", err.message);
    process.exit(1);
  });
}
