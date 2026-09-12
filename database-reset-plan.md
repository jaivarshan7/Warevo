# Development Database Reset Plan
**Environment:** Development/Test WMS Database  
**Tenant:** apex  
**Date:** 2026-09-11  
**Status:** AWAITING APPROVAL - DO NOT EXECUTE YET

---

## ⚠️ CRITICAL SAFETY NOTICE

This is a DESTRUCTIVE operation for DEVELOPMENT/TEST environment only.

**Confirmed:**
- This resets TEST/BUSINESS DATA ROWS, NOT schema
- Tables, columns, functions, RLS policies, and storage buckets are PRESERVED
- Database structure remains intact

---

## 1. SCOPE ANALYSIS

### 1.1 What Will Be DELETED (Data Rows)

Based on schema analysis, the following TEST/BUSINESS data rows will be removed:

**Core Business Data:**
- Client companies (rows in `Client` table)
- Client employees (rows in `Client` table where `employeeRole` is set)
- Company groups (rows in `CompanyGroup` table)
- WMS users created for testing (rows in `User` table linked to tenant)
- Orders (rows in `Order` table)
- Order items (rows in `OrderItem` table)
- Order status history (rows in `OrderStatusHistory` table)
- Order contacts (rows in `OrderContact` table)

**Verification Data:**
- Verification responses (rows in `VerificationResponse` table)
- Verification checklists (rows in `VerificationChecklist` table)
- Verification items (rows in `VerificationItem` table)

**Financial Data:**
- Invoices (rows in `Invoice` table)
- Invoice items (rows in `InvoiceItem` table)
- Payments (rows in `Payment` table)

**Imported/Generated Documents:**
- Imported invoices (rows in `ImportedInvoice` table)
- Imported invoice items (rows in `ImportedInvoiceItem` table)
- E-Way bills (rows in `EWayBill` table)
- Delivery verifications (rows in `DeliveryVerification` table)
- Delivery verification items (rows in `DeliveryVerificationItem` table)
- Documents (rows in `Document` table)

**Inventory & Warehouse:**
- Warehouse locations (rows in `WarehouseLocation` table)
- Inventory records (rows in `Inventory` table)
- Inventory movements (rows in `InventoryMovement` table)
- Warehouses (rows in `Warehouse` table)

**Product & Category:**
- Products (rows in `Product` table)
- Categories (rows in `Category` table)

**System Activity:**
- Notifications (rows in `Notification` table)
- Audit logs (rows in `AuditLog` table - tenant-scoped only)

### 1.2 What Will Be PRESERVED

**Database Structure:**
- All table definitions
- All columns
- All enum types
- All functions/RPCs (rpc_transition_order, rpc_receive_or_adjust_stock, etc.)
- All RLS policies
- All indexes
- All constraints

**Storage Infrastructure:**
- `payment-proofs` bucket (structure)
- `invoices` bucket (structure)

**System Configuration:**
- Platform settings (rows in `PlatformSetting` not linked to tenant)
- Platform admin user (no tenantId)

**Tenant Record:**
- **RECOMMENDATION:** PRESERVE the `apex` tenant row
- **Reason:** The tenant row itself should remain as it anchors the tenant ID used throughout the application. Only its dependent business records should be deleted.

---

## 2. TENANT ANALYSIS

### 2.1 Current Tenant: `apex`

Based on the seed file analysis:
- Tenant slug: `apex`
- Tenant name: `Apex Warehousing`
- Created with seed data

### 2.2 Tenant Preservation Decision

**PRESERVE the Tenant row itself:**

**Why:**
1. The tenant ID is used throughout the application as a foreign key anchor
2. Tenant contains configuration (GST number, address, contact info) that should persist
3. NotificationSettings are auto-created via trigger on tenant creation
4. Deleting and recreating could cause issues with:
   - Application session context
   - Auth JWT claims (if they reference tenantId)
   - Settings references
5. It's safer to keep the tenant "shell" and remove all its business data

**Action:** Keep the `Tenant` row for `apex`, delete all dependent data

---

## 3. FOREIGN KEY DEPENDENCY MAP

Based on schema analysis, here's the actual dependency tree:

