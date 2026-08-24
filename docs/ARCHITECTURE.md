# Multi-Tenant WMS Architecture

## Tenant Model

`Tenant` represents an independent warehouse company. Every operational model includes `tenantId`, including clients, products, inventory, orders, invoices, payments, notifications, documents, settings, and audit logs. `PLATFORM_ADMIN` can query across tenants; every other role must match the resource tenant.

Physical warehouse support is modeled as:

`Tenant -> Warehouse -> WarehouseLocation -> Inventory`

This allows the first UI to show a single main warehouse while the database already supports multiple physical locations per company.

## Authentication

Staff and platform roles use Supabase Auth email/password. Client access uses mobile OTP only through tenant-aware API routes:

- `POST /api/client-otp/request`
- `POST /api/client-otp/verify`

The OTP request route first checks that the mobile number exists for the tenant and calls Supabase with `shouldCreateUser: false`.

## Authorization

Server-side authorization happens in three layers:

1. `requireUser` resolves the Supabase user to the local `User`.
2. RBAC checks validate role permissions.
3. Tenant checks constrain resource access unless the role is `PLATFORM_ADMIN`.

The UI hides irrelevant navigation, but this is convenience only. Backend services enforce the actual rules.

## Core Business Rule

Final invoice generation is blocked in `generateInvoice` unless:

`order.verificationStatus === VERIFIED`

Draft invoices can be created earlier, but a final invoice cannot be generated from an unverified, partially verified, or rejected order.

## State Machine

Order transitions are centralized in `lib/order-workflow.ts`. Server actions call `assertValidTransition` and record every change in both `OrderStatusHistory` and `AuditLog`.

## Inventory

Inventory changes must go through service functions that update stock and create an `InventoryMovement`. The current implementation rejects stock movements that would create negative available stock.

## Storage

Documents store Supabase Storage URLs and metadata. Buckets should be separated by purpose or prefixed by tenant:

- company-logos
- product-images
- client-documents
- delivery-documents
- verification-photos
- damage-evidence
- invoice-pdfs

Bucket policies must deny cross-tenant reads and writes.
