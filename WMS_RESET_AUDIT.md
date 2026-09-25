# WMS Reset Audit & Inventory Report

**Date & Time**: 2026-09-25T21:30:00+05:30  
**Environment**: Staging / Development (Local Dev & Supabase Remote Project)  
**Supabase Project Reference**: `rglumbheyypdanfpmuef`  
**Supabase Host**: `https://rglumbheyypdanfpmuef.supabase.co`  
**Git Branch**: `staging`  
**Git Working Tree**: Clean  

---

## 1. Environment & Safety Assessment

| Parameter | Value | Status |
| :--- | :--- | :--- |
| **Git Branch** | `staging` | Verified non-production |
| **Supabase Project Ref** | `rglumbheyypdanfpmuef` | Verified staging project |
| **Supabase Project Name** | `techblaze87@gmail.com's Project` (region: ap-south-1) | Active / Healthy |
| **Next Public App URL** | `http://localhost:3000` | Local dev / staging |
| **Vercel Project** | `wms` (`prj_wQRTuMMJ0T7hDcykO1fZoSjXkq50`) | Connected |
| **Safety Gate** | Passed (Non-production environment) | Safe to proceed with dry run |

---

## 2. Platform Admin Candidates (Step 4 Gate)

In accordance with **STEP 4**, more than one user with `role = 'PLATFORM_ADMIN'` was detected in the database. As required:
> **"If there are >1 PLATFORM_ADMIN: DO NOT arbitrarily choose one. Instead report all candidates and STOP, asking me which admin should be preserved."**

### Candidate 1: Platform Admin
* **WMS User ID**: `cmtpry8fi0001ehlc44z2nurr`
* **Name**: Platform Admin
* **Email**: `platform-admin@example.test`
* **Role**: `PLATFORM_ADMIN`
* **Status**: `ACTIVE`
* **Tenant ID**: `null` (Cross-tenant platform administrator)
* **WMS User `supabaseUserId`**: `dff7b65b-a268-4e24-9679-d8b9d11ef139`
* **Supabase Auth User ID**: `dff7b65b-a268-4e24-9679-d8b9d11ef139`
* **Auth Relationship**: Verified exact match (`User.supabaseUserId === auth.users.id`)
* **Auth Created**: `2026-09-20T14:44:16.149Z`
* **Auth Last Sign In**: `2026-09-25T10:57:14.210Z`

### Candidate 2: Jaivarshan B
* **WMS User ID**: `c93e919a-0a8d-4f4f-9b8f-0c9e7300c759`
* **Name**: Jaivarshan B
* **Email**: `ts305715@gmail.com`
* **Role**: `PLATFORM_ADMIN`
* **Status**: `ACTIVE`
* **Tenant ID**: `7398ea38-92ce-4a6f-96ac-135c051c36ac` (Belongs to tenant "pure aura")
* **WMS User `supabaseUserId`**: `cfbd4054-c84a-440a-809b-f69e71a29136`
* **Supabase Auth User ID**: `cfbd4054-c84a-440a-809b-f69e71a29136`
* **Auth Relationship**: Verified exact match (`User.supabaseUserId === auth.users.id`)
* **Auth Created**: `2026-09-15T16:03:21.361Z`
* **Auth Last Sign In**: `2026-09-25T14:31:13.601Z`

---

## 3. Database Table Inventory & Classification

All 36 public tables have been audited.