```
Tenant (PRESERVE)
├── NotificationSettings (PRESERVE - system config)
├── WarehouseSetting (PRESERVE - system config)
├── PlatformSetting (PRESERVE if linked)
│
├── CompanyGroup
│   └── Client
│       ├── User (CLIENT role)
│       ├── Order
│       │   ├── OrderContact
│       │   ├── OrderItem
│       │   ├── OrderStatusHistory
│       │   ├── VerificationResponse
│       │   ├── InventoryMovement
│       │   ├── ImportedInvoice
│       │   │   ├── ImportedInvoiceItem
│       │   │   │   └── DeliveryVerificationItem
│       │   │   ├── EWayBill
│       │   │   └── DeliveryVerification
│       │   │       └── DeliveryVerificationItem
│       │   ├── Invoice
│       │   │   ├── InvoiceItem
│       │   │   ├── Payment
│       │   │   ├── EWayBill
│       │   │   └── DeliveryVerification
│       │   │       └── DeliveryVerificationItem
│       │   ├── Notification
│       │   └── Document
│       └── ImportedInvoice (client-linked)
│
├── Warehouse
│   ├── WarehouseLocation
│   │   └── Inventory
│   │       └── InventoryMovement
│   └── Inventory
│       └── InventoryMovement
│
├── Category
│   └── Product
│       ├── Inventory
│       │   └── InventoryMovement
│       ├── InventoryMovement
│       ├── OrderItem
│       └── InvoiceItem
│
├── User (non-CLIENT roles: WAREHOUSE_OWNER, MODERATOR, ACCOUNTANT, STAFF, etc.)
│   ├── Order (createdBy, assignedStaff)
│   ├── AuditLog
│   ├── Notification
│   └── ImportedInvoice (uploadedBy)
│
├── VerificationChecklist
│   └── VerificationItem
│
├── Notification
├── AuditLog
└── Document
```

---

## 4. SUPABASE AUTH USERS ANALYSIS

### 4.1 Understanding User vs auth.users

The `User` table stores WMS application users. Some may be linked to Supabase auth system via `supabaseUserId`.

**Analysis Required:**
Before deletion, we need to query:
```sql
SELECT 
  u.id as wms_user_id,
  u.name,
  u.role,
  u.email,
  u.supabaseUserId,
  u.tenantId
FROM "User" u
WHERE u.tenantId = '<APEX_TENANT_ID>'
ORDER BY u.role, u.name;
```

This will show:
- Which WMS users belong to apex tenant
- Which have Supabase auth accounts (supabaseUserId not null)
- What roles they have

### 4.2 Auth User Deletion Strategy

**DO NOT delete auth.users automatically in this script.**

**Approach:**
1. Delete WMS `User` table rows for apex tenant
2. Report which `supabaseUserId` values were linked
3. User must manually decide whether to delete auth.users entries separately
4. Provide separate script for auth cleanup if needed

**Why separate:**
- auth.users is managed by Supabase Auth system
- Deleting auth users requires additional permissions
- User might want to preserve auth accounts for testing
- Can cause issues if users are currently logged in

---

## 5. STORAGE IMPACT ANALYSIS

### 5.1 Payment Proofs Bucket

**Bucket:** `payment-proofs`  
**Purpose:** Stores payment proof files (JPG, PNG, PDF)

**Files to Check:**
- Payment records have `proofUrl` field
- URLs typically in format: `payment-proofs/<tenant>/<payment-id>.<ext>`

**Strategy:**
- DO NOT delete the bucket
- DO NOT automatically delete files in this script
- Provide separate storage cleanup commands

**Reason:**
- Storage operations are separate from database operations
- Files may not be perfectly mapped to tenant
- User should verify storage contents first
- Can delete storage files after verifying DB reset is successful

### 5.2 Invoices Bucket

**Bucket:** `invoices`  
**Purpose:** Legacy/backup invoice PDFs

**Strategy:** Same as payment-proofs - preserve bucket, manual file cleanup

---

## 6. DELETION ORDER (Child → Parent)

Based on foreign key dependencies, deletion must proceed in this exact order:

