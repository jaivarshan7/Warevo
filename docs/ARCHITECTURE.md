# Warevo System Architecture

This document outlines the system architecture, component relationships, data flow boundaries, and operational layers of **Warevo — Multi-Tenant Warehouse Management System (WMS)**.

---

## 1. High-Level Architectural Diagram

```mermaid
flowchart TD
    subgraph ClientBrowser [Browser Client Tier - React 19 SPA]
        UI[Tailwind CSS UI Components]
        Router[React Router 7 Navigation]
        AuthCtx[Auth Context & Role Normalizer]
        ServiceLayer[Service Layer & State Store]
    end

    subgraph SecurityBoundary [Authentication & Edge Services]
        SupabaseAuth[Supabase Auth - Identity Provider]
        EdgeFuncs[Supabase Edge Functions - Deno Runtime]
        Storage[Supabase Storage - Private Buckets]
    end

    subgraph DatabaseTier [PostgreSQL 15 Database Tier]
        RLS[Row-Level Security Policies]
        RPC[Atomic RPC Functions - Transaction Engine]
        PublicSchema[(Public Schema - 35 Core Tables)]
        AuditEngine[(AuditLog & OrderStatusHistory)]
    end

    UI --> Router
    Router --> AuthCtx
    AuthCtx --> ServiceLayer

    ServiceLayer -- "1. Authenticate & Token Refresh" --> SupabaseAuth
    ServiceLayer -- "2. File Upload (Invoices, Proofs, Evidence)" --> Storage
    ServiceLayer -- "3. Employee Creation & Email Dispatch" --> EdgeFuncs
    ServiceLayer -- "4. Atomic RPC Invocations & PostgREST Queries" --> RLS

    RLS --> RPC
    RPC --> PublicSchema
    RPC --> AuditEngine
    EdgeFuncs -- "Service Role" --> PublicSchema
```

---

## 2. Core Architectural Components

### 2.1 Single Page Application (SPA) Tier
- **Framework**: React 19 with Vite 6.4 bundler.
- **Client Routing**: React Router 7 (`react-router-dom`) with declarative protected route guards (`<ProtectedRoute allowedRoles={[...]} />`).
- **Styling System**: Tailwind CSS 3.4 with custom palette (slate-950 dark theme), Lucide React iconography, and Recharts operational data visualizations.
- **Client Document Processing**: Client-side PDF rendering via `pdfjs-dist` worker and image compression via `browser-image-compression` to handle mobile delivery proof uploads efficiently.

### 2.2 Identity & Access Tier
- **Supabase Auth**: Issues and validates JWT session tokens.
- **Profile Resolution**: The frontend maps `auth.uid()` against `public."User"."supabaseUserId"` to establish tenant ownership, role definitions, and business profile.
- **Status Gate**: Accounts in `INACTIVE` or `SUSPENDED` status are terminated at the authentication layer before accessing application routes.

### 2.3 PostgreSQL Engine & Transaction Tier
Rather than delegating multi-table transactional guarantees to client JavaScript, all high-stakes warehouse actions execute directly inside PostgreSQL:
- **Atomic Operations**: Order status transitions, stock movements, and delivery verification submissions are handled by PostgreSQL stored procedures (`SECURITY DEFINER`).
- **Data Invariants**: Enforces business rules (e.g., negative stock protection, dispatch immutability, payment-before-verification prevention) at the database layer.
- **Audit Logging**: Every state change triggers synchronous records in `OrderStatusHistory` and `AuditLog`.

### 2.4 Serverless Edge Function Tier
Edge Functions run on Deno within Supabase:
1. `create-employee`: Securely provisions new warehouse and client staff by invoking Supabase Admin API and mapping local user records without exposing service role keys to browsers.
2. `send-email`: Formats and delivers transactional email notifications (order dispatch, verification confirmation, payment receipt) via Resend.

---

## 3. Data Flow Pathways

### 3.1 Order Lifecycle & Dispatch Flow
```mermaid
sequenceDiagram
    autonumber
    actor Staff as Warehouse Staff
    participant SPA as Warevo SPA
    participant DB as PostgreSQL (RPC)
    participant Edge as Edge Function (send-email)
    actor Client as Client Receiver

    Staff->>SPA: Create Order (Items, Client, Warehouse)
    SPA->>DB: rpc_create_order_with_invoice()
    DB-->>SPA: Order created with status = ISSUED
    Staff->>SPA: Mark Order Packed & Dispatched
    SPA->>DB: rpc_transition_order(orderId, 'DISPATCHED')
    DB-->>SPA: Status updated & Audit log recorded
    SPA->>Edge: Trigger new order notification
    Edge-->>Client: Email sent with tracking details & verification link
```

### 3.2 Client Delivery Verification & Invoicing Flow
```mermaid
sequenceDiagram
    autonumber
    actor Receiver as Client Receiver
    participant SPA as Warevo SPA
    participant Storage as Supabase Storage
    participant DB as PostgreSQL (RPC)
    actor Accounts as Warehouse Accountant

    Receiver->>SPA: Access Order Verification Portal
    Receiver->>Storage: Upload Delivery Evidence Photo
    Storage-->>SPA: Evidence Storage URL
    Receiver->>SPA: Submit Checklist (All items verified)
    SPA->>DB: rpc_submit_verification(status='VERIFIED', evidence)
    DB-->>SPA: Order verificationStatus = VERIFIED
    Accounts->>SPA: Review Order in Accounting Page
    SPA->>DB: rpc_record_payment_secure(invoiceId, amount, proof)
    DB-->>SPA: Payment logged & Invoice marked PAID
```

---

## 4. Multi-Tenant Data Isolation Architecture

```text
[ Tenant ] (e.g., "Apex Logistics" / "Pure Aura")
   │
   ├── [ Warehouse ] (Physical facility)
   │     └── [ WarehouseLocation ] (Aisles, Racks, Bins)
   │           └── [ Inventory ] ── [ Product ]
   │                 └── [ InventoryMovement ] (Immutable ledger)
   │
   ├── [ User ] (Warehouse Owner, Staff, Accountant)
   │
   └── [ Client ] (Customer Company)
         ├── [ ClientEmployee ] (MD, General Manager, Receiver, Accountant)
         │     └── [ RoleDefinition ] ── [ RolePermission ]
         │
         └── [ Order ]
               ├── [ OrderItem ]
               ├── [ OrderStatusHistory ]
               ├── [ OrderComment ]
               ├── [ DeliveryVerification ] ── [ DeliveryVerificationItem ]
               └── [ Invoice ]
                     ├── [ InvoiceItem ]
                     └── [ Payment ] (Transaction receipt & proof)
```

### Isolation Guarantees:
1. **Foreign Key Binding**: Operational tables must link to a valid `tenantId`.
2. **Row-Level Security**: All `SELECT`, `UPDATE`, and `DELETE` queries are filtered through `can_access_tenant("tenantId")`.
3. **Cross-Tenant Prevention**: If Tenant A sends a request containing Tenant B's order ID, PostgreSQL returns empty rows or raises an access error.
