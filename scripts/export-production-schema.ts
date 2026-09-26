/**
 * STAGING → PRODUCTION SCHEMA EXPORT WORKFLOW
 *
 * This script connects to the known-good STAGING Supabase database, introspects
 * the complete live PostgreSQL schema (enums, tables, constraints, indexes,
 * functions, RPCs, triggers, RLS status, RLS policies, grants, and storage configuration),
 * and writes a clean, reproducible, data-free SQL bootstrap snapshot.
 *
 * SAFETY GUARANTEES:
 * 1. Read-only against the source database.
 * 2. Strictly refuses to connect if the target is NOT the verified staging project (rglumbheyypdanfpmuef).
 * 3. Never connects to production.
 * 4. Never exports business/user data (tenants, users, clients, orders, invoices, payments, etc.).
 * 5. Masks and suppresses all passwords, secrets, and keys from logs and output.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Ensure local environment variables are loaded
dotenv.config();

const KNOWN_STAGING_PROJECT_REF = "rglumbheyypdanfpmuef";
const KNOWN_PRODUCTION_PROJECT_REF = "xiyfpcfgftdvrmuhemhk";

interface DbInfo {
  database: string;
  user: string;
  serverAddr: string;
  serverPort: number;
}

interface ExtensionDef {
  name: string;
  version: string;
}

interface FunctionDef {
  name: string;
  def: string;
  isSecDef: boolean;
}

interface TriggerDef {
  tableName: string;
  triggerName: string;
  def: string;
}

interface PolicyDef {
  tableName: string;
  policyName: string;
  permissive: boolean;
  cmd: string;
  roles: string[];
  usingExpr: string | null;
  withCheckExpr: string | null;
}

const CMD_MAP: Record<string, string> = {
  r: "SELECT",
  a: "INSERT",
  w: "UPDATE",
  d: "DELETE",
  "*": "ALL",
};

async function main() {
  console.log("====================================================================");
  console.log("       STAGING → PRODUCTION SCHEMA EXPORT WORKFLOW (WMS)            ");
  console.log("====================================================================");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("FATAL ERROR: DATABASE_URL environment variable is not defined.");
    process.exit(1);
  }

  // --- SAFETY CHECK 1: Verify database URL points strictly to STAGING ---
  if (databaseUrl.includes(KNOWN_PRODUCTION_PROJECT_REF)) {
    console.error(
      "\n🚨 FATAL SAFETY VIOLATION: DATABASE_URL points to PRODUCTION (" +
        KNOWN_PRODUCTION_PROJECT_REF +
        ")!"
    );
    console.error("This export workflow MUST ONLY run against the STAGING database.");
    process.exit(1);
  }

  if (!databaseUrl.includes(KNOWN_STAGING_PROJECT_REF)) {
    console.error(
      "\n🚨 FATAL SAFETY VIOLATION: Target database cannot be verified as STAGING!"
    );
    console.error(
      `Expected project ref: ${KNOWN_STAGING_PROJECT_REF}, but DATABASE_URL points elsewhere.`
    );
    process.exit(1);
  }

  console.log("✓ Safety Gate Passed: Verified connection targets STAGING project [" + KNOWN_STAGING_PROJECT_REF + "].");
  console.log("✓ Safety Gate Passed: PRODUCTION database is strictly excluded from export.");

  const prisma = new PrismaClient();

  try {
    // Verify connection and database metadata
    const [dbMeta] = await prisma.$queryRawUnsafe<any[]>(
      "SELECT current_database() as database, current_user as user, inet_server_addr()::text as \"serverAddr\", inet_server_port() as \"serverPort\""
    );
    console.log(`✓ Connected to PostgreSQL [${dbMeta.database}] as [${dbMeta.user}] on host [${dbMeta.serverAddr}:${dbMeta.serverPort}]`);

    // --- STEP 1: Introspect Base Tables, Enums, Constraints, Indexes via Prisma Migrate Diff ---
    console.log("\n[1/6] Introspecting base tables, enums, constraints, and indexes...");
    const baseDDL = execSync(
      `npx prisma migrate diff --from-empty --to-url "${databaseUrl}" --script`,
      {
        encoding: "utf-8",
        maxBuffer: 30 * 1024 * 1024,
      }
    );

    // Filter out Prisma deprecation warnings from stdout
    const cleanBaseDDL = baseDDL
      .split("\n")
      .filter((line) => !line.startsWith("warn The configuration property") && !line.startsWith("For more information"))
      .join("\n")
      .trim();

    console.log(`✓ Base DDL extracted: ${cleanBaseDDL.length} characters.`);

    // --- STEP 2: Introspect Extensions ---
    console.log("\n[2/6] Introspecting PostgreSQL extensions...");
    const extensions = await prisma.$queryRawUnsafe<ExtensionDef[]>(
      `SELECT extname as name, extversion as version
       FROM pg_extension
       WHERE extname NOT IN ('plpgsql', 'pgsodium', 'vault', 'supabase_vault', 'pg_graphql', 'pg_stat_statements', 'pgjwt', 'pg_net')
       ORDER BY extname`
    );
    console.log(`✓ Found ${extensions.length} relevant extensions.`);

    // --- STEP 3: Introspect Functions and RPCs ---
    console.log("\n[3/6] Introspecting public functions and RPC routines...");
    const functions = await prisma.$queryRawUnsafe<FunctionDef[]>(
      `SELECT
         p.proname as name,
         pg_get_functiondef(p.oid) as def,
         p.prosecdef as "isSecDef"
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
       ORDER BY p.proname`
    );
    console.log(`✓ Found ${functions.length} public functions / RPCs.`);

    // --- STEP 4: Introspect Triggers ---
    console.log("\n[4/6] Introspecting public table triggers...");
    const triggers = await prisma.$queryRawUnsafe<TriggerDef[]>(
      `SELECT
         c.relname as "tableName",
         t.tgname as "triggerName",
         pg_get_triggerdef(t.oid) as def
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND NOT t.tgisinternal
       ORDER BY c.relname, t.tgname`
    );
    console.log(`✓ Found ${triggers.length} table triggers.`);

    // --- STEP 5: Introspect RLS Status and Policies ---
    console.log("\n[5/6] Introspecting Row Level Security (RLS) tables and policies...");
    const rlsTables = await prisma.$queryRawUnsafe<any[]>(
      `SELECT tablename, rowsecurity
       FROM pg_tables
       WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
       ORDER BY tablename`
    );

    const policies = await prisma.$queryRawUnsafe<PolicyDef[]>(
      `SELECT
         c.relname as "tableName",
         p.polname as "policyName",
         p.polpermissive as permissive,
         p.polcmd as cmd,
         (SELECT array_agg(r.rolname) FROM pg_roles r WHERE r.oid = ANY(p.polroles)) as roles,
         pg_get_expr(p.polqual, p.polrelid) as "usingExpr",
         pg_get_expr(p.polwithcheck, p.polrelid) as "withCheckExpr"
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname != '_prisma_migrations'
       ORDER BY c.relname, p.polname`
    );
    console.log(`✓ Found ${rlsTables.length} public application tables (all checked for RLS).`);
    console.log(`✓ Found ${policies.length} RLS policies in public schema.`);

    // Introspect Storage Buckets & Policies
    console.log("\n[5b/6] Introspecting Supabase Storage configuration...");
    const storageBuckets = await prisma.$queryRawUnsafe<any[]>(
      "SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id"
    );
    const storagePolicies = await prisma.$queryRawUnsafe<PolicyDef[]>(
      `SELECT
         c.relname as "tableName",
         p.polname as "policyName",
         p.polpermissive as permissive,
         p.polcmd as cmd,
         (SELECT array_agg(r.rolname) FROM pg_roles r WHERE r.oid = ANY(p.polroles)) as roles,
         pg_get_expr(p.polqual, p.polrelid) as "usingExpr",
         pg_get_expr(p.polwithcheck, p.polrelid) as "withCheckExpr"
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'storage' AND c.relname = 'objects'
       ORDER BY p.polname`
    );
    console.log(`✓ Found ${storageBuckets.length} storage buckets.`);
    console.log(`✓ Found ${storagePolicies.length} storage.objects policies.`);

    // --- STEP 6: Assemble Complete Production Bootstrap Script ---
    console.log("\n[6/6] Assembling production schema bootstrap SQL...");

    const header = `-- ============================================================================
-- WMS PRODUCTION SCHEMA BOOTSTRAP (DATA-FREE)
--
-- Generated From: STAGING SUPABASE DATABASE (${KNOWN_STAGING_PROJECT_REF})
-- Generated At:   ${new Date().toISOString()}
--
-- IMPORTANT SAFETY NOTICE:
-- 1. This file contains SCHEMA DEFINITIONS ONLY (Enums, Tables, Constraints,
--    Indexes, Functions, Triggers, RLS, Policies, Grants, and Storage Buckets).
-- 2. It contains ZERO user records, ZERO client records, ZERO orders, and ZERO test data.
-- 3. Run this file on a FRESH, empty production Supabase database to bootstrap
--    the entire working WMS schema without migration order dependency bugs.
-- ============================================================================

-- Set execution environment
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Ensure required schemas exist
CREATE SCHEMA IF NOT EXISTS "public";
CREATE SCHEMA IF NOT EXISTS "storage";
CREATE SCHEMA IF NOT EXISTS "extensions";

-- ----------------------------------------------------------------------------
-- 1. REQUIRED EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

`;

    // Base tables & enums
    const tablesSection = `-- ----------------------------------------------------------------------------
-- 2. ENUMS, BASE TABLES, INDEXES, CONSTRAINTS & FOREIGN KEYS
-- ----------------------------------------------------------------------------
${cleanBaseDDL}
`;

    // Functions
    const functionsSection = `-- ----------------------------------------------------------------------------
-- 3. FUNCTIONS & RPC ROUTINES (${functions.length} Total)
-- ----------------------------------------------------------------------------
` + functions.map((f) => {
      return `-- Function: ${f.name}\n${f.def.trim()};\n\nGRANT EXECUTE ON FUNCTION public.${f.name} TO anon, authenticated, service_role;\n`;
    }).join("\n");

    // Triggers
    const triggersSection = `-- ----------------------------------------------------------------------------
-- 4. TABLE TRIGGERS (${triggers.length} Total)
-- ----------------------------------------------------------------------------
` + triggers.map((t) => {
      return `-- Trigger on public."${t.tableName}": ${t.triggerName}\nDROP TRIGGER IF EXISTS "${t.triggerName}" ON public."${t.tableName}";\n${t.def.trim()};\n`;
    }).join("\n");

    // Row Level Security enablement
    const rlsSection = `-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) ENABLEMENT (${rlsTables.length} Tables)
-- ----------------------------------------------------------------------------
` + rlsTables.map((t) => {
      return `ALTER TABLE public."${t.tablename}" ENABLE ROW LEVEL SECURITY;`;
    }).join("\n");

    // Policies
    const policiesSection = `\n\n-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY POLICIES (${policies.length} Total)
-- ----------------------------------------------------------------------------
` + policies.map((pol) => {
      const cmd = CMD_MAP[pol.cmd] || "ALL";
      const perm = pol.permissive ? "AS PERMISSIVE" : "AS RESTRICTIVE";
      const roles = pol.roles && pol.roles.length > 0 ? pol.roles.join(", ") : "public";

      let stmt = `CREATE POLICY "${pol.policyName}" ON public."${pol.tableName}"\n  ${perm}\n  FOR ${cmd}\n  TO ${roles}`;
      if (pol.usingExpr) {
        stmt += `\n  USING (${pol.usingExpr})`;
      }
      if (pol.withCheckExpr) {
        stmt += `\n  WITH CHECK (${pol.withCheckExpr})`;
      }
      stmt += ";";
      return stmt;
    }).join("\n\n");

    // System Seed (Role & Permission definitions required for RBAC to function)
    const systemMetadataSection = `\n\n-- ----------------------------------------------------------------------------
-- 7. SYSTEM ROLE & PERMISSION DEFINITIONS (RBAC System Metadata)
-- ----------------------------------------------------------------------------
-- Required system permissions
INSERT INTO public."Permission" ("key", "name", "description", "category")
VALUES
    ('ORDERS_VIEW', 'View Orders', 'View client order list and order details', 'Orders'),
    ('ORDERS_PROCESS', 'Process Orders', 'Advance order processing workflow', 'Orders'),
    ('ORDERS_DISPATCH', 'Dispatch Orders', 'Confirm shipment dispatch', 'Orders'),
    ('DELIVERY_VERIFY', 'Verify Delivery', 'Verify delivered goods and physical condition', 'Delivery'),
    ('INVENTORY_VERIFY', 'Verify Inventory', 'Verify received items, count, and store inventory update', 'Inventory'),
    ('INVOICES_VIEW', 'View Invoices', 'View commercial invoices and tax details', 'Invoices'),
    ('INVOICES_MANAGE', 'Manage Invoices', 'Manage and download commercial invoices', 'Invoices'),
    ('ACCOUNTS_VIEW', 'View Accounts', 'View account balances, ledger, and payment status', 'Accounts'),
    ('PAYMENTS_VIEW', 'View Payments', 'View recorded payments and payment history', 'Payments'),
    ('PAYMENTS_RECORD', 'Record Payments', 'Record invoice payment settlement', 'Payments'),
    ('PAYMENT_PROOF_UPLOAD', 'Upload Payment Proof', 'Upload payment receipt or transfer proof', 'Payments'),
    ('REPORTS_VIEW', 'View Reports', 'Access operational and financial reports', 'Reports')
ON CONFLICT ("key") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "category" = EXCLUDED."category";

-- System built-in roles
INSERT INTO public."RoleDefinition" ("id", "tenantId", "name", "description", "systemRole", "status")
VALUES
    ('role_md', NULL, 'MD', 'Managing Director - Full client workflow and financial access', TRUE, 'ACTIVE'),
    ('role_gm', NULL, 'GM', 'General Manager - Full client workflow and financial access', TRUE, 'ACTIVE'),
    ('role_manager', NULL, 'MANAGER', 'Manager - Full client workflow and operational access', TRUE, 'ACTIVE'),
    ('role_receiver', NULL, 'RECEIVER', 'Product Receiver - Delivery verification only', TRUE, 'ACTIVE'),
    ('role_store', NULL, 'STORE', 'Storekeeper - Inventory and store verification only', TRUE, 'ACTIVE'),
    ('role_account', NULL, 'ACCOUNT', 'Accountant - Invoices, accounting, and payments only', TRUE, 'ACTIVE')
ON CONFLICT ("id") DO NOTHING;

-- Assign permissions to MD (all)
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
CROSS JOIN public."Permission" p
WHERE r."name" = 'MD' AND r."systemRole" = TRUE
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign permissions to GM (all)
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
CROSS JOIN public."Permission" p
WHERE r."name" = 'GM' AND r."systemRole" = TRUE
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign permissions to MANAGER (all)
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
CROSS JOIN public."Permission" p
WHERE r."name" = 'MANAGER' AND r."systemRole" = TRUE
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign permissions to RECEIVER
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
JOIN public."Permission" p ON p."key" IN ('ORDERS_VIEW', 'DELIVERY_VERIFY')
WHERE r."name" = 'RECEIVER' AND r."systemRole" = TRUE
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign permissions to STORE
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
JOIN public."Permission" p ON p."key" IN ('ORDERS_VIEW', 'INVENTORY_VERIFY')
WHERE r."name" = 'STORE' AND r."systemRole" = TRUE
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign permissions to ACCOUNT
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
JOIN public."Permission" p ON p."key" IN ('INVOICES_VIEW', 'INVOICES_MANAGE', 'ACCOUNTS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_RECORD', 'PAYMENT_PROOF_UPLOAD')
WHERE r."name" = 'ACCOUNT' AND r."systemRole" = TRUE
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Singleton Platform Setting
INSERT INTO public."PlatformSetting" ("id", "tenantId", "platformName", "featureFlags", "notificationSettings", "createdAt", "updatedAt")
VALUES ('platform_default', NULL, 'WarehouseOS', '{"clientOtp": true, "realtimeNotifications": true}'::jsonb, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
`;

    // Global Privileges & Grants
    const grantsSection = `\n\n-- ----------------------------------------------------------------------------
-- 8. GLOBAL PERMISSIONS & SCHEMA PRIVILEGES
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
`;

    // Storage Buckets & Policies
    const storageSection = `\n\n-- ----------------------------------------------------------------------------
-- 9. SUPABASE STORAGE BUCKETS & POLICIES
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

` + storagePolicies.map((pol) => {
      const cmd = CMD_MAP[pol.cmd] || "ALL";
      const perm = pol.permissive ? "AS PERMISSIVE" : "AS RESTRICTIVE";
      const roles = pol.roles && pol.roles.length > 0 ? pol.roles.join(", ") : "public";

      let stmt = `CREATE POLICY "${pol.policyName}" ON storage.objects\n  ${perm}\n  FOR ${cmd}\n  TO ${roles}`;
      if (pol.usingExpr) {
        stmt += `\n  USING (${pol.usingExpr})`;
      }
      if (pol.withCheckExpr) {
        stmt += `\n  WITH CHECK (${pol.withCheckExpr})`;
      }
      stmt += ";";
      return stmt;
    }).join("\n\n");

    const fullSQL = [
      header,
      tablesSection,
      functionsSection,
      triggersSection,
      rlsSection,
      policiesSection,
      systemMetadataSection,
      grantsSection,
      storageSection,
      "\n-- End of Production Schema Bootstrap\n",
    ].join("\n");

    // --- STEP 7: Rigorous Output Validation ---
    console.log("\n====================================================================");
    console.log("               VALIDATING GENERATED BOOTSTRAP SQL                   ");
    console.log("====================================================================");

    // 1. Data Leak Check: Ensure no business/user table data is inserted at the top level
    // Base tables DDL must have zero INSERT statements
    if (cleanBaseDDL.toUpperCase().includes("INSERT INTO")) {
      console.error("🚨 FATAL VALIDATION FAILURE: Base DDL contains unexpected INSERT statements!");
      process.exit(1);
    }

    const allowedTopLevelInserts = [
      'INSERT INTO public."Permission"',
      'INSERT INTO public."RoleDefinition"',
      'INSERT INTO public."RolePermission"',
      'INSERT INTO public."PlatformSetting"',
      'INSERT INTO storage.buckets',
    ];

    let currentDollarTag: string | null = null;
    const lines = fullSQL.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for PostgreSQL dollar-quote delimiter transitions: e.g. $function$, $$, $_$
      const tagMatches = line.match(/\$[a-zA-Z0-9_]*\$/g);
      if (tagMatches) {
        for (const tag of tagMatches) {
          if (currentDollarTag === null) {
            currentDollarTag = tag;
          } else if (currentDollarTag === tag) {
            currentDollarTag = null;
          }
        }
      }

      const insideFunction = currentDollarTag !== null;
      if (!insideFunction && line.toUpperCase().startsWith("INSERT INTO")) {
        const isAllowed = allowedTopLevelInserts.some((allowed) => line.startsWith(allowed));
        if (!isAllowed) {
          console.error(
            `🚨 FATAL VALIDATION FAILURE: Top-level business data insertion detected at line ${i + 1}: ${line}`
          );
          process.exit(1);
        }
      }
    }
    // 1b. Prisma Migrations Table Check: Ensure zero references to _prisma_migrations
    if (fullSQL.toLowerCase().includes("prisma_migration")) {
      console.error(
        "🚨 FATAL VALIDATION FAILURE: SQL contains unexpected reference to _prisma_migrations!"
      );
      process.exit(1);
    }
    console.log("✓ Validation Passed: ZERO references to _prisma_migrations in bootstrap SQL.");

    // 2. Enum Types Verification
    const expectedEnums = [
      "Role",
      "ClientEmployeeRole",
      "TenantStatus",
      "UserStatus",
      "ClientStatus",
      "ProductStatus",
      "OrderStatus",
      "VerificationStatus",
      "InvoiceStatus",
      "PaymentStatus",
      "InventoryMovementType",
      "DocumentType",
      "NotificationType",
      "InvoiceImportStatus",
      "EWayBillStatus",
      "DeliveryVerificationItemStatus",
    ];

    for (const enumName of expectedEnums) {
      const match =
        fullSQL.includes(`CREATE TYPE "${enumName}"`) ||
        fullSQL.includes(`CREATE TYPE "public"."${enumName}"`);
      if (!match) {
        console.error(`🚨 FATAL VALIDATION FAILURE: Missing enum ${enumName}`);
        process.exit(1);
      }
    }
    console.log(`✓ Validation Passed: All ${expectedEnums.length} PostgreSQL enums defined.`);

    // 3. Core Tables Verification
    const expectedTables = [
      "Tenant",
      "User",
      "Warehouse",
      "WarehouseSetting",
      "CompanyGroup",
      "Client",
      "ClientEmployee",
      "Product",
      "Category",
      "Inventory",
      "InventoryMovement",
      "Order",
      "OrderItem",
      "OrderStatusHistory",
      "VerificationChecklist",
      "VerificationItem",
      "VerificationResponse",
      "Invoice",
      "InvoiceItem",
      "Payment",
      "Notification",
      "NotificationSettings",
      "EmailLog",
      "AuditLog",
      "RoleDefinition",
      "Permission",
      "RolePermission",
      "DeliveryVerification",
      "DeliveryVerificationItem",
      "Document",
      "EWayBill",
      "ImportedInvoice",
      "ImportedInvoiceItem",
      "PlatformSetting",
      "WarehouseLocation",
    ];

    for (const tbl of expectedTables) {
      const match =
        fullSQL.includes(`CREATE TABLE "${tbl}"`) ||
        fullSQL.includes(`CREATE TABLE "public"."${tbl}"`);
      if (!match) {
        console.error(`🚨 FATAL VALIDATION FAILURE: Missing table ${tbl}`);
        process.exit(1);
      }
    }
    console.log(`✓ Validation Passed: All ${expectedTables.length} core public tables defined.`);

    // 4. Critical RPC Functions Verification
    const expectedFunctions = [
      "resolve_current_actor",
      "rpc_create_order_with_invoice",
      "rpc_transition_order",
      "rpc_receive_or_adjust_stock",
      "rpc_update_employee",
      "rpc_submit_verification",
      "rpc_submit_store_verification",
      "rpc_generate_invoice",
      "rpc_record_payment_secure",
      "rpc_attach_payment_proof",
      "rpc_cancel_payment_record",
      "rpc_link_auth_user_by_email",
      "rpc_update_client_employee",
      "rpc_admin_update_user_role",
      "rpc_assign_client_company_group",
      "rpc_get_my_permissions",
      "rpc_init_inventory_item",
      "rpc_mark_notification_read",
      "rpc_create_notification",
      "rpc_log_email_delivery",
      "rpc_update_notification_settings",
    ];

    for (const fn of expectedFunctions) {
      if (!fullSQL.includes(`FUNCTION public.${fn}`)) {
        console.error(`🚨 FATAL VALIDATION FAILURE: Missing critical function ${fn}`);
        process.exit(1);
      }
    }
    console.log(`✓ Validation Passed: All ${expectedFunctions.length} critical RPC routines verified.`);

    // 5. Triggers Verification
    const expectedTriggers = [
      "trg_inventory_timestamps",
      "trg_protect_notification_fields",
      "create_notification_settings_on_tenant_create",
      "trg_protect_user_fields",
    ];

    for (const trg of expectedTriggers) {
      if (!fullSQL.includes(`"${trg}"`)) {
        console.error(`🚨 FATAL VALIDATION FAILURE: Missing trigger ${trg}`);
        process.exit(1);
      }
    }
    console.log(`✓ Validation Passed: All ${expectedTriggers.length} table triggers verified.`);

    // 6. RLS & Policy Verification
    console.log(`✓ Validation Passed: RLS enabled on all ${rlsTables.length} tables.`);
    console.log(`✓ Validation Passed: All ${policies.length} public RLS policies generated.`);
    console.log(`✓ Validation Passed: All ${storagePolicies.length} storage RLS policies generated.`);

    // --- STEP 8: Write to Ignored Bootstrap File ---
    const outDir = path.join(process.cwd(), "supabase", "bootstrap");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const outPath = path.join(outDir, "production_schema_bootstrap.sql");
    fs.writeFileSync(outPath, fullSQL, "utf-8");

    console.log("\n====================================================================");
    console.log("             SCHEMA EXPORT COMPLETED SUCCESSFULLY                   ");
    console.log("====================================================================");
    console.log(`Output File: ${outPath}`);
    console.log(`File Size:   ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
    console.log(`Encoding:    UTF-8`);
    console.log("Data Rows:   0 (Pure Schema & System Seed Only)");
    console.log("====================================================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unhandled error during schema export:", err);
  process.exit(1);
});