### Phase 1: Deepest Children (No Dependencies)
```sql
-- 1. Delivery verification items (depends on verification and imported invoice items)
DELETE FROM "DeliveryVerificationItem"
WHERE "verificationId" IN (
  SELECT id FROM "DeliveryVerification" WHERE "tenantId" = '<APEX_TENANT_ID>'
);

-- 2. Imported invoice items (depends on imported invoice)
DELETE FROM "ImportedInvoiceItem"
WHERE "importedInvoiceId" IN (
  SELECT id FROM "ImportedInvoice" WHERE "tenantId" = '<APEX_TENANT_ID>'
);

-- 3. Verification items (depends on checklist)
DELETE FROM "VerificationItem"
WHERE "checklistId" IN (
  SELECT id FROM "VerificationChecklist" WHERE "tenantId" = '<APEX_TENANT_ID>'
);

-- 4. Invoice items (depends on invoice)
DELETE FROM "InvoiceItem"
WHERE "invoiceId" IN (
  SELECT id FROM "Invoice" WHERE "tenantId" = '<APEX_TENANT_ID>'
);

-- 5. Order items (depends on order)
DELETE FROM "OrderItem"
WHERE "orderId" IN (
  SELECT id FROM "Order" WHERE "tenantId" = '<APEX_TENANT_ID>'
);

-- 6. Payments (depends on invoice)
DELETE FROM "Payment"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 7. Inventory movements (depends on inventory)
DELETE FROM "InventoryMovement"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 8. Order status history (depends on order)
DELETE FROM "OrderStatusHistory"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 9. Order contacts (depends on order and client)
DELETE FROM "OrderContact"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 10. Verification responses (depends on order)
DELETE FROM "VerificationResponse"
WHERE "tenantId" = '<APEX_TENANT_ID>';
```

### Phase 2: Mid-Level Dependencies
```sql
-- 11. Delivery verifications (depends on order/invoice/imported invoice)
DELETE FROM "DeliveryVerification"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 12. E-way bills (depends on invoice/imported invoice)
DELETE FROM "EWayBill"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 13. Imported invoices (depends on document, order, client)
DELETE FROM "ImportedInvoice"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 14. Documents (depends on order)
DELETE FROM "Document"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 15. Invoices (depends on order, client)
DELETE FROM "Invoice"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 16. Orders (depends on client)
DELETE FROM "Order"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 17. Notifications
DELETE FROM "Notification"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 18. Audit logs (tenant-scoped business activity)
DELETE FROM "AuditLog"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 19. Inventory (depends on warehouse, location, product)
DELETE FROM "Inventory"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 20. Verification checklists
DELETE FROM "VerificationChecklist"
WHERE "tenantId" = '<APEX_TENANT_ID>';
```

### Phase 3: Core Business Entities
```sql
-- 21. Warehouse locations (depends on warehouse)
DELETE FROM "WarehouseLocation"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 22. Warehouses
DELETE FROM "Warehouse"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 23. Products
DELETE FROM "Product"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 24. Categories
DELETE FROM "Category"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 25. Clients (depends on user, company group)
DELETE FROM "Client"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 26. Company groups
DELETE FROM "CompanyGroup"
WHERE "tenantId" = '<APEX_TENANT_ID>';

-- 27. Users (tenant-scoped users)
DELETE FROM "User"
WHERE "tenantId" = '<APEX_TENANT_ID>';
```

**Note:** Platform admin user (no tenantId) and PlatformSetting are preserved.

---

## 7. DRY-RUN SQL SCRIPT

This script counts existing rows and projects what will be deleted:

