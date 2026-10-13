# Warevo — Multi-Tenant Warehouse Management System (WMS)

[![Application Status](https://img.shields.io/badge/Status-Completed%20%26%20Client%20Active-emerald?style=flat-square)](https://warevo.online)
[![Frontend Stack](https://img.shields.io/badge/Frontend-React%2019%20%7C%20TypeScript%20%7C%20Vite%206-blue?style=flat-square)](https://vitejs.dev/)
[![Backend Engine](https://img.shields.io/badge/Backend-Supabase%20PostgreSQL%2015-emerald?style=flat-square)](https://supabase.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-224%20Passed-success?style=flat-square)](__tests__/)

**Warevo** is an enterprise-grade, multi-tenant Warehouse Management System (WMS) built to manage commercial warehouse logistics, tenant-isolated inventory, end-to-end order lifecycles, client delivery verification checklists, and accounts receivable reconciliation.

Developed and deployed for active commercial warehouse operations, Warevo connects warehouse personnel, client procurement managers, delivery personnel, and accounting teams into a unified, secure digital workflow.

---

## Table of Contents

- [1. Project Status & Purpose](#1-project-status--purpose)
- [2. Business Problem & Solution](#2-business-problem--solution)
- [3. Key Features](#3-key-features)
- [4. Technology Stack](#4-technology-stack)
- [5. Application Screenshot Gallery](#5-application-screenshot-gallery)
- [6. System Architecture](#6-system-architecture)
- [7. Authentication & Authorization Model](#7-authentication--authorization-model)
- [8. Multi-Tenant Architecture](#8-multi-tenant-architecture)
- [9. User Roles & Permissions](#9-user-roles--permissions)
- [10. Inventory Management](#10-inventory-management)
- [11. Order Management & Workflow](#11-order-management--workflow)
- [12. Client Delivery Verification](#12-client-delivery-verification)
- [13. Invoice Creation & Management](#13-invoice-creation--management)
- [14. Payment Proof Management](#14-payment-proof-management)
- [15. Employee & Client-Company Management](#15-employee--client-company-management)
- [16. Transactional Notifications & Email Logging](#16-transactional-notifications--email-logging)
- [17. Database & Security Design](#17-database--security-design)
- [18. Project Folder Structure](#18-project-folder-structure)
- [19. Prerequisites & Local Installation](#19-prerequisites--local-installation)
- [20. Environment Variable Setup](#20-environment-variable-setup)
- [21. Development, Testing & Build Commands](#21-development-testing--build-commands)
- [22. Database Migrations & Production Bootstrap](#22-database-migrations--production-bootstrap)
- [23. Deployment Guide](#23-deployment-guide)
- [24. Security & Privacy Considerations](#24-security--privacy-considerations)
- [25. Known Limitations](#25-known-limitations)
- [26. Latest Development](#26-latest-development)
- [27. Future Roadmap](#27-future-roadmap)
- [28. Maintainer & Professional Links](#28-maintainer--professional-links)

---

## 1. Project Status & Purpose

- **Current Status**: Completed, thoroughly tested, and in active production use by commercial clients.
- **Purpose**: To eliminate paper manifests, prevent inventory discrepancies, secure delivery sign-offs with tamper-evident digital evidence, and enforce strict financial gating between physical dispatch and invoice payment.
- **Target Audience**: Warehouse operators, 3PL logistics providers, B2B wholesale suppliers, and client procurement departments.

---

## 2. Business Problem & Solution

### The Challenge
Traditional warehouse logistics suffer from:
1. **Discrepancy Disputes**: Deliveries arrive at client premises with disputes regarding missing or damaged items, leading to prolonged invoice friction.
2. **Premature Invoicing & Lost Revenue**: Invoices are raised or marked paid before goods are physically verified by the receiving company.
3. **Data Leakage in Multi-Client Facilities**: Managing multiple independent corporate clients from a single warehouse requires rock-solid data isolation so clients cannot inspect competitor order flows, inventory volumes, or pricing tiers.
4. **Poor Mobile Receipt Workflows**: Delivery drivers and product receivers lack simple, low-bandwidth tools to sign off shipments and capture condition photos on the spot.

### The Warevo Solution
- **Atomic Database State Machine**: Order transitions are governed by PostgreSQL stored procedures (`rpc_transition_order`) preventing arbitrary state jumping.
- **Client Delivery Verification Checklist**: Delivery receivers complete a mandatory digital checklist (tamper seal status, box condition, quantity verification) and upload photos directly from mobile devices.
- **Payment & Invoice Gating**: Invoices cannot be closed or final payments authorized until the physical delivery verification status reaches `VERIFIED`.
- **Database-Level Tenant & Client Isolation**: Enforced by Row-Level Security (RLS) on all 35 public schema tables.

---

## 3. Key Features

- **Multi-Tenant Warehouse Isolation**: Distinct warehouse entities, client directories, inventory registers, and billing structures segregated by `tenantId`.
- **Granular Dual-Tier RBAC**: Supports platform administrators, warehouse operators (Owner, Moderator, Staff, Accountant), and corporate client employee roles (`MD`, `GENERAL_MANAGER`, `MANAGER`, `RECEIVER`, `ACCOUNTANT`).
- **Real-Time Inventory Engine**: Multi-location bin tracking with transaction-safe adjustments, negative-stock protection, and automated low-stock warnings.
- **Complete Order Lifecycle**: Enforces `ISSUED` → `PROCESSING` → `DISPATCHED` → `DELIVERED` → `VERIFIED` with dispatch item immutability.
- **Delivery Proof & Verification**: Checklist-driven receiving with photo upload, append-only evidence history, and audit-logged warehouse overrides.
- **Invoicing & Accounts Receivable**: Automated invoice generation (`INV-2026-XXXXXX`), PDF parsing and import, payment proof uploads, and partial payment reconciliation.
- **Transactional Notifications**: Email dispatch alerts powered by Supabase Edge Functions with secure database aggregate volume tracking.
- **Comprehensive Audit Trail**: Synchronous recording of actor IDs, IP metadata, before/after states, and timestamps in `AuditLog` and `OrderStatusHistory`.

---

## 4. Technology Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Frontend Framework** | React 19 | Modern component architecture and UI reactivity |
| **Bundler & Tooling** | Vite 6.4 | High-performance build tooling with hot-module reload |
| **Language** | TypeScript 5.9 | End-to-end type safety across domain entities and RPC calls |
| **Client Routing** | React Router 7 | Declarative routing with protected route authorization |
| **Styling & Icons** | Tailwind CSS 3.4 & Lucide React | Modern dark-mode UI design system and iconography |
| **Data Visualizations** | Recharts 3.1 | Responsive inventory, revenue, and order velocity charts |
| **Document Processing** | PDF.js (`pdfjs-dist`) & PDFKit | Client-side invoice rendering, text extraction, and parsing |
| **Image Optimization** | `browser-image-compression` | Client-side photo compression for delivery proof uploads |
| **Backend & Database** | Supabase PostgreSQL 15 | Relational data persistence, Row-Level Security, and RPC engine |
| **Serverless Compute** | Supabase Edge Functions (Deno) | Transactional email delivery and employee provisioning |
| **Cloud Storage** | Supabase Storage | Private buckets for invoices, payment proofs, and delivery evidence |
| **Testing Framework** | Vitest 3.2 | Fast unit and integration testing (224 automated test cases) |

---

## 5. Application Screenshot Gallery

Warevo features a responsive dark-themed user interface (`slate-950`) tailored for desktop operations, warehouse floor tablets, and mobile delivery workflows.

### 5.1 Authentication Portal
![Warevo Login Screen](docs/screenshots/login.png)
*Live capture of the Warevo authentication portal featuring tenant-aware email/password login, Google OAuth integration, and password recovery workflows.*

---

### 5.2 Visual Documentation & Capture Standards
To protect active client confidentiality, commercial trade names, phone numbers, and financial slips are strictly excluded from public repository assets.

| Screen | Target Asset Path | Description |
|:-------|:------------------|:------------|
| **Main Operational Dashboard** | `docs/screenshots/dashboard.png` | Real-time metric cards, recent order feed, and inventory status |
| **Inventory Management** | `docs/screenshots/inventory.png` | SKU registers, stock levels, warehouse bin locations, and reorder tags |
| **Order Management** | `docs/screenshots/order-management.png` | Comprehensive order ledger with lifecycle status filters |
| **Order Details & Comments** | `docs/screenshots/order-details.png` | Line items, dispatch metadata, and synchronized order comment thread |
| **Client Delivery Verification** | `docs/screenshots/order-verification.png` | Tamper checklist, condition inspection, and photo attachment slot |
| **Invoicing & Accounting** | `docs/screenshots/invoices.png` | Billing ledger with payment status tracking and PDF invoice generation |
| **Employee & Role Directory** | `docs/screenshots/employee-management.png` | Warehouse and client employee role management interface |

> [!NOTE]
> For instructions on capturing remaining screens using an isolated synthetic demo sandbox, refer to [docs/SCREENSHOT_GUIDE.md](docs/SCREENSHOT_GUIDE.md).

---

## 6. System Architecture

Warevo couples a modern Single Page Application (SPA) with serverless PostgreSQL transaction boundaries:

```mermaid
flowchart TD
    subgraph BrowserApp [Client Browser - React 19 SPA]
        UI[Tailwind UI Components]
        Router[React Router 7 Protected Routes]
        AuthCtx[Auth Context & Role Resolver]
        ServiceLayer[Service Layer - Supabase JS Client]
    end

    subgraph SupabaseServices [Supabase Cloud Services]
        AuthEngine[Supabase Auth - Identity & JWT]
        PrivateStorage[Supabase Storage - Private Buckets]
        EdgeFunctions[Edge Functions - Deno Runtime]
    end

    subgraph PostgresEngine [PostgreSQL 15 Database Tier]
        RLSPolicies[Row-Level Security - 35 Tables]
        AtomicRPCs[PostgreSQL RPC Functions]
        DataTables[(Public Schema - Core Tables)]
        AuditLog[(AuditLog & OrderStatusHistory)]
    end

    UI --> Router
    Router --> AuthCtx
    AuthCtx --> ServiceLayer

    ServiceLayer -- "1. Auth & Session Refresh" --> AuthEngine
    ServiceLayer -- "2. Upload Proofs & Invoices" --> PrivateStorage
    ServiceLayer -- "3. Employee Provisioning & Email Alerts" --> EdgeFunctions
    ServiceLayer -- "4. Atomic Transactions & Queries" --> RLSPolicies

    RLSPolicies --> AtomicRPCs
    AtomicRPCs --> DataTables
    AtomicRPCs --> AuditLog
    EdgeFunctions -- "Service Role Access" --> DataTables
```

For complete architectural details, see [docs/architecture.md](docs/architecture.md).

---

## 7. Authentication & Authorization Model

1. **Authentication Engine**: Handled via Supabase Auth.
2. **Profile Mapping**: Session `auth.uid()` maps to `public."User"."supabaseUserId"`.
3. **Account Status Verification**: Accounts in `INACTIVE` or `SUSPENDED` status are blocked at login.
4. **Dynamic Authorization**: Frontend routes and action triggers evaluate both coarse `Role` and fine-grained `PermissionKey` sets.
5. **Database-Level Enforcement**: Bypassing frontend UI validation fails at the database layer because all mutations require verified `public.get_current_actor()` permissions.

---

## 8. Multi-Tenant Architecture

Warevo enforces strict data tenancy:
- **Tenant Scope**: Every warehouse facility is registered as an independent `Tenant`.
- **Foreign Key Enforcement**: All operational records (`Order`, `Inventory`, `Warehouse`, `Client`, `Invoice`, `Payment`) require a valid `tenantId`.
- **Row-Level Security**: The PostgreSQL helper `can_access_tenant("tenantId")` guarantees that non-admin users only ever query data matching their assigned tenant.
- **Platform Superuser**: `PLATFORM_ADMIN` is the only cross-tenant role, designed for SaaS infrastructure maintenance and global reporting.

---

## 9. User Roles & Permissions

### System Roles
- `PLATFORM_ADMIN`: Cross-tenant superuser.
- `WAREHOUSE_OWNER`: Full administrative authority over a specific tenant's operations, staff, inventory, and accounts.
- `WAREHOUSE_MODERATOR`: Operations management, client relations, and stock receiving.
- `WAREHOUSE_STAFF`: Floor operations, packing, picking, and dispatch.
- `ACCOUNTANT` / `ACCOUNTS_TEAM`: Financial ledger oversight, invoice generation, and payment reconciliation.
- `CLIENT`: External client representative managing orders and tracking shipments.
- `CLIENT_ACCOUNTANT`: External accountant managing billing and payment submissions.

### Granular Client Employee Roles
Enterprise clients can assign tailored roles to staff members:
- **`MD`**: Full administrative client authority.
- **`GENERAL_MANAGER`**: Operational oversight and order approvals.
- **`MANAGER`**: Standard order submission and dispatch tracking.
- **`RECEIVER`**: Dedicated role restricted solely to inspecting shipments and completing **Delivery Verification Checklists**.
- **`ACCOUNTANT`**: Restricted to reviewing invoices and uploading payment slips.

For the complete role permission matrix, see [docs/user-roles.md](docs/user-roles.md).

---

## 10. Inventory Management

- **Physical Bin Tracking**: Products map to specific aisle, rack, and bin coordinates in `WarehouseLocation`.
- **Negative-Stock Prevention**: Database RPC `rpc_receive_or_adjust_stock` validates stock availability before decrementing balances.
- **Immutable Movement Ledger**: Every stock addition, deduction, transfer, or damage write-off writes an immutable record to `InventoryMovement`.
- **Real-Time Low Stock Detection**: Visual alerts trigger when quantities breach defined minimum reorder thresholds.

---

## 11. Order Management & Workflow

```text
[ ISSUED ] ──► [ PROCESSING ] ──► [ DISPATCHED ] ──► [ DELIVERED ] ──► [ VERIFIED ]
    │                │                  │
    ▼                ▼                  ▼
[ CANCELLED ]    [ CANCELLED ]   [ IMMUTABLE POST-DISPATCH ]
```

- **Order Immutability**: Orders cannot be modified or deleted once marked `DISPATCHED` (enforced by `rpc_update_order_before_dispatched`).
- **Synchronous Order Comments**: Operational communication thread (`OrderComment` table) shared between warehouse handlers and client contacts.
- **Atomic Transitions**: All state changes execute inside `rpc_transition_order` and record history entries synchronously.

For complete order transition rules, see [docs/order-workflow.md](docs/order-workflow.md).

---

## 12. Client Delivery Verification

Upon physical arrival, the client receiver completes delivery verification:
1. **Condition Checklist**: Verifies package seals, inspects for transit damage, and confirms physical piece counts against the invoice.
2. **Mobile Evidence Upload**: Receivers capture photos of the delivery manifest and goods.
3. **Verification States**:
   - `VERIFIED`: Confirmed in full. Unlocks invoice processing.
   - `PARTIAL`: Discrepancies noted; flagged for warehouse review.
   - `REJECTED`: Severe damage or incorrect shipment; delivery refused.
4. **Append-Only Proofs**: Handled by `rpc_add_delivery_evidence` to prevent tampering with historical evidence.

---

## 13. Invoice Creation & Management

- **Sequential Numbering**: Generates standardized invoice identifiers (`INV-2026-XXXXXX`) using atomic sequence counters.
- **Payment Gating**: Invoices cannot be marked final or paid until delivery verification is `VERIFIED`.
- **Document Management**: Supports automated PDF invoice generation, client-side preview, and PDF text extraction.

---

## 14. Payment Proof Management

- **Secure Document Storage**: Payment slips (NEFT/RTGS transaction screenshots, cheques) are stored in private Supabase bucket `payment-proofs`.
- **Client-Side Optimization**: Mobile photos are compressed automatically prior to upload.
- **Audit Verification**: Warehouse accountants review submitted proofs and record reconciliations using `rpc_record_payment_secure`.

---

## 15. Employee & Client-Company Management

- **Client Directory**: Track corporate clients, affiliated parent groups, credit limits, and billing terms.
- **Employee Provisioning**: Edge Function `create-employee` creates Supabase Auth identities and associates WMS role profiles safely without exposing service role keys.

---

## 16. Transactional Notifications & Email Logging

- **Automated Alerts**: Email notifications dispatch on order creation, shipment dispatch, and verification sign-offs.
- **Privacy-Preserving Metrics**: The database procedure `rpc_get_email_sent_count(UUID)` calculates tenant email metrics without exposing raw message contents to client browsers.

---

## 17. Database & Security Design

- **PostgreSQL 15 Core**: 35 public schema tables and 16 custom enum definitions.
- **Row-Level Security (RLS)**: Enforced across 100% of public tables with restrictive write policies.
- **Zero Raw Table Writes**: Critical mutations execute through PostgreSQL `SECURITY DEFINER` stored procedures.
- **Private Storage**: Storage buckets (`invoices`, `delivery-evidence`, `payment-proofs`) enforce tenant path-based RLS policies.

For detailed security policies and schema design, see [docs/database-and-security.md](docs/database-and-security.md).

---

## 18. Project Folder Structure

```
warehouse_management/
├── src/
│   ├── App.tsx                     # Top-level routing & role-protected guards
│   ├── main.tsx                    # React application entry point
│   ├── index.css                   # Tailwind CSS styling and theme definitions
│   ├── contexts/
│   │   └── AuthContext.tsx         # User identity, tenant switching & session state
│   ├── lib/
│   │   ├── config.ts               # Environment configuration helper
│   │   ├── services.ts             # Supabase queries, mutations & RPC wrappers
│   │   ├── orderWorkflow.ts        # Order lifecycle state machine
│   │   ├── permissions.ts          # Central permission matrices
│   │   ├── employeeService.ts      # Employee CRUD & Edge Function integration
│   │   └── supabase.ts             # Supabase client singleton
│   ├── pages/
│   │   ├── auth/                   # Login, callback & password recovery pages
│   │   ├── dashboard/              # Role-specific operational dashboards
│   │   ├── operations/             # Orders, Inventory, Clients, Employees, Tracking
│   │   ├── accounting/             # Invoices, Payments & Financial ledgers
│   │   ├── admin/                  # Platform Admin cross-tenant console
│   │   ├── reports/                # Operational & financial reporting
│   │   └── notifications/          # Notification inbox & settings
│   ├── components/                 # Reusable UI components & modals
│   └── types/                      # TypeScript domain types & enums
├── supabase/
│   ├── migrations/                 # Versioned SQL migrations
│   ├── bootstrap/                  # Production schema bootstrap script
│   └── functions/                  # Supabase Edge Functions (create-employee, send-email)
├── docs/                           # Technical documentation & guides
│   ├── architecture.md             # System architecture & Mermaid diagrams
│   ├── user-roles.md               # User roles & permission matrices
│   ├── order-workflow.md           # Order lifecycle & delivery verification
│   ├── database-and-security.md    # Database design & RLS policies
│   ├── setup-and-deployment.md     # Installation & cloud deployment
│   ├── SCREENSHOT_GUIDE.md         # Visual capture & sanitization rules
│   └── PUBLICATION_CHECKLIST.md    # Public release verification checklist
├── __tests__/                      # Vitest test suites (224 passing unit tests)
├── DEVELOPMENT.md                  # Developer & maintainer reference guide
├── CHANGELOG.md                    # Verified chronological change log
└── SECURITY.md                     # Vulnerability reporting & security policy
```

---

## 19. Prerequisites & Local Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Supabase Account**: Local or hosted Supabase project

### Installation
```bash
# 1. Clone repository
git clone <repository_url> warevo
cd warevo

# 2. Install dependencies
npm install

# 3. Configure environment file
cp .env.example .env
```

---

## 20. Environment Variable Setup

Configure `.env` with your Supabase credentials:

```ini
# Supabase Configuration (Client SPA)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-publishable-key"

# Application Base URL
VITE_APP_URL="http://localhost:3000"

# Server / Edge Notification URL
APP_URL="http://localhost:3000"

# Database Connection (Local Tooling & Migration Scripts Only)
DATABASE_URL="postgresql://user:password@localhost:5432/warehousedb"
```

> [!CAUTION]
> Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend environment variables.

---

## 21. Development, Testing & Build Commands

| Command | Action |
|:--------|:-------|
| `npm run dev` | Launch local Vite development server at `http://localhost:3000` |
| `npm test` | Run Vitest test suites (224 automated unit tests) |
| `npm run build` | Compile TypeScript and create production bundle in `dist/` |
| `npm run preview` | Preview production build locally |

---

## 22. Database Migrations & Production Bootstrap

- **Local Migrations**: Located in [`supabase/migrations/`](supabase/migrations).
- **Production Initialization**: Use the audited bootstrap script [`supabase/bootstrap/production_schema_bootstrap.sql`](supabase/bootstrap/production_schema_bootstrap.sql) which installs all 35 tables, 16 enums, and 42 RPC functions without data leakage risk. Detailed in [docs/PRODUCTION_SCHEMA_BOOTSTRAP.md](docs/PRODUCTION_SCHEMA_BOOTSTRAP.md).

---

## 23. Deployment Guide

- **Frontend**: Deploy to Vercel, Netlify, or Cloudflare Pages with framework set to **Vite** (`dist` output directory).
- **Backend**: Supabase PostgreSQL with Edge Functions deployed via Supabase CLI.
- Step-by-step instructions: [docs/setup-and-deployment.md](docs/setup-and-deployment.md).

---

## 24. Security & Privacy Considerations

- **Client Data Sanitization**: No commercial client data is exposed in repository documentation or test fixtures.
- **Tenant Isolation**: Row-Level Security blocks cross-tenant reads and mutations at the engine level.
- **Private Storage**: Sensitive delivery evidence and payment receipts are stored in private buckets with access policies.
- **Security Policy**: See [SECURITY.md](SECURITY.md) for responsible disclosure procedures.

---

## 25. Known Limitations

- **Physical Barcode Scanners**: Handheld hardware barcode scanners currently input via standard keyboard emulation; dedicated Bluetooth scanner protocol integration is planned.
- **Multi-Currency Ledgers**: Single currency representation per tenant; multi-currency conversions are not yet implemented.

---

## 26. Latest Development

*Documentation Review Date: 2026-10-13*

The latest verified development state of Warevo based on Git commit history and versioned database migrations:

| Feature / Architecture Area | Status | Verified Artifact / Reference |
|:----------------------------|:------:|:------------------------------|
| **Tenant Management & Admin Console** | **Implemented & Tested** | `Commit: 97c75a1` — Admin dashboard tenant profile editing |
| **Secure Email Sent Count RPC** | **Implemented & Migration Local** | `Commit: b206940`, `Migration: 20261020_000000_get_email_sent_count_rpc.sql` |
| **Delivery Verification Override & TIMESTAMPTZ** | **Implemented & Migration Local** | `Commit: b4ff0f6`, `Migration: 20261019_000000_delivery_verification_override_and_timestamps.sql` |
| **Order Lifecycle & Storage Policies** | **Implemented & Migration Local** | `Commit: fd43e36`, `Migration: 20261018_000000_order_lifecycle_verification_evidence.sql` |
| **Production Schema Bootstrap Tooling** | **Implemented & Documented** | `Commit: c3ada3d`, `scripts/export-production-schema.ts` |
| **Granular Client Employee Roles** | **Implemented & Tested** | `Commit: 979d9e6`, `__tests__/client_management_roles.test.ts` (50 tests passed) |
| **Delivery Verification Payment Gating** | **Implemented & Tested** | `Commit: 8093606`, `__tests__/payment_gate_and_email_recipient.test.ts` (19 tests passed) |
| **Unit Test Coverage** | **Tested & Passed** | 13 test suites, **224 tests passing** via Vitest |
| **Production Build Compilation** | **Tested & Passed** | `npm run build` completed cleanly in 14.6s |

---

## 27. Future Roadmap

The following enhancements are planned for future releases:
- [ ] Automated SMS carrier tracking updates.
- [ ] Native camera barcode and QR scanning support in warehouse picking.
- [ ] Multi-currency ledger support for international billing.
- [ ] Automated PDF packing slip batch generation.

---

## 28. Maintainer & Professional Links

- **Repository**: [jaivarshan7/Warevo](https://github.com/jaivarshan7/Warevo)
- **Live System**: [https://warevo.online](https://warevo.online)
- **Developer Guide**: [DEVELOPMENT.md](DEVELOPMENT.md)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Security Policy**: [SECURITY.md](SECURITY.md)
