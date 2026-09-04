# Multi-Tenant WMS Architecture

This is the short architecture reference. See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for the complete route, schema, API, setup, deployment, and risk inventory.

## Runtime Shape

The system is a Next.js 15 App Router application. Pages and server actions run against Prisma/PostgreSQL. Supabase supplies Auth and Storage. React components and hooks provide client-side interaction where needed. There is no middleware file; pages and service functions perform authentication and authorization checks directly.

```text
Browser
	-> Next.js App Router pages and route handlers
		-> lib/auth.ts, lib/rbac.ts, lib/services.ts
			-> Prisma -> PostgreSQL
			-> Supabase Auth / Storage
```

## Tenant Model

`Tenant` represents an independent warehouse company. Tenant-owned operational records carry `tenantId`, and non-platform users must match the resource tenant. `PLATFORM_ADMIN` is the cross-tenant exception.

Physical warehouse support is modeled as:

`Tenant -> Warehouse -> WarehouseLocation -> Inventory -> Product`

Business relationships continue through:

`Tenant -> Client -> Order -> OrderItem -> Invoice -> Payment`

## Authentication and Authorization

`getCurrentUser()` first maps the Supabase Auth identity to the local `User`, then supports explicit local/demo headers, cookies, and `DEMO_USER_EMAIL`. `requireUser()` redirects unauthenticated users to `/login` and can restrict allowed roles.

Client access uses tenant-aware mobile OTP endpoints:

- `POST /api/client-otp/request`
- `POST /api/client-otp/verify`

The request path checks that the tenant and client are active and asks Supabase not to create unknown users. The verification path links the verified Supabase user to the local client user.

Authorization has three practical layers:

1. Session resolution through `lib/auth.ts`.
2. Role permissions and dashboard-route checks through `lib/rbac.ts`.
3. Tenant ownership checks in services and resource operations.

Navigation restrictions are not a security boundary. Server-side checks must remain on every protected mutation.

## Order and Invoice Invariants

Order transitions are centralized in `lib/order-workflow.ts`. `assertValidTransition()` prevents arbitrary jumps. `transitionOrder()` records `OrderStatusHistory` and `AuditLog` entries in the same transaction.

Client verification updates the order verification state and creates a `VerificationResponse`. Final invoice generation is blocked unless:

`order.verificationStatus === VERIFIED`

Draft invoices can be created earlier; final invoices cannot be generated from pending, partially verified, or rejected orders.

## Inventory Invariant

Inventory changes should use `receiveOrAdjustStock()`. The service checks tenant ownership, rejects non-positive quantities and negative available stock, updates inventory, creates `InventoryMovement`, and writes an audit record transactionally.

## Storage Boundary

Documents store Supabase Storage URLs and metadata in `Document`. The current helper names the buckets `invoices`, `eway-bills`, `product-images`, `user-avatars`, and `warehouse-documents`. The helper can create public buckets, so production policies must be reviewed carefully and must prevent cross-tenant access.

## Deployment Boundary

Vercel runs `npm run build`, which generates Prisma Client and builds Next.js. `vercel.json` points to `.next` and does not rewrite every request to `/index`. Runtime environment variables, especially `DATABASE_URL` and Supabase credentials, must be configured in the Vercel environment independently of local `.env`.