```sql
-- =============================================================================
-- DRY-RUN: Count rows before deletion
-- Database: Development WMS (apex tenant)
-- Date: 2026-09-11
-- =============================================================================

-- First, get the tenant ID
SELECT 
  id as tenant_id,
  name,
  slug,
  status,
  'This is the tenant that will have its data reset' as note
FROM "Tenant"
WHERE slug = 'apex';

-- Store tenant ID (replace in WHERE clauses below)
-- For this script, we'll use a placeholder: <APEX_TENANT_ID>

\echo '=== PHASE 1: Deepest Children ==='

SELECT 'DeliveryVerificationItem' as table_name, COUNT(*) as current_rows
FROM "DeliveryVerificationItem" dvi
WHERE dvi."verificationId" IN (
  SELECT id FROM "DeliveryVerification" WHERE "tenantId" = '<APEX_TENANT_ID>'
);

SELECT 'ImportedInvoiceItem' as table_name, COUNT(*) as current_rows
FROM "ImportedInvoiceItem"
WHERE "importedInvoiceId" IN (
  SELECT id FROM "ImportedInvoice" WHERE "tenantId" = '<APEX_TENANT_ID>'
);

SELECT 'VerificationItem' as table_name, COUNT(*) as current_rows
FROM "VerificationItem"
WHERE "checklistId" IN (
  SELECT id FROM "VerificationChecklist" WHERE "tenantId" = '<APEX_TENANT_ID>'
);

SELECT 'InvoiceItem' as table_name, COUNT(*) as current_rows
FROM "InvoiceItem"
WHERE "invoiceId" IN (
  SELECT id FROM "Invoice" WHERE "tenantId" = '<APEX_TENANT_ID>'
);

SELECT 'OrderItem' as table_name, COUNT(*) as current_rows
FROM "OrderItem"
WHERE "orderId" IN (
  SELECT id FROM "Order" WHERE "tenantId" = '<APEX_TENANT_ID>'
);

SELECT 'Payment' as table_name, COUNT(*) as current_rows
FROM "Payment"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'InventoryMovement' as table_name, COUNT(*) as current_rows
FROM "InventoryMovement"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'OrderStatusHistory' as table_name, COUNT(*) as current_rows
FROM "OrderStatusHistory"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'OrderContact' as table_name, COUNT(*) as current_rows
FROM "OrderContact"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'VerificationResponse' as table_name, COUNT(*) as current_rows
FROM "VerificationResponse"
WHERE "tenantId" = '<APEX_TENANT_ID>';

\echo '=== PHASE 2: Mid-Level Dependencies ==='

SELECT 'DeliveryVerification' as table_name, COUNT(*) as current_rows
FROM "DeliveryVerification"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'EWayBill' as table_name, COUNT(*) as current_rows
FROM "EWayBill"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'ImportedInvoice' as table_name, COUNT(*) as current_rows
FROM "ImportedInvoice"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'Document' as table_name, COUNT(*) as current_rows
FROM "Document"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'Invoice' as table_name, COUNT(*) as current_rows
FROM "Invoice"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'Order' as table_name, COUNT(*) as current_rows
FROM "Order"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'Notification' as table_name, COUNT(*) as current_rows
FROM "Notification"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'AuditLog' as table_name, COUNT(*) as current_rows
FROM "AuditLog"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'Inventory' as table_name, COUNT(*) as current_rows
FROM "Inventory"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'VerificationChecklist' as table_name, COUNT(*) as current_rows
FROM "VerificationChecklist"
WHERE "tenantId" = '<APEX_TENANT_ID>';

\echo '=== PHASE 3: Core Business Entities ==='

SELECT 'WarehouseLocation' as table_name, COUNT(*) as current_rows
FROM "WarehouseLocation"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'Warehouse' as table_name, COUNT(*) as current_rows
FROM "Warehouse"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'Product' as table_name, COUNT(*) as current_rows
FROM "Product"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'Category' as table_name, COUNT(*) as current_rows
FROM "Category"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'Client' as table_name, COUNT(*) as current_rows
FROM "Client"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'CompanyGroup' as table_name, COUNT(*) as current_rows
FROM "CompanyGroup"
WHERE "tenantId" = '<APEX_TENANT_ID>';

SELECT 'User' as table_name, COUNT(*) as current_rows
FROM "User"
WHERE "tenantId" = '<APEX_TENANT_ID>';

\echo '=== PRESERVATION CHECK ==='

SELECT 'Tenant (PRESERVED)' as table_name, COUNT(*) as current_rows
FROM "Tenant"
WHERE slug = 'apex';

SELECT 'PlatformAdmin (PRESERVED)' as table_name, COUNT(*) as current_rows
FROM "User"
WHERE "tenantId" IS NULL AND role = 'PLATFORM_ADMIN';

SELECT 'PlatformSetting (PRESERVED)' as table_name, COUNT(*) as current_rows
FROM "PlatformSetting"
WHERE "tenantId" IS NULL;

\echo '=== SUPABASE AUTH USERS LINKED TO APEX ==='

SELECT 
  u.id as wms_user_id,
  u.name,
  u.role,
  u.email,
  u.supabaseUserId,
  CASE 
    WHEN u.supabaseUserId IS NOT NULL THEN 'LINKED TO AUTH'
    ELSE 'NO AUTH LINK'
  END as auth_status
FROM "User" u
WHERE u.tenantId = '<APEX_TENANT_ID>'
ORDER BY u.role, u.name;
```

---

## 8. FINAL DELETE SQL SCRIPT

**WARNING: This script is DESTRUCTIVE. Use only in DEVELOPMENT/TEST environment.**

