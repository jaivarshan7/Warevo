# WarehouseOS

Production-shaped multi-tenant Warehouse Management System built with Next.js, TypeScript, Prisma, PostgreSQL, Supabase Auth/Storage, Zod, Tailwind CSS, and Recharts.

## What Is Included

- Strict tenant data model with `tenantId` on operational records
- Final roles: `PLATFORM_ADMIN`, `WAREHOUSE_OWNER`, `WAREHOUSE_MODERATOR`, `ACCOUNTANT`, `WAREHOUSE_STAFF`, `CLIENT`
- Server-side RBAC and tenant checks
- Order state machine and status history
- Client mobile OTP login endpoints without client self-registration
- Client verification model and backend invoice restriction
- Inventory quantities, locations, and stock movement audit trail
- Invoices, GST fields, payments, receivables, notifications, reports, audit logs, settings, and documents
- Realistic seed data for 3 tenants and all roles

## Architecture

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the tenant model, authorization flow, invoice guard, order state machine, and storage plan.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Set `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

4. Create and seed the database:

```bash
npm run prisma:migrate
npm run prisma:seed
```

5. Run the app:

```bash
npm run dev
```

## Supabase Setup

- Enable email/password auth for platform and warehouse staff roles.
- Enable phone OTP auth for clients.
- Disable automatic user creation for the client OTP flow by keeping the application-side existence check and using `shouldCreateUser: false`.
- Create storage buckets for logos, product images, client documents, delivery documents, verification photos, damage evidence, invoice PDFs, and other documents.
- Configure storage policies so tenant users only access objects belonging to their tenant.

## Test Accounts

Seeded demo records use safe fictional addresses and `example.test` emails:

- `platform-admin@example.test`
- `owner-apex@example.test`
- `moderator-apex@example.test`
- `accountant-apex@example.test`
- `staff-apex@example.test`
- Client mobile: `+919800000001`

Set `DEMO_USER_EMAIL=owner-apex@example.test` in `.env` to run the seeded UI locally before wiring real Supabase sessions.

## Commands

```bash
npm run dev
npm run build
npm run test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Production Notes

- Never expose Supabase service-role keys to browser code.
- Every protected mutation should call server-side RBAC and tenant checks.
- Every inventory mutation should create an `InventoryMovement`.
- Every order status mutation should create `OrderStatusHistory` and `AuditLog`.
- Final invoice generation must remain blocked unless client verification is `VERIFIED`.
- Add rate limiting to OTP routes at the edge or API gateway before production launch.
