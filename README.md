# WarehouseOS

WarehouseOS is a multi-tenant warehouse management system built with Next.js, TypeScript, Prisma, PostgreSQL, Supabase Auth/Storage, Zod, Tailwind CSS, and Recharts.

## Documentation

- [Complete Project Documentation](docs/PROJECT_DOCUMENTATION.md) - authoritative setup, routes, APIs, schema, workflows, deployment, tests, and known risks.
- [Architecture Overview](docs/ARCHITECTURE.md) - short explanation of the main boundaries and business rules.

## Quick Start

```bash
npm install
Copy-Item .env.example .env
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

On macOS/Linux, replace `Copy-Item .env.example .env` with `cp .env.example .env`.

Before running the app, set the database, Supabase, application URL, and admin credential variables described in [.env.example](.env.example) and the [environment variable reference](docs/PROJECT_DOCUMENTATION.md#5-environment-variables).

## Main Capabilities

- Tenant-isolated warehouses, clients, products, inventory, orders, invoices, payments, notifications, documents, and audit logs.
- Server-side RBAC for platform administrators, warehouse roles, accounting roles, and client roles.
- Controlled order lifecycle with status history and audit records.
- Client delivery verification and final-invoice gating.
- Inventory movement tracking with negative-stock protection.
- Invoice PDF upload, text extraction, parsing, and review state.
- Supabase SMS OTP integration for existing client contacts.

## Commands

```bash
npm run dev
npm run build
npm run start
npm run test
npm run lint
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

The seed command is destructive and is for development/demo databases only. It deletes existing application records before creating sample tenants and users.

## Deployment

The project is configured for Vercel. Add `DATABASE_URL`, Supabase variables, `NEXT_PUBLIC_APP_URL`, and admin credentials to the Vercel environment used by the deployment. `vercel.json` points to the Next.js `.next` output and intentionally contains no catch-all rewrite.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code. Review the documented production risks, especially OTP rate limiting, admin-session hardening, storage policies, and missing integration/e2e coverage, before treating the deployment as production-ready.
