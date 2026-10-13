# Warevo — Developer & Maintainer Guide

This document is the authoritative guide for software engineers maintaining, testing, and developing **Warevo — Multi-Tenant Warehouse Management System (WMS)**.

---

## 1. Development Environment

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ / v24+ supported)
- **Package Manager**: `npm` (v9+)
- **TypeScript**: v5.9+
- **Database Engine**: PostgreSQL 15 via Supabase
- **Build Tooling**: Vite 6.4+ (React 19 SPA)
- **Testing Engine**: Vitest 3.2+

### Quick Setup
```bash
# 1. Clone repository
git clone <repo-url> warevo
cd warevo

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Copy template and supply keys
cp .env.example .env

# 4. Launch local development server
npm run dev
```

The application will be accessible at `http://localhost:3000` (or configured Vite port).

---

## 2. Architecture & Key Source Files

Warevo is built as a single-page application with serverless database boundaries and atomic database procedures.

```
warehouse_management/
├── src/
│   ├── App.tsx                     # Top-level routing, layouts, and role protection
│   ├── main.tsx                    # React 19 application mount point
│   ├── index.css                   # Global styles & Tailwind CSS definitions
│   ├── contexts/
│   │   └── AuthContext.tsx         # User identity, tenant switching, session state
│   ├── lib/
│   │   ├── config.ts               # Runtime environment configuration
│   │   ├── services.ts             # Supabase queries, mutations, and RPC wrappers
│   │   ├── orderWorkflow.ts        # Order lifecycle state machine & invariants
│   │   ├── permissions.ts          # Central permission matrices (system & client roles)
│   │   ├── employeeService.ts      # Employee CRUD & Edge Function integration
│   │   ├── invoiceParser.ts        # PDF parsing and text normalization
│   │   ├── imageCompression.ts     # Client-side image compression for mobile proofs
│   │   └── supabase.ts             # Supabase client singleton
│   ├── pages/
│   │   ├── auth/                   # Login, callback, and password recovery pages
│   │   ├── dashboard/              # Role-specific operational dashboards
│   │   ├── operations/             # Orders, Inventory, Clients, Employees, Tracking
│   │   ├── accounting/             # Invoices, Payments, Financial reconciliation
│   │   ├── admin/                  # Platform Admin & cross-tenant overview
│   │   ├── reports/                # Operational, stock, and financial reports
│   │   └── notifications/          # Notification inbox & preferences
│   ├── components/                 # Modals, forms, tables, badges, UI primitives
│   └── types/                      # Comprehensive TypeScript domain types & enums
├── supabase/
│   ├── migrations/                 # Target schema migrations
│   ├── bootstrap/                  # Production schema bootstrap script
│   └── functions/                  # Supabase Edge Functions (`send-email`, `create-employee`)
└── __tests__/                      # Vitest test suites (224 automated unit tests)
```

---

## 3. Authentication & User-Profile Linkage Flow