```sql
-- =============================================================================
-- DATABASE RESET SCRIPT
-- Environment: DEVELOPMENT/TEST ONLY
-- Tenant: apex
-- Date: 2026-09-11
-- =============================================================================
-- IMPORTANT: Replace <APEX_TENANT_ID> with actual tenant ID before execution
-- =============================================================================

BEGIN;

-- Get and store tenant ID
DO $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  SELECT id INTO v_tenant_id FROM "Tenant" WHERE slug = 'apex';
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant apex not found!';
  END IF;
  
  RAISE NOTICE 'Resetting data for tenant: % (ID: %)', 'apex', v_tenant_id;
  
  -- =============================================================================
  -- PHASE 1: Deepest Children
  -- =============================================================================
  
  RAISE NOTICE 'Phase 1: Deleting deepest children...';
  
  -- 1. Delivery verification items
  DELETE FROM "DeliveryVerificationItem"
  WHERE "verificationId" IN (
    SELECT id FROM "DeliveryVerification" WHERE "tenantId" = v_tenant_id
  );
  RAISE NOTICE '  ✓ DeliveryVerificationItem deleted';
  
  -- 2. Imported invoice items
  DELETE FROM "ImportedInvoiceItem"
  WHERE "importedInvoiceId" IN (
    SELECT id FROM "ImportedInvoice" WHERE "tenantId" = v_tenant_id
  );
  RAISE NOTICE '  ✓ ImportedInvoiceItem deleted';
  
  -- 3. Verification items
  DELETE FROM "VerificationItem"
  WHERE "checklistId" IN (
    SELECT id FROM "VerificationChecklist" WHERE "tenantId" = v_tenant_id
  );
  RAISE NOTICE '  ✓ VerificationItem deleted';
  
  -- 4. Invoice items
  DELETE FROM "InvoiceItem"
  WHERE "invoiceId" IN (
    SELECT id FROM "Invoice" WHERE "tenantId" = v_tenant_id
  );
  RAISE NOTICE '  ✓ InvoiceItem deleted';
  
  -- 5. Order items
  DELETE FROM "OrderItem"
  WHERE "orderId" IN (
    SELECT id FROM "Order" WHERE "tenantId" = v_tenant_id
  );
  RAISE NOTICE '  ✓ OrderItem deleted';
  
  -- 6. Payments
  DELETE FROM "Payment"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ Payment deleted';
  
  -- 7. Inventory movements
  DELETE FROM "InventoryMovement"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ InventoryMovement deleted';
  
  -- 8. Order status history
  DELETE FROM "OrderStatusHistory"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ OrderStatusHistory deleted';
  
  -- 9. Order contacts
  DELETE FROM "OrderContact"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ OrderContact deleted';
  
  -- 10. Verification responses
  DELETE FROM "VerificationResponse"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ VerificationResponse deleted';
  
  -- =============================================================================
  -- PHASE 2: Mid-Level Dependencies
  -- =============================================================================
  
  RAISE NOTICE 'Phase 2: Deleting mid-level dependencies...';
  
  -- 11. Delivery verifications
  DELETE FROM "DeliveryVerification"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ DeliveryVerification deleted';
  
  -- 12. E-way bills
  DELETE FROM "EWayBill"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ EWayBill deleted';
  
  -- 13. Imported invoices
  DELETE FROM "ImportedInvoice"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ ImportedInvoice deleted';
  
  -- 14. Documents
  DELETE FROM "Document"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ Document deleted';
  
  -- 15. Invoices
  DELETE FROM "Invoice"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ Invoice deleted';
  
  -- 16. Orders
  DELETE FROM "Order"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ Order deleted';
  
  -- 17. Notifications
  DELETE FROM "Notification"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ Notification deleted';
  
  -- 18. Audit logs (tenant-scoped)
  DELETE FROM "AuditLog"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ AuditLog deleted';
  
  -- 19. Inventory
  DELETE FROM "Inventory"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ Inventory deleted';
  
  -- 20. Verification checklists
  DELETE FROM "VerificationChecklist"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ VerificationChecklist deleted';
  
  -- =============================================================================
  -- PHASE 3: Core Business Entities
  -- =============================================================================
  
  RAISE NOTICE 'Phase 3: Deleting core business entities...';
  
  -- 21. Warehouse locations
  DELETE FROM "WarehouseLocation"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ WarehouseLocation deleted';
  
  -- 22. Warehouses
  DELETE FROM "Warehouse"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ Warehouse deleted';
  
  -- 23. Products
  DELETE FROM "Product"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ Product deleted';
  
  -- 24. Categories
  DELETE FROM "Category"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ Category deleted';
  
  -- 25. Clients
  DELETE FROM "Client"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ Client deleted';
  
  -- 26. Company groups
  DELETE FROM "CompanyGroup"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ CompanyGroup deleted';
  
  -- 27. Users (tenant-scoped)
  DELETE FROM "User"
  WHERE "tenantId" = v_tenant_id;
  RAISE NOTICE '  ✓ User deleted';
  
  RAISE NOTICE 'Database reset complete for tenant: apex';
  RAISE NOTICE 'Tenant record PRESERVED';
  RAISE NOTICE 'NotificationSettings PRESERVED';
  RAISE NOTICE 'WarehouseSetting PRESERVED';
  
END $$;

COMMIT;

-- =============================================================================
-- POST-RESET VERIFICATION
-- =============================================================================

SELECT 'apex Tenant (should be 1)' as check_item, COUNT(*) as count
FROM "Tenant" WHERE slug = 'apex'
UNION ALL
SELECT 'Orders (should be 0)', COUNT(*) FROM "Order" 
WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'apex')
UNION ALL
SELECT 'Clients (should be 0)', COUNT(*) FROM "Client"
WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'apex')
UNION ALL
SELECT 'Users (should be 0)', COUNT(*) FROM "User"
WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'apex')
UNION ALL
SELECT 'Products (should be 0)', COUNT(*) FROM "Product"
WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'apex')
UNION ALL
SELECT 'Invoices (should be 0)', COUNT(*) FROM "Invoice"
WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'apex')
UNION ALL
SELECT 'Platform Admin (should be 1)', COUNT(*) FROM "User"
WHERE "tenantId" IS NULL AND role = 'PLATFORM_ADMIN';
```

