# WarehouseOS Migration Plan: Next.js + Prisma to React + Vite + TypeScript + Supabase

## 1. Executive Summary
WarehouseOS is being migrated from a Next.js 15 App Router + Prisma ORM setup to a pure **React 19 + Vite + TypeScript + React Router + Supabase** application.

This eliminates:
- Next.js server actions, server components, and framework routing lock-in
- Prisma Client runtime overhead and Node.js server requirement
- Split admin/client frontend duplication

And introduces:
- **Client-side React 19 SPA powered by Vite** for blazing-fast development and build times.
- **Direct Supabase PostgreSQL database access** via `@supabase/supabase-js` client.
- **PostgreSQL Database Functions / RPCs** to enforce mission-critical business rules (order state transitions, stock adjustments, invoice generation upon delivery verification, payment tracking) atomically in the database.
- **Supabase Row Level Security (RLS)** ensuring strict tenant isolation and role/client access boundaries.
- **Single unified AppShell** with dynamic permission-based navigation, responsive desktop sidebar, and mobile bottom navigation.
- **Role-focused experiences** tailored for management, operations, warehouse staff, product receivers, accountants, and client representatives.

---

## 2. Architecture Comparison

| Area | Before (Next.js + Prisma) | After (React + Vite + Supabase) |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 15 App Router | React 19 + Vite 6 |
| **Routing** | Next.js filesystem routes (`app/...`) | React Router 7 (`react-router-dom`) |
| **Styling** | Tailwind CSS 3 | Tailwind CSS 3 + Modern Polish |
| **Data Access** | Prisma Client (`@prisma/client`) | Supabase JS Client (`@supabase/supabase-js`) |
| **Security & Auth** | Next.js cookies + manual Prisma checks | Supabase Auth + Session Context + Supabase RLS |
| **Business Logic** | Next.js Server Actions / `lib/services.ts` | Supabase Postgres RPCs + Client Service Hooks |
| **Shell & Layout** | Split Next.js layouts (`app/admin-dashboard`, `app/dashboard`) | Single adaptive `AppShell` with Mobile Bottom Nav |

---

## 3. Database Migration & RLS Strategy

### 3.1 Schema Preservation
All existing tables, relations, and enums from `prisma/schema.prisma` are preserved in Supabase PostgreSQL:
- Enums: `Role`, `ClientEmployeeRole`, `TenantStatus`, `UserStatus`, `ClientStatus`, `ProductStatus`, `OrderStatus`, `VerificationStatus`, `InvoiceStatus`, `PaymentStatus`, `InventoryMovementType`, `DocumentType`, `NotificationType`, `InvoiceImportStatus`, `EWayBillStatus`, `DeliveryVerificationItemStatus`.
- Tables: `Tenant`, `CompanyGroup`, `Warehouse`, `User`, `Client`, `Category`, `Product`, `WarehouseLocation`, `Inventory`, `InventoryMovement`, `Order`, `OrderContact`, `OrderItem`, `OrderStatusHistory`, `VerificationChecklist`, `VerificationItem`, `VerificationResponse`, `Invoice`, `InvoiceItem`, `Payment`, `Notification`, `Document`, `AuditLog`, `PlatformSetting`, `WarehouseSetting`, `ImportedInvoice`, `ImportedInvoiceItem`, `EWayBill`, `DeliveryVerification`, `DeliveryVerificationItem`.

### 3.2 SQL Migrations
A version-controlled SQL migration (`supabase/migrations/20260904_warehouse_os_core.sql`) provides:
1. Enum types & table structure definitions matching existing schema.
2. Foreign keys, compound unique constraints, and optimized indexes.
3. PostgreSQL RPC functions for atomic transaction safety:
   - `rpc_transition_order`: Enforces valid order status machine transitions, logs to `OrderStatusHistory`, updates order and verification status, and logs audit events.
   - `rpc_receive_or_adjust_stock`: Validates positive counts, updates available/damaged inventory, prevents negative available stock, and records `InventoryMovement` + `AuditLog`.
   - `rpc_submit_verification`: Validates verification state, updates order status, upserts `VerificationResponse`, and creates audit log + notification.
   - `rpc_generate_invoice`: **Strictly enforces** that final invoices can only be created when `order.verificationStatus = 'VERIFIED'`. Computes CGST/SGST splits, creates `Invoice` and `InvoiceItem`s, marks order as `INVOICED`, and logs audit events.
   - `rpc_record_payment`: Records payment, updates invoice status to `PAID` / `PARTIALLY_PAID`, and logs audit trail.

---