### Authentication Layers
1. **Supabase Auth (`auth.users`)**: Manages credentials (Email/Password, Google OAuth, Magic Links).
2. **WMS User (`public."User"`)**: Stores business profile, role assignment, tenant linkage, and status (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
3. **Session Resolution**: Handled inside [`src/contexts/AuthContext.tsx`](file:///d:/Dev/warehouse_management/src/contexts/AuthContext.tsx):
   - `onAuthStateChange` detects token refresh or sign-in.
   - Maps `auth.uid()` to `public."User"."supabaseUserId"`.
   - Normalizes single-element array joins from PostgREST via `normalizeUser()`.
   - Rejects inactive users with `ACCOUNT_INACTIVE` feedback before accessing protected routes.

### Tenant Resolution & Isolation
- Each tenant record represents an independent commercial warehouse business.
- All core business tables (`Order`, `OrderItem`, `Inventory`, `Invoice`, `Payment`, `Warehouse`) carry a `tenantId` foreign key.
- A user can only access records where `tenantId = user.tenantId`, enforced via:
  1. Frontend query filters in [`src/lib/services.ts`](file:///d:/Dev/warehouse_management/src/lib/services.ts).
  2. PostgreSQL Row-Level Security (RLS) policies on every public table.
  3. Atomic PostgreSQL RPCs that inspect `public.get_current_actor()` or `auth.uid()`.

---

## 4. Authorization & Permission Model

Warevo provides a dual-hierarchy Role-Based Access Control (RBAC) model:

### System Roles (`Role` Enum)
- `PLATFORM_ADMIN`: Cross-tenant superuser. Can inspect platform metrics and provision new warehouse tenants.
- `WAREHOUSE_OWNER`: Full administrative authority over a specific tenant (warehouses, staff, inventory, accounting, settings).
- `WAREHOUSE_MODERATOR`: Manages inventory adjustments, order fulfillment, client records, and invoice imports.
- `WAREHOUSE_STAFF`: Operations personnel handling picking, packing, dispatch, and physical stock moves.
- `ACCOUNTANT` / `ACCOUNTS_TEAM`: Financial visibility into invoices, payments, tax calculations, and accounts receivable.
- `CLIENT`: External client company account with access to place orders, track shipments, verify deliveries, and review invoices.
- `CLIENT_ACCOUNTANT`: External accountant for client organizations managing billing and payment submissions.

### Granular Client Employee Roles (`ClientEmployeeRole` Enum)
For enterprise client accounts with multiple employees:
- `MD` (Managing Director): Unrestricted client authority across orders, financial approvals, and user management.
- `GENERAL_MANAGER`: Operational oversight with authority to approve orders and oversee accounts.
- `MANAGER`: Standard order placement, dispatch tracking, and delivery sign-off.
- `RECEIVER`: Limited solely to receiving packages and completing the **Delivery Verification Checklist**.
- `ACCOUNTANT`: Restricted to financial ledgers, invoice downloads, and payment proof submissions.

Permissions are verified through helper functions in [`src/lib/permissions.ts`](file:///d:/Dev/warehouse_management/src/lib/permissions.ts):
```typescript
hasPermission(user, 'ORDERS_DISPATCH');
canAccessRoute(user, '/operations/orders');
```

---

## 5. Order Lifecycle & Delivery Verification Logic

The order lifecycle is strictly enforced in [`src/lib/orderWorkflow.ts`](file:///d:/Dev/warehouse_management/src/lib/orderWorkflow.ts) and backed by PostgreSQL RPC `rpc_transition_order`:

```
               ┌──────────────┐
               │    ISSUED    │  (Order created, items reserved)
               └──────┬───────┘
                      │
                      ▼
               ┌──────────────┐
               │  PROCESSING  │  (Warehouse picking & packing)
               └──────┬───────┘
                      │
                      ▼
               ┌──────────────┐
               │  DISPATCHED  │  (In transit; E-Way bill linked)
               └──────┬───────┘
                      │
                      ▼
               ┌──────────────┐
               │  DELIVERED   │  (Arrived at client premises)
               └──────┬───────┘
                      │
                      ▼
        [ CLIENT DELIVERY VERIFICATION ]
        ┌─────────────┴─────────────┐
        ▼                           ▼
  ┌───────────┐               ┌──────────┐
  │ VERIFIED  │               │ REJECTED │
  └─────┬─────┘               └──────────┘
        │
        ▼
  [ FINAL INVOICE & PAYMENT UNLOCKED ]
```

### Invariants:
1. **No Skip-Transitions**: An order cannot jump from `ISSUED` to `DELIVERED` without passing intermediate stages.
2. **Item Immutability Post-Dispatch**: Orders cannot be edited or deleted once status reaches `DISPATCHED` (enforced by `rpc_update_order_before_dispatched`).
3. **Delivery Verification Gating**: Final invoices and payment authorizations are locked until the client completes delivery verification (or an authorized warehouse admin provides an audited override).
4. **Append-Only Evidence**: Verification photos and signatures use append-only semantics via `rpc_add_delivery_evidence` to prevent evidence tampering.

---

## 6. PostgreSQL RPC Functions

To guarantee transactional ACID guarantees, critical business actions run inside PostgreSQL functions with `SECURITY DEFINER`:

| Function Name | Parameters | Purpose & Guarantees |
|---------------|------------|----------------------|
| `rpc_transition_order` | `p_order_id`, `p_new_status`, `p_notes` | Validates valid transition sequence, updates status, and logs `OrderStatusHistory` and `AuditLog` atomically. |
| `rpc_submit_verification` | `p_order_id`, `p_status`, `p_responses`, `p_comments`, `p_attachments` | Records client checklist responses, updates verification state, and attaches evidence without data loss. |
| `rpc_receive_or_adjust_stock` | `p_tenant_id`, `p_product_id`, `p_location_id`, `p_quantity`, `p_type`, `p_reference` | Prevents negative inventory, updates physical bin balances, and writes `InventoryMovement` log in one transaction. |
| `rpc_get_email_sent_count` | `p_tenant_id` | Aggregates sent email metrics without exfiltrating row data to client browsers. Scoped to authenticated tenant. |
| `rpc_record_payment_secure` | `p_invoice_id`, `p_amount`, `p_method`, `p_reference`, `p_proof_url` | Validates invoice balance, records payment, updates invoice status (`PARTIAL` or `PAID`), and sets audit entry. |

---

## 7. Migration Management

Database changes follow versioned SQL migrations located in [`supabase/migrations/`](file:///d:/Dev/warehouse_management/supabase/migrations):

- Format: `YYYYMMDD_HHMMSS_<descriptive_name>.sql`
- **Rule**: Never edit an applied migration file. Always write a forward migration to introduce changes.
- **Production Bootstrapping**: Production databases should be initialized using the audited script [`supabase/bootstrap/production_schema_bootstrap.sql`](file:///d:/Dev/warehouse_management/supabase/bootstrap/production_schema_bootstrap.sql) as documented in [`docs/PRODUCTION_SCHEMA_BOOTSTRAP.md`](file:///d:/Dev/warehouse_management/docs/PRODUCTION_SCHEMA_BOOTSTRAP.md).

---

## 8. Automated Testing & Verification

Warevo includes 13 test suites with **224 automated tests** configured under Vitest.

### Running Tests
```bash
# Run all unit tests
npm test

# Run tests in watch mode
npx vitest

# Run a specific test suite
npx vitest __tests__/payment_gate_and_email_recipient.test.ts
```

### Verified Test Suites:
1. `__tests__/inactive_user_login.test.ts` (13 tests)
2. `__tests__/email_recipient_and_portal_routing.test.ts` (7 tests)
3. `__tests__/rbac_client_permissions.test.ts` (17 tests)
4. `__tests__/payment_gate_and_email_recipient.test.ts` (19 tests)
5. `__tests__/authorization_and_workflow.test.ts` (32 tests)
6. `__tests__/workflow.test.ts` (9 tests)
7. `__tests__/order_timeline_and_status_display.test.ts` (9 tests)
8. `__tests__/employee_roles.test.ts` (7 tests)
9. `__tests__/client_management_roles.test.ts` (50 tests)
10. `__tests__/new_order_email_recipient_and_template.test.ts` (12 tests)
11. `__tests__/phase9_notification_email_workflow.test.ts` (16 tests)
12. `__tests__/notification_and_email.test.ts` (13 tests)
13. `__tests__/inventory_search_and_email_count.test.ts` (20 tests)

---

## 9. Build & Production Packaging

```bash
# Check TypeScript compilation and create production bundle
npm run build
```

The output bundle is emitted into `dist/` with chunked JavaScript assets, CSS stylesheets, and the PDF worker module.
