# WarehouseOS Project Documentation

This is the authoritative guide to the WarehouseOS repository. It documents the current implementation, not only the intended product design. Where a feature is represented in the schema but is incomplete, configuration-dependent, or not covered by tests, that status is called out explicitly.

## 1. Product Overview

WarehouseOS is a multi-tenant warehouse management system for warehouse operators, staff, accountants, client contacts, and platform administrators.

The application currently covers:

- Tenant and warehouse administration
- Client companies and client employees
- Product catalog and warehouse inventory
- Stock receiving, adjustment, damage, and movement history
- Orders and controlled order-status transitions
- Client delivery verification
- Draft and final invoices
- Payments and payment proof metadata
- Invoice PDF upload and text extraction
- Notifications and notification read state
- Operational, financial, and inventory reports
- Audit logs
- User profiles and avatar uploads
- Supabase Auth, Storage, and client SMS OTP integration points

The project is production-shaped, but it is not a complete production hardening package. See [Open Risks and Follow-up Work](#23-open-risks-and-follow-up-work).

## 2. Technology Stack

| Area | Technology |
| --- | --- |
| Web framework | Next.js 15 App Router |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 3, Lucide React, Recharts |
| Forms and validation | React Hook Form, Zod |
| Database | PostgreSQL |
| ORM | Prisma 6 |
| Authentication | Supabase Auth plus application demo/local fallback cookies |
| File storage | Supabase Storage |
| PDF processing | `pdfkit` and local PDF text extraction helpers |
| Tests | Vitest |
| Deployment | Vercel |

All application pages are server components unless a nested component or hook supplies client-side behavior. There is no `middleware.ts` file.

## 3. Repository Map

```text
app/                         Next.js pages, layouts, API handlers, and route handlers
components/                  Shared application and feature components
components/ui/               Small UI primitives: button, card, badge
hooks/                       Client-side React hooks
lib/                         Authentication, RBAC, services, parsing, reporting, storage
prisma/schema.prisma         PostgreSQL schema and enums
prisma/migrations/           Versioned database migrations
prisma/seed.ts               Development/demo data seed
scripts/                     Maintenance scripts
__tests__/                   Vitest unit tests
docs/                        Project documentation
.env.example                 Environment variable template
next.config.ts               Next.js configuration
tailwind.config.ts           Tailwind configuration
vitest.config.ts             Vitest configuration
vercel.json                  Vercel output configuration
```

## 4. Local Setup

### Prerequisites

- Node.js compatible with the installed Next.js and TypeScript versions
- npm
- PostgreSQL, locally or through a hosted provider
- A Supabase project for Auth and Storage features

### Installation

```bash
npm install
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env` instead of `Copy-Item`.

Set the values described in [Environment Variables](#5-environment-variables), then create the database schema:

```bash
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The development server runs on the default Next.js port, normally `http://localhost:3000`.

### Production-style local run

```bash
npm run build
npm run start
```

`npm run build` runs `prisma generate` before `next build`.

## 5. Environment Variables

`.env.example` is the source template. The following variables are used by the repository:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser/server Supabase public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for admin storage operations | Server-only Supabase service-role key |
| `NEXT_PUBLIC_APP_URL` | Yes for absolute redirects | Public application URL, including scheme |
| `ADMIN_EMAIL` | Yes for admin login | Application admin-console credential email |
| `ADMIN_PASSWORD` | Yes for admin login | Application admin-console credential password |
| `DEMO_USER_EMAIL` | Optional | Local/demo fallback user email |
| `NODE_ENV` | Supplied by runtime | Runtime mode used by libraries and tooling |

Never expose `SUPABASE_SERVICE_ROLE_KEY` to client components, browser code, logs, or public repositories. Vercel variables must be configured separately for the relevant Preview/Staging and Production environments.

## 6. Commands

| Command | Effect |
| --- | --- |
| `npm run dev` | Start Next.js development server |
| `npm run build` | Generate Prisma Client and build Next.js |
| `npm run start` | Start the production Next.js server after a build |
| `npm run lint` | Run the configured Next lint command |
| `npm run test` | Run Vitest once |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Apply/create development migrations through Prisma |
| `npm run prisma:seed` | Clear and repopulate the database with demo records |

The seed script is destructive: it deletes existing application data before recreating demo data. Do not run it against a production database.

## 7. Deployment

Vercel builds the repository with `npm run build`. [vercel.json](../vercel.json) declares `.next` as the output directory and does not add a catch-all rewrite. Next.js App Router routing must remain under Next.js control; a rewrite of every request to `/index` causes redirect loops and breaks route resolution.

Vercel setup checklist:

1. Connect the repository and deploy the intended branch.
2. Add all required environment variables to the correct Vercel environment.
3. Use a reachable hosted PostgreSQL connection string in `DATABASE_URL`.
4. Confirm the Supabase URL and keys belong to the same environment as the database.
5. Confirm Supabase Auth providers and Storage buckets/policies are configured.
6. Deploy and inspect both build logs and a live request to `/login`.
7. Verify that dynamic database-backed routes can reach PostgreSQL at runtime.

Known non-blocking build warnings currently include the deprecated Prisma `package.json#prisma` configuration and npm package deprecation notices. They should be addressed during a planned dependency/configuration upgrade, not by changing application behavior during an incident.

## 8. Application Routes

### Public and entry routes

| Route | Implementation | Purpose |
| --- | --- | --- |
| `/` | `app/page.tsx` | Redirects to `/dashboard` |
| `/login` | `app/login/page.tsx` | Local/demo user login by email or mobile |
| `/admin-login` | `app/admin-login/page.tsx` | Admin console credential login |
| `/logout` | `app/logout/route.ts` | Clears selected cookies and redirects to login |

### Platform and admin routes

| Route | Purpose |
| --- | --- |
| `/platform` | Platform-level tenant overview |
| `/admin-dashboard` | Admin console dashboard |
| `/admin-dashboard/add-client` | Create a client company/contact |
| `/admin-dashboard/add-employee` | Add an employee to an existing client company |
| `/admin-dashboard/add-user` | Create a user |
| `/admin-dashboard/add-warehouse` | Create a warehouse |
| `/admin-dashboard/edit-client/[id]` | Edit a client |
| `/admin-dashboard/edit-user/[id]` | Edit a user |
| `/admin-dashboard/edit-warehouse/[id]` | Edit a warehouse |

### Warehouse dashboard routes

| Route | Purpose |
| --- | --- |
| `/dashboard` | Role-aware dashboard summary |
| `/dashboard/accounting` | Accounting and invoice view |
| `/dashboard/change-log` | Audit log view |
| `/dashboard/clients` | Client directory and client mutations |
| `/dashboard/inventory` | Inventory listing |
| `/dashboard/inventory/new` | Create product/inventory records |
| `/dashboard/inventory/update` | Update inventory |
| `/dashboard/invoice-import` | Imported invoice list |
| `/dashboard/invoice-import/upload` | Upload invoice document route handler |
| `/dashboard/invoice-import/extract` | Extract and parse invoice text route handler |
| `/dashboard/invoices/[id]` | Invoice details and payment actions |
| `/dashboard/notifications` | Notification center and read actions |
| `/dashboard/orders` | Order listing and status operations |
| `/dashboard/orders/[id]` | Order details |
| `/dashboard/orders/new` | Create an order |
| `/dashboard/orders/track` | Track and verify orders |
| `/dashboard/profile` | User profile |
| `/dashboard/profile/upload-avatar` | Avatar upload route handler |
| `/dashboard/reports` | Financial and operational reports |
| `/dashboard/settings` | Warehouse settings |

The dashboard layout is in `app/dashboard/layout.tsx`. Route-level access is enforced through server-side helpers and page-specific role checks; there is no central middleware guard.

## 9. API and Route Handlers

### `POST /api/client-otp/request`

Input JSON:

```json
{
  "tenantSlug": "apex",
  "mobile": "+919800000001"
}
```

Behavior:

1. Validate `tenantSlug` and `mobile` with Zod.
2. Find an active tenant.
3. Find an active client matching the tenant/mobile compound key.
4. Ask Supabase Auth to send an SMS OTP with `shouldCreateUser: false`.
5. Return `{ "ok": true }` or an error response.

### `POST /api/client-otp/verify`

Input JSON:

```json
{
  "tenantSlug": "apex",
  "mobile": "+919800000001",
  "token": "123456"
}
```

The handler validates the tenant, client, and token through Supabase, then associates the Supabase user ID with the local client user when the local user has role `CLIENT`.

Current caveat: verification checks tenant/client existence but does not repeat the active tenant and active client status checks used by the request endpoint.

### `POST /dashboard/invoice-import/upload`

Requires an authenticated user. Accepts a PDF invoice up to 10 MB, uploads it to Supabase Storage, and creates a `Document` record.

### `POST /dashboard/invoice-import/extract`

Requires an authenticated user. Extracts text from a PDF or UTF-8 input and parses invoice fields and line items. The route explicitly uses the Node.js runtime because PDF processing is not an edge-only operation.

### `POST /dashboard/profile/upload-avatar`

Requires an authenticated user. Accepts JPEG, PNG, or WebP up to 2 MB, uploads the file, and updates `User.avatarUrl`.

## 10. Authentication and Session Resolution

The primary implementation is [lib/auth.ts](../lib/auth.ts).

`getCurrentUser()` resolves identity in this order:

1. Supabase Auth session user ID mapped through `User.supabaseUserId`.
2. `x-demo-user-id` header or `demo-user-id` cookie.
3. `x-demo-user-email` header, `demo-user-email` cookie, or `DEMO_USER_EMAIL`.
4. `x-demo-user-mobile` header or `demo-user-mobile` cookie, including common `+91` normalization.
5. `null` if no local user matches.

`requireUser()` redirects unauthenticated users to `/login` and optionally checks an allowed role list.

The standard `/login` server action performs a direct local database lookup and sets demo cookies. It is useful for local/demo operation but is not the same as a complete Supabase email/password login flow.

The `/admin-login` server action compares submitted credentials to `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then stores an admin cookie. Admin authorization is currently separate from the normal local user session and should be reviewed before production use.

## 11. Roles and Permissions

Roles are defined in `prisma/schema.prisma`; the central permission matrix is in `lib/rbac.ts`.

| Role | Main scope |
| --- | --- |
| `PLATFORM_ADMIN` | Cross-tenant platform administration and reporting |
| `MANAGER` | Broad tenant operations and configuration |
| `GM` | Broad tenant operations and configuration |
| `WAREHOUSE_OWNER` | Tenant administration, inventory, orders, accounting, reports |
| `WAREHOUSE_MODERATOR` | Client, order, inventory operations, imports, operational reports |
| `ACCOUNTS_TEAM` | Financial order view, invoices, imports, payments, accounting |
| `WAREHOUSE_STAFF` | Inventory and order operations |
| `PRODUCT_RECEIVER` | Order operation and verification confirmation |
| `ACCOUNTANT` | Financial order view, invoices, imports, payments, reports |
| `CLIENT` | Client dashboard, orders, delivery verification, invoices |
| `CLIENT_ACCOUNTANT` | Client-side accounting, payments, financial reports, invoices |

The permission matrix includes platform, tenant, user, client, product, inventory, order, verification, invoice, payment, report, audit, and client-facing capabilities.

Dashboard route restrictions are implemented by `canAccessDashboardRoute()` in `lib/rbac.ts`. Examples:

- `PRODUCT_RECEIVER` is restricted to order tracking.
- `WAREHOUSE_STAFF` can use orders and tracking but not inventory management pages.
- A `CLIENT` with employee role `RECEIVER` is limited to the dashboard and tracking.
- `CLIENT_ACCOUNTANT` is limited to accounting.

`lib/services.ts` has an additional small inventory permission map for service-level checks. Keep it synchronized with `lib/rbac.ts` when adding roles or permissions.

## 12. Tenant Isolation

`Tenant` is the top-level organization. Most operational records include `tenantId` and relate back to a tenant.

Rules:

- `PLATFORM_ADMIN` may access resources across tenants.
- Other users must have a matching session `tenantId`.
- Client users are further scoped to their linked client and matching company/company-group records.
- Service functions must validate tenant ownership before reading or mutating records.
- Tenant deletion cascades through most tenant-owned records; audit logs use `SetNull` for tenant/user references.

The main helpers are `canAccessTenant()`, `assertTenantAccess()`, `getClientOrderVisibility()`, and the service-level tenant checks.

## 13. Business Workflows

### Order lifecycle

The valid transition table is in `lib/order-workflow.ts`:

```text
DRAFT -> ISSUED -> PROCESSING -> READY_FOR_DISPATCH -> DISPATCHED
DISPATCHED -> RECEIVED -> VERIFICATION_PENDING
VERIFICATION_PENDING -> VERIFIED | PARTIALLY_VERIFIED | REJECTED
VERIFIED -> INVOICE_PENDING -> INVOICED -> PAYMENT_PENDING -> PAID -> COMPLETED
PARTIALLY_VERIFIED -> PROCESSING | CANCELLED
REJECTED -> PROCESSING | CANCELLED
DRAFT, ISSUED, PROCESSING -> CANCELLED where configured
```

`assertValidTransition()` rejects arbitrary jumps. `transitionOrder()` also writes `OrderStatusHistory` and `AuditLog` entries in one transaction and revalidates the order list.

### Client delivery verification

`submitVerification()` is restricted to `CLIENT` users and requires the order to be `RECEIVED` or `VERIFICATION_PENDING`. It upserts `VerificationResponse`, updates the order verification/status fields, records history/audit entries, notifies the order audience, and revalidates the order page.

### Invoice generation

`generateInvoice()` is restricted to `WAREHOUSE_OWNER` and `ACCOUNTANT` and requires `invoices:manage`.

- Draft invoices may be created before verification.
- Final invoices require `order.verificationStatus === VERIFIED`.
- A blocked final-invoice attempt is audited.
- Invoice creation copies order totals/items and creates tax split values.
- The current invoice number format is `INV-2026-######`; it should be made configurable before a year rollover.

### Inventory

`receiveOrAdjustStock()` requires a warehouse owner, moderator, or staff role and an inventory permission. It validates positive quantities, checks tenant ownership, prevents negative available stock, updates quantities, creates an `InventoryMovement`, creates an `AuditLog`, and runs these writes in a transaction.

### Notifications

Notifications can target users, orders, or warehouses. Server helpers support creation, audience fan-out, unread counts, list queries, and mark-read operations. The client hook is `hooks/use-notifications.ts`; UI components include `notification-bell.tsx` and `notification-center.tsx`.

### Invoice import

The import flow stores the original document, extracts PDF text, parses invoice metadata/items, and tracks review/confirmation state through `ImportedInvoice` and `ImportedInvoiceItem`. Parsing is intentionally conservative when input is binary or unreadable.

## 14. Data Model

The complete source of truth is `prisma/schema.prisma`. The model groups are:

### Organization and identity

- `Tenant`: warehouse company and tenant boundary.
- `CompanyGroup`: groups related client companies within a tenant.
- `User`: local identity, role, tenant, and optional Supabase identity.
- `Client`: client company/contact and optional linked user.

### Warehouse and catalog

- `Warehouse`: physical warehouse.
- `WarehouseLocation`: zone/rack/shelf/bin location.
- `Category`: tenant-scoped product category.
- `Product`: SKU, pricing, GST, stock thresholds, and product metadata.
- `Inventory`: quantities per warehouse/location/product.
- `InventoryMovement`: stock movement audit history.

### Orders and verification

- `Order`: commercial order totals, status, assignment, and tenant/client links.
- `OrderContact`: additional clients/contacts associated with an order.
- `OrderItem`: product, quantity, price, tax, discount, and total.
- `OrderStatusHistory`: immutable transition history.
- `VerificationChecklist`: tenant checklist template.
- `VerificationItem`: checklist item.
- `VerificationResponse`: client verification payload and attachments.
- `DeliveryVerification`: delivery-level verification, including imported invoices.
- `DeliveryVerificationItem`: item quantities and condition status.

### Billing and imports

- `Invoice`: draft/final invoice and payment state.
- `InvoiceItem`: invoice line item and tax split.
- `Payment`: invoice payment, method, reference, proof URL, and state.
- `ImportedInvoice`: uploaded/extracted invoice workflow.
- `ImportedInvoiceItem`: extracted invoice line item requiring possible review.
- `EWayBill`: e-way bill metadata and external request/response payloads.

### Platform operations

- `Notification`: user/order/warehouse notifications.
- `Document`: tenant-owned uploaded file metadata.
- `AuditLog`: actor, action, entity, before/after JSON, and request metadata.
- `PlatformSetting`: platform-wide or tenant-linked feature/notification settings.
- `WarehouseSetting`: tenant order/invoice prefixes, GST, and notification preferences.

## 15. Storage

Storage helpers are in `lib/storage.ts`.

Configured bucket names:

- `invoices`
- `eway-bills`
- `product-images`
- `user-avatars`
- `warehouse-documents`

The helper can create missing buckets as public buckets. Verify this behavior against the production privacy requirements before storing sensitive documents. Tenant-specific object paths and Supabase Storage policies must prevent cross-tenant access. `validateFileUpload()` enforces MIME-type and size checks at the application layer, but storage policies and server authorization remain necessary.

## 16. Validation and Parsing

`lib/validation.ts` contains Zod schemas for client creation, order transitions, verification, and invoice generation. Server actions should parse untrusted form/action data with these schemas before database writes.

`lib/invoice-parser.ts` parses invoice text and supports delimited rows and a known Pure Aura vertical-table format. `lib/pdf-text-extractor.ts` extracts readable PDF text and handles ToUnicode CMaps. Image-only/scanned PDFs may not produce usable text without OCR; OCR is not currently implemented.

## 17. Reporting and Audit

`lib/reporting.ts` builds summaries for:

- Revenue
- Verification-pending orders
- Completed orders
- Low-stock products
- Receivables

`lib/audit-log.ts` formats audit changes for display and supports text/entity/role filtering. Core service mutations should continue to write audit entries transactionally with the business change whenever possible.

## 18. Database Migrations

Migrations currently cover:

- Initial Warevo schema
- Notification/profile fields
- Client employee roles
- Client accountant role
- Payment proof URL

Use `npm run prisma:migrate` for development migrations. Review generated migrations before applying them to shared or production environments. Prisma Client generation is part of the build.

## 19. Seed Data

`prisma/seed.ts` clears application data and creates:

- One platform administrator
- Three tenant scenarios in the full seed flow
- Tenant owners, moderators, accountants, warehouse staff, and client users
- Warehouses, locations, categories, products, inventory, and movements
- Sample orders in different lifecycle states
- A verified order and final invoice for one tenant
- Verification checklist data
- Notifications and audit records

Seed email accounts use `example.test` addresses. Client access uses seeded mobile numbers. The seed is intended for development and demo environments only.

## 20. Tests

Run:

```bash
npm run test
```

`__tests__/workflow.test.ts` currently covers:

- Tenant isolation
- Selected RBAC and dashboard route behavior
- Notification helper formatting, URLs, and mark-read behavior
- Valid and invalid order transitions
- Audit-log summaries and filtering
- Report KPI aggregation
- Multi-contact order selection
- Invoice parsing, including binary/unreadable input
- PDF text extraction with a ToUnicode CMap

There are currently no visible browser, end-to-end, API integration, database integration, authentication, storage-policy, or deployment smoke tests.

## 21. Configuration Files

| File | Responsibility |
| --- | --- |
| `next.config.ts` | Next.js configuration; Server Actions body limit is 8 MB |
| `tailwind.config.ts` | Tailwind content/theme configuration |
| `postcss.config.js` | PostCSS/Tailwind processing |
| `tsconfig.json` | TypeScript compiler settings and `@/*` path alias |
| `vitest.config.ts` | Vitest Node environment, fork pool, and alias |
| `vercel.json` | Vercel version and `.next` output directory |
| `package.json` | Scripts, dependencies, Prisma seed command |
| `prisma/schema.prisma` | Database schema and generated client source |

## 22. Frontend Structure

The reusable shell and feature components live under `components/`:

- `app-shell.tsx`: dashboard navigation/layout shell
- `admin-dashboard-view.tsx`: admin overview UI
- `clients-directory-view.tsx`: client list/actions
- `order-form.tsx`: order creation UI
- `order-tracker-view.tsx`: tracking and verification UI
- `order-status-chart.tsx`: chart visualization
- `accounting-invoice-table.tsx`: invoice/accounting table
- `invoice-actions.tsx`: invoice actions
- `notification-bell.tsx`, `notification-center.tsx`: notification UI
- `audit-log-table.tsx`, `owner-change-log.tsx`: audit views
- `user-account-form.tsx`, `user-profile-menu.tsx`: account UI
- `avatar-upload-form.tsx`, `file-upload-field.tsx`: uploads
- `components/ui/button.tsx`, `card.tsx`, `badge.tsx`: UI primitives

The visual system uses Tailwind utility classes and the local UI primitives rather than a large component framework.

## 23. Open Risks and Follow-up Work

These are documented implementation facts, not claims that the current code already solves them:

1. Add rate limiting and abuse monitoring to OTP request and verification endpoints.
2. Recheck active tenant/client status during OTP verification.
3. Replace or harden the admin cookie credential flow before production use; use a centralized authenticated admin session.
4. Add a central route authorization strategy or middleware where appropriate.
5. Review all page and service role checks for consistency with the central RBAC matrix.
6. Keep the inventory permission map in `lib/services.ts` synchronized with `lib/rbac.ts`.
7. Make invoice numbering tenant- and year-aware instead of hard-coding `INV-2026-`.
8. Add concurrency-safe invoice number allocation.
9. Review public Supabase Storage bucket creation and tenant access policies.
10. Add OCR or an explicit manual review workflow for scanned/image-only invoices.
11. Add API, database, storage, authentication, browser, and deployment smoke tests.
12. Move Prisma configuration from the deprecated `package.json#prisma` property to the Prisma 7 configuration format during a planned upgrade.
13. Review npm deprecation notices and package versions before upgrading Prisma, Next.js, or ESLint.
14. Confirm all Vercel environment variables exist in Preview/Staging and Production, not only in the local `.env`.

## 24. Change Checklist

When adding a feature:

- Add or update the Prisma schema and migration if persistent data changes.
- Add tenant ownership and indexes for tenant-scoped records.
- Add server-side role and tenant checks before any mutation.
- Validate external input with Zod.
- Add an audit record for important mutations.
- Add notification fan-out when the workflow affects another user.
- Add a focused unit test for pure logic and an integration test for database/API behavior when applicable.
- Update this document, `README.md`, and `docs/ARCHITECTURE.md`.
- Run `npm run test` and `npm run build` before deployment.