---

## 9. SUPABASE AUTH CLEANUP (SEPARATE - MANUAL)

After running the main reset, check which auth users need cleanup:

```sql
-- List auth users that were linked to deleted WMS users
-- Run this AFTER the main reset script
WITH deleted_wms_users AS (
  -- This query won't return anything after deletion, 
  -- so save the output BEFORE running reset
  SELECT supabaseUserId FROM "User" 
  WHERE "tenantId" = '<APEX_TENANT_ID>' 
  AND supabaseUserId IS NOT NULL
)
SELECT * FROM auth.users
WHERE id IN (SELECT supabaseUserId FROM deleted_wms_users);
```

**Manual Cleanup Options:**

1. **Via Supabase Dashboard:**
   - Go to Authentication > Users
   - Search for emails from apex tenant (e.g., @example.test)
   - Delete users individually

2. **Via SQL (requires elevated permissions):**
```sql
-- WARNING: Only run if you're sure these are test accounts
-- Replace with actual UUIDs from the query above
DELETE FROM auth.users WHERE id IN (
  'uuid-1',
  'uuid-2',
  'uuid-3'
);
```

---

## 10. STORAGE CLEANUP (SEPARATE - MANUAL)

### 10.1 List Files in payment-proofs Bucket

Use Supabase Dashboard or SDK to list files:

**Via Supabase Dashboard:**
1. Go to Storage > payment-proofs
2. Review files by tenant folder
3. Delete apex tenant folder

**Via SDK:**
```javascript
// List files
const { data, error } = await supabase
  .storage
  .from('payment-proofs')
  .list('apex/', {
    limit: 100,
    offset: 0,
  });

// Delete files (example)
const filesToRemove = ['apex/file1.jpg', 'apex/file2.pdf'];
const { data, error } = await supabase
  .storage
  .from('payment-proofs')
  .remove(filesToRemove);
```

### 10.2 List Files in invoices Bucket

Same process as payment-proofs.

---

## 11. EXECUTION CHECKLIST

Before executing the reset:

- [ ] **VERIFIED: This is a DEVELOPMENT/TEST database**
- [ ] **VERIFIED: Database connection points to correct environment**
- [ ] **BACKUP: Created a database backup (if needed)**
- [ ] **DRY-RUN: Executed dry-run script and reviewed counts**
- [ ] **SAVED: Copied supabaseUserId list from WMS users (for auth cleanup)**
- [ ] **SAVED: Listed payment-proof and invoice files (for storage cleanup)**
- [ ] **REVIEWED: All sections of this plan**
- [ ] **APPROVED: User has explicitly approved execution**

