# Production Schema Bootstrap Guide

This document describes the end-to-end procedure for bootstrapping a clean, safe, data-free production Supabase database from the current working staging database schema.

---

## 1. Prerequisites

Before beginning the bootstrap process, ensure the following are available on your machine:

1. **Node.js**: v18+ (tested on Node v24).
2. **npm / npx**: Available in your environment.
3. **Dependencies Installed**: Run `npm install` to ensure `@prisma/client`, `prisma`, `tsx`, and `dotenv` are installed.
4. **Supabase CLI**: Installed (bundled via devDependencies: `npx supabase`).
5. **Network Connectivity**: Direct outbound access to Supabase database poolers on port `5432` or `6543`.

> [!IMPORTANT]
> **DO NOT** execute `supabase db push` against production.  
> The existing migration chain cannot bootstrap an empty database directly because migration `20260904_warehouse_os_core.sql` references the enum `OrderStatus` before the enum creation statement. The snapshot bootstrap approach is specifically engineered to resolve this without altering historical migrations.

---

## 2. Environment Identification (Staging vs. Production)

Always confirm your target environment before running any command.

| Attribute | Staging Environment | Production Environment |
| :--- | :--- | :--- |
| **Project Ref** | `rglumbheyypdanfpmuef` | `xiyfpcfgftdvrmuhemhk` |
| **Supabase URL** | `https://rglumbheyypdanfpmuef.supabase.co` | `https://xiyfpcfgftdvrmuhemhk.supabase.co` |
| **Database Pooler Host** | `aws-0-ap-south-1.pooler.supabase.com:5432` | `aws-0-ap-south-1.pooler.supabase.com:6543` |
| **Config File** | `.env` / `.env.local` | `.env.production` |
| **State** | Working test & staging data | Fresh, clean, empty Supabase project |

### How to verify your current CLI link:
```powershell
npx supabase projects list
```
Look for `linked: true` in the output. If you are linked to `rglumbheyypdanfpmuef`, you are connected to **Staging**.

---

## 3. How to Export the Staging Schema