| Table Name | Current Rows | Classification | Target Rows | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_prisma_migrations` | 6 | **DO NOT TOUCH** | 6 | Prisma migration history table |
| `PlatformSetting` | 1 | **PRESERVE** | 1 | Singleton platform configuration |
| `Permission` | 12 | **PRESERVE** | 12 | System permission definitions |
| `RoleDefinition` | 6 | **PRESERVE** | 6 | System role definitions (MD, GM, MANAGER, etc.) |
| `RolePermission` | 46 | **PRESERVE** | 46 | Role-to-permission security mappings |
| `User` | 22 | **DELETE EXCEPT ADMIN** | 1 | Preserves 1 verified PLATFORM_ADMIN, deletes 21 |
| `Tenant` | 3 | **DELETE ALL / CONDITIONAL** | 0 or 1 | 0 if Candidate 1 (null tenantId) is chosen; 1 if Candidate 2's tenant is preserved |
| `WarehouseSetting` | 1 | **DELETE ALL / CONDITIONAL** | 0 or 1 | Deleted unless associated with preserved tenant |
| `NotificationSettings` | 3 | **DELETE ALL / CONDITIONAL** | 0 or 1 | Deleted unless associated with preserved tenant |
| `Warehouse` | 2 | **DELETE ALL** | 0 | Test warehouses |
| `WarehouseLocation` | 0 | **DELETE ALL** | 0 | Empty |
| `Category` | 0 | **DELETE ALL** | 0 | Empty |
| `Product` | 17 | **DELETE ALL** | 0 | Test products |
| `Inventory` | 0 | **DELETE ALL** | 0 | Empty |
| `InventoryMovement` | 0 | **DELETE ALL** | 0 | Empty |
| `CompanyGroup` | 15 | **DELETE ALL** | 0 | Test client company groups |
| `Client` | 5 | **DELETE ALL** | 0 | Test client companies |
| `ClientEmployee` | 13 | **DELETE ALL** | 0 | Test client employee records |
| `Order` | 7 | **DELETE ALL** | 0 | Test orders |
| `OrderItem` | 10 | **DELETE ALL** | 0 | Test order line items |
| `OrderStatusHistory` | 19 | **DELETE ALL** | 0 | Test order workflow history |
| `VerificationChecklist` | 0 | **DELETE ALL** | 0 | Empty |
| `VerificationItem` | 0 | **DELETE ALL** | 0 | Empty |
| `VerificationResponse` | 5 | **DELETE ALL** | 0 | Test verification records |
| `Invoice` | 7 | **DELETE ALL** | 0 | Test invoices |
| `InvoiceItem` | 10 | **DELETE ALL** | 0 | Test invoice line items |
| `Payment` | 2 | **DELETE ALL** | 0 | Test payments |
| `Notification` | 25 | **DELETE ALL** | 0 | Test notification records |
| `Document` | 0 | **DELETE ALL** | 0 | Empty |
| `AuditLog` | 135 | **DELETE ALL** | 0 | Test activity logs (orders, invoices, employee changes) |
| `ImportedInvoice` | 0 | **DELETE ALL** | 0 | Empty |
| `ImportedInvoiceItem` | 0 | **DELETE ALL** | 0 | Empty |
| `EWayBill` | 0 | **DELETE ALL** | 0 | Empty |
| `DeliveryVerification` | 0 | **DELETE ALL** | 0 | Empty |
| `DeliveryVerificationItem`| 0 | **DELETE ALL** | 0 | Empty |
| `EmailLog` | 3 | **DELETE ALL** | 0 | Test email delivery logs |

---

## 4. Supabase Storage Inventory

| Bucket | Access | Files / Objects Found | Planned Action |
| :--- | :--- | :--- | :--- |
| `payment-proofs` | Private (RLS protected) | 4 files across subdirectories:<br>• `7398ea38-92ce-4a6f-96ac-135c051c36ac/inv_0d9c171725c6d727/pay_b6a89f69ec757071/1790326828789-jx60mu.png`<br>• `.../pay_214c5b78445978fc/1789639168127-2g4u68.jpeg`<br>• `.../pay_1bdb0cb1f73b0127/1789469777448-v1bift.jpeg`<br>• `.../pay_f1923c21cbebffd4/1789712301553-y6xzv3.pdf` | **DELETE OBJECTS ONLY**<br>(Keep bucket & storage policies intact) |
| `invoices` | Private (RLS protected) | 1 file:<br>• `payment-proofs/cmtka6p96002zehiogvtfuck6-1788449766838.png` | **DELETE OBJECTS ONLY**<br>(Keep bucket & storage policies intact) |

---

## 5. Supabase Auth Inventory

* **Total Auth Users**: 21
* **Platform Admin Auth Users**: 2
  - `dff7b65b-a268-4e24-9679-d8b9d11ef139` (`platform-admin@example.test`)
  - `cfbd4054-c84a-440a-809b-f69e71a29136` (`ts305715@gmail.com`)
* **Other Test Auth Users**: 19 (e.g. `test_owner@warevo.test`, `ken@gmail.com`, `ash@gmail.com`, etc.)
* **Planned Action**: Delete exactly 20 test auth users via `supabase.auth.admin.deleteUser(id)`. Preserve exactly the 1 selected PLATFORM_ADMIN auth user.

---

## 6. Foreign-Key Dependency Analysis & Safe Deletion Order

71 foreign-key constraints were mapped. The safe top-down dependency deletion order is:

1. `EmailLog` (FKs to Notification, Order, User, Tenant)
2. `Notification` (FKs to Order, User, Tenant)
3. `AuditLog` (FKs to User, Tenant)
4. `Payment` (FKs to Invoice, Tenant)
5. `InvoiceItem` (FKs to Invoice, Product)
6. `DeliveryVerificationItem` (FKs to DeliveryVerification, ImportedInvoiceItem)
7. `DeliveryVerification` (FKs to Client, ImportedInvoice, Invoice, Order, Tenant)
8. `EWayBill` (FKs to ImportedInvoice, Invoice, Tenant)
9. `ImportedInvoiceItem` (FKs to ImportedInvoice)
10. `ImportedInvoice` (FKs to Client, Invoice, Order, Document, Tenant, User)
11. `Document` (FKs to Order, Tenant)
12. `Invoice` (FKs to Client, Order, Tenant)
13. `VerificationResponse` (FK to Order)
14. `VerificationItem` (FK to VerificationChecklist)
15. `VerificationChecklist`
16. `OrderStatusHistory` (FK to Order)
17. `OrderItem` (FKs to Order, Product)
18. `InventoryMovement` (FKs to Inventory, Order, Product)
19. `Order` (FKs to Client, User, Tenant)
20. `Inventory` (FKs to WarehouseLocation, Product, Warehouse)
21. `WarehouseLocation` (FK to Warehouse)
22. `Product` (FKs to Category, Tenant)
23. `Category` (FK to Tenant)
24. `ClientEmployee` (FKs to Client, Tenant, User, RoleDefinition)
25. `Client` (FKs to CompanyGroup, Tenant)
26. `CompanyGroup` (FK to Tenant)
27. `WarehouseSetting` (FK to Tenant)
28. `Warehouse` (FK to Tenant)
29. `NotificationSettings` (FK to Tenant)
30. `User` (FK to Tenant) — delete all users except the 1 chosen PLATFORM_ADMIN
31. `Tenant` — delete all tenants (or preserve only the chosen admin's tenant if applicable)
32. Supabase Storage test files (via Storage API)
33. Supabase Auth users (via `supabase.auth.admin.deleteUser`)