## 4. Frontend Architecture: Single AppShell

```text
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx         # Main layout container
│   │   ├── Sidebar.tsx          # Desktop Collapsible Sidebar
│   │   ├── Header.tsx           # Global Header with Tenant & User info
│   │   ├── MobileNav.tsx        # Mobile Bottom Navigation Bar
│   │   └── NotificationBell.tsx # Real-time notification popup
│   ├── ui/
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Drawer.tsx
│   │   ├── Table.tsx
│   │   └── Tabs.tsx
│   └── shared/
│       ├── StatusBadge.tsx
│       ├── EmptyState.tsx
│       └── LoadingSpinner.tsx
├── contexts/
│   └── AuthContext.tsx          # Supabase auth session, active user, active tenant & roles
├── hooks/
│   ├── useAuth.ts
│   ├── useNotifications.ts
│   └── usePermissions.ts
├── lib/
│   ├── supabase.ts              # Configured Supabase JS client
│   ├── permissions.ts           # RBAC rules matching lib/rbac.ts
│   ├── navigation.ts            # Permission-aware navigation config
│   ├── services.ts              # Data services invoking Supabase queries & RPCs
│   └── orderWorkflow.ts         # Transition validation rules
├── pages/
│   ├── dashboard/
│   │   ├── DashboardPage.tsx    # Role-adaptive dashboard
│   │   ├── StaffDashboard.tsx   # Simplified task-first view for Warehouse Staff
│   │   ├── ReceiverDashboard.tsx# Simple tracking/verification view for Receivers
│   │   ├── ClientDashboard.tsx  # Order tracking & verification for Clients
│   │   └── AccountsDashboard.tsx# Payment & invoice verification view
│   ├── operations/
│   │   ├── OrdersPage.tsx       # Order listing, status transitions, creation modal
│   │   ├── OrderDetailPage.tsx  # Order timeline, items, verification & invoice actions
│   │   ├── InventoryPage.tsx    # Stock levels, adjustments, movement history
│   │   └── ClientsPage.tsx      # Client companies, contacts, group management
│   ├── accounting/
│   │   ├── AccountingPage.tsx   # Tabs: Overview, Invoices, Payments, Imports
│   │   └── InvoiceDetailPage.tsx# Invoice breakdown, tax splits, payment recording
│   ├── reports/
│   │   └── ReportsPage.tsx      # Financial, operational, and inventory analytics
│   ├── notifications/
│   │   └── NotificationsPage.tsx# Notification center with mark-as-read
│   ├── settings/
│   │   └── SettingsPage.tsx     # Tenant, warehouse, and system configuration
│   ├── profile/
│   │   └── ProfilePage.tsx      # Profile editing and avatar upload
│   └── auth/
│       ├── LoginPage.tsx        # Supabase Auth + Demo quick login switcher
│       └── AdminLoginPage.tsx   # Platform administrator login
├── types/
│   └── index.ts                 # TypeScript domain entities and enums
├── App.tsx                      # Router configuration and protected routes
├── index.css                    # Tailwind styles and custom utilities
└── main.tsx                     # React entry point
```

---

## 5. Execution Steps
1. ✅ **Inspection & Database Access**: Verify database connection, schema structure, and seed demo records.
2. 🔄 **SQL Migration & RPC Deployment**: Create and execute `supabase/migrations/20260904_warehouse_os_core.sql` containing atomic business rule functions.
3. 🔄 **Vite Setup & Dependencies**: Configure `vite.config.ts`, `index.html`, `tsconfig.json`, and tailwind paths.
4. 🔄 **Core Libraries & Types**: Create domain types, Supabase client initialization (`src/lib/supabase.ts`), RBAC definitions (`src/lib/permissions.ts`), navigation configuration (`src/lib/navigation.ts`), and workflow helpers.
5. 🔄 **Auth & Session Context**: Implement `src/contexts/AuthContext.tsx` supporting Supabase authentication with user profile resolution and demo switching.
6. 🔄 **AppShell & Navigation**: Build responsive `AppShell`, `Sidebar`, `Header`, `MobileNav`, and `NotificationBell`.
7. 🔄 **Application Modules**:
   - Dashboard (role-adaptive)
   - Operations: Orders (listing, detail, status transition, creation modal), Inventory (stock levels, adjust modal, movement log), Clients (directory, create modal).
   - Accounting: Overview, Invoices, Payments, Imports with tabbed interface.
   - Reports: Operational and financial statistics.
   - Settings & Profile.
8. 🔄 **Verification & Build**: Test build, ensure zero TypeScript errors, run dev server, and document usage commands.