The repository includes a dedicated, automated schema-only export script:  
[`scripts/export-production-schema.ts`](file:///d:/Dev/warehouse_management/scripts/export-production-schema.ts)

### Safety Gates Built into the Script:
1. **Target Verification**: Checks `DATABASE_URL` to ensure it contains `rglumbheyypdanfpmuef` (Staging).
2. **Production Block**: If `DATABASE_URL` contains `xiyfpcfgftdvrmuhemhk` (Production), execution **aborts immediately**.
3. **Data Leak Prevention**: Scans generated SQL to guarantee **zero rows** of tenant, user, client, order, invoice, payment, or audit log data are exported.
4. **Credential Protection**: Never outputs database passwords or API keys.

### Running the Export:
Ensure `.env` points to staging (`DATABASE_URL` with project ref `rglumbheyypdanfpmuef`), then run:
```powershell
npx tsx scripts/export-production-schema.ts
```

Output is written to:
```
supabase/bootstrap/production_schema_bootstrap.sql
```
*(This path is ignored by Git to keep deployment artifacts local).*

---

## 4. How to Inspect the Generated Schema

Before applying the bootstrap script, inspect the output file:

1. **Verify File Size & Encoding**:
   The output should be approximately 200–220 KB, UTF-8 encoded, with ~5,800 lines.
2. **Verify Object Definitions**:
   - **Enums (16)**: `Role`, `ClientEmployeeRole`, `TenantStatus`, `UserStatus`, `ClientStatus`, `ProductStatus`, `OrderStatus`, `VerificationStatus`, `InvoiceStatus`, `PaymentStatus`, `InventoryMovementType`, `DocumentType`, `NotificationType`, `InvoiceImportStatus`, `EWayBillStatus`, `DeliveryVerificationItemStatus`.
   - **Application Tables (35)**: `Tenant`, `User`, `Warehouse`, `WarehouseSetting`, `CompanyGroup`, `Client`, `ClientEmployee`, `Product`, `Category`, `Inventory`, `InventoryMovement`, `Order`, `OrderItem`, `OrderStatusHistory`, `VerificationChecklist`, `VerificationItem`, `VerificationResponse`, `Invoice`, `InvoiceItem`, `Payment`, `Notification`, `NotificationSettings`, `EmailLog`, `AuditLog`, `RoleDefinition`, `Permission`, `RolePermission`, `DeliveryVerification`, `DeliveryVerificationItem`, `Document`, `EWayBill`, `ImportedInvoice`, `ImportedInvoiceItem`, `PlatformSetting`, `WarehouseLocation`.
   - **Functions / RPCs (42)**: Including `resolve_current_actor`, `rpc_create_order_with_invoice`, `rpc_transition_order`, `rpc_receive_or_adjust_stock`, `rpc_record_payment_secure`, `rpc_get_my_permissions`, etc.
   - **Triggers (4)**: Triggers on `Inventory`, `Notification`, `Tenant`, and `User`.
   - **RLS Enablement**: 36 tables with `ENABLE ROW LEVEL SECURITY`.
   - **RLS Policies (88)**: 82 public schema policies + 6 storage policies.
   - **Zero User Data**: Ensure no `INSERT INTO "User"` or `INSERT INTO "Tenant"` statements exist.

---

## 5. How to Restore into the Fresh Production Database

Execution must be performed manually by the database administrator. **Do not run automated destructive scripts.**

### Method A: Via Supabase Web Dashboard (Recommended)

1. Open your browser and navigate to the Supabase Dashboard:
   `https://supabase.com/dashboard/project/xiyfpcfgftdvrmuhemhk/sql`
2. Open the **SQL Editor**.
3. Create a **New query**.
4. Open `supabase/bootstrap/production_schema_bootstrap.sql` in your editor, copy the entire contents, and paste into the SQL Editor.
5. Click **Run**.
6. Verify the query executes with success (`Success. No rows returned`).

### Method B: Via CLI Query Against Production

If you have linked to production via `npx supabase link --project-ref xiyfpcfgftdvrmuhemhk`:
```powershell
npx supabase db query --linked -f supabase/bootstrap/production_schema_bootstrap.sql
```

Alternatively, using the production connection string with `psql` (if installed):
```bash
psql "$PRODUCTION_DATABASE_URL" -f supabase/bootstrap/production_schema_bootstrap.sql
```

---

## 6. How to Verify the Restored Production Schema

After executing the bootstrap file, verify the production database state:

### 1. Count Tables
```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 35 (all core application tables; zero internal migration tables)
```

### 2. Count Public Functions
```sql
SELECT count(*) FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
WHERE n.nspname = 'public';
-- Expected: 42
```

### 3. Verify RLS is Enabled
```sql
SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
-- Expected: 35 (All 35 public tables must have rowsecurity = true)
```

### 4. Verify System Roles and Permissions
```sql
SELECT count(*) FROM public."Permission";     -- Expected: 12
SELECT count(*) FROM public."RoleDefinition"; -- Expected: 6
SELECT count(*) FROM public."RolePermission"; -- Expected: 46
```

### 5. Verify Zero Business Data
```sql
SELECT count(*) FROM public."Tenant";  -- Expected: 0
SELECT count(*) FROM public."User";    -- Expected: 0
SELECT count(*) FROM public."Order";   -- Expected: 0
SELECT count(*) FROM public."Invoice"; -- Expected: 0
```

---

## 7. Configuration Requiring Separate Setup

The following components are platform-managed and cannot be provisioned solely by PostgreSQL DDL:

### A. Supabase Storage Buckets
The bootstrap script creates the `storage.buckets` rows (`invoices` and `payment-proofs`) and their 6 `storage.objects` RLS policies.  
Confirm in **Dashboard → Storage**:
- Bucket `invoices`: **Private**
- Bucket `payment-proofs`: **Private**

### B. Supabase Edge Functions
Two Edge Functions must be deployed to the production Supabase project:
1. `create-employee`
2. `send-email`

Deploy commands:
```powershell
# 1. Link to production
npx supabase link --project-ref xiyfpcfgftdvrmuhemhk

# 2. Deploy edge functions
npx supabase functions deploy create-employee --project-ref xiyfpcfgftdvrmuhemhk
npx supabase functions deploy send-email --project-ref xiyfpcfgftdvrmuhemhk
```

### C. Supabase Secrets (for Edge Functions)
The `send-email` function dispatches transactional emails via Resend. Set secrets in production:
```powershell
npx supabase secrets set RESEND_API_KEY="<production_resend_api_key>" --project-ref xiyfpcfgftdvrmuhemhk
npx supabase secrets set RESEND_FROM_EMAIL="Warevo <notifications@warevo.online>" --project-ref xiyfpcfgftdvrmuhemhk
```
*(Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by the Supabase runtime).*

### D. Supabase Auth Configuration
In **Dashboard → Authentication**:
- **Email Auth**: Enable Email provider.
- **Site URL**: Set to your production domain (e.g. `https://warevo.online`).
- **Redirect URLs**: Add `https://warevo.online/**` and `https://<vercel-deployment>.vercel.app/**`.

### E. Vercel Production Environment Variables
In your Vercel Project Settings for Production:

| Variable | Description |
| :--- | :--- |
| `VITE_SUPABASE_URL` | `https://xiyfpcfgftdvrmuhemhk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Production anon/publishable key (`sb_publishable_...` or JWT) |
| `VITE_SUPABASE_PUBLISHABLE_KEY`| Production publishable key (`sb_publishable_...`) |
| `NEXT_PUBLIC_APP_URL` | `https://warevo.online` (or production domain) |
| `VITE_APP_URL` | `https://warevo.online` |

---

## 8. Explicit Warnings Against Restoring Data

> [!CAUTION]
> **NEVER RESTORE STAGING DATA INTO PRODUCTION.**
> 
> - Staging contains mock users, test tenants, dummy inventory, test invoices, and development email configurations.
> - Staging users have mock passwords and personal emails.
> - Restoring staging data would pollute financial sequences (`INV-2026-XXXXXX`) and break audit trails.
> - The bootstrap script is guaranteed to contain **zero** business data rows.

---

## 9. Rollback & Disaster Recovery

If an issue occurs during production bootstrap:

1. **Clean Slate Reset (Production Only)**:
   Since production is completely fresh with no users or live data, if an execution error occurs in the SQL Editor, you can drop the public schema and re-run:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO postgres;
   GRANT ALL ON SCHEMA public TO public;
   ```
2. **Re-link to Staging CLI**:
   After completing production tasks, always switch your local CLI link back to staging:
   ```powershell
   npx supabase link --project-ref rglumbheyypdanfpmuef
   ```