### To Execute:

1. **Run DRY-RUN first:**
   - Replace `<APEX_TENANT_ID>` with actual tenant ID
   - Execute dry-run script
   - Review all counts
   - Save auth user IDs for later cleanup

2. **Run DELETE script:**
   - Execute final delete SQL script
   - Monitor for errors
   - Check post-reset verification output

3. **Verify reset:**
   - Check that tenant exists
   - Check that all business data counts are 0
   - Check that platform admin still exists

4. **Clean up auth users (manual):**
   - Review saved auth user IDs
   - Delete via Supabase Dashboard or SQL

5. **Clean up storage (manual):**
   - Review files in payment-proofs bucket
   - Review files in invoices bucket
   - Delete tenant-specific folders

---

## 12. RISKS AND MITIGATION

### 12.1 Identified Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Accidental production execution | **CRITICAL** | Triple-check database URL before execution |
| Foreign key constraint violations | **HIGH** | Follow exact deletion order in script |
| Orphaned auth users | **MEDIUM** | Manual cleanup script provided |
| Orphaned storage files | **MEDIUM** | Manual cleanup instructions provided |
| NotificationSettings deleted | **MEDIUM** | Script preserves them; tenant trigger recreates if needed |
| Cascade deletes not handled | **LOW** | Schema review shows proper ON DELETE CASCADE |
| Platform admin deleted | **LOW** | Script explicitly preserves (no tenantId) |

### 12.2 Rollback Strategy

**If executed in error:**
1. Immediately ROLLBACK transaction (if still in transaction)
2. Restore from backup (if backup was created)
3. Re-run seed script to recreate test data

**No automatic rollback** - this is a destructive operation

---

## 13. POST-RESET STATE

After successful execution, the database will be in this state:

**Tables with 0 rows (for apex tenant):**
- Client
- User (tenant-scoped)
- Order, OrderItem, OrderStatusHistory, OrderContact
- Invoice, InvoiceItem
- Payment
- VerificationResponse, VerificationChecklist, VerificationItem
- ImportedInvoice, ImportedInvoiceItem
- EWayBill
- DeliveryVerification, DeliveryVerificationItem
- Notification (tenant-scoped)
- AuditLog (tenant-scoped)
- Inventory, InventoryMovement
- Warehouse, WarehouseLocation
- Product
- Category
- CompanyGroup
- Document

**Preserved:**
- 1 Tenant row (apex)
- 1 NotificationSettings row (for apex)
- 1 WarehouseSetting row (for apex)
- 1 Platform admin User row
- 1 PlatformSetting row (if exists)
- All table structures
- All functions/RPCs
- All RLS policies
- All storage buckets

**Manual cleanup needed:**
- Supabase auth.users entries
- Files in payment-proofs bucket
- Files in invoices bucket

---

## 14. NEXT STEPS AFTER RESET

1. **Verify clean state:**
   ```sql
   SELECT COUNT(*) FROM "Order" 
   WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'apex');
   -- Should return 0
   ```

2. **Run seed script (optional):**
   ```bash
   npm run seed
   # OR
   npx prisma db seed
   ```
   This will recreate:
   - Sample users
   - Sample warehouse
   - Sample products
   - Sample client
   - Sample orders

3. **Test application:**
   - Login with owner account
   - Verify dashboard loads
   - Create test order
   - Verify all workflows

4. **Clean up auth users (manual)**

5. **Clean up storage files (manual)**

---

## 15. APPROVAL REQUIRED

**Status:** ⚠️ AWAITING APPROVAL

This plan is complete but **NOT APPROVED FOR EXECUTION**.

**Required before execution:**
1. User must explicitly approve this plan
2. User must confirm this is development/test database
3. User must acknowledge data loss is intentional
4. User must save dry-run results
5. User must be prepared to handle manual cleanup steps

**Approval Statement:**
```
I have reviewed this database reset plan and:
✓ Confirm this is a DEVELOPMENT/TEST database
✓ Understand this will delete all business data rows
✓ Understand tables/schema/functions will be preserved
✓ Understand auth users and storage files require manual cleanup
✓ Have saved necessary information from dry-run
✓ Approve execution of this reset plan

Approved by: ____________
Date: ____________
```

---

**END OF PLAN**
