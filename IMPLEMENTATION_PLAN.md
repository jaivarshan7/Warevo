# IMPLEMENTATION PLAN — Employee Role Management Fix

**Project:** Multi-Tenant WMS (Warehouse Management System)  
**Prepared by:** Senior Architect  
**Date:** 2026-09-13  
**Branch:** develop  
**Status:** READY FOR IMPLEMENTATION  
**Constraint:** This document is READ-ONLY analysis. Do NOT modify any source code until the plan is approved.

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Source of Truth](#3-source-of-truth)
4. [Files Needing Changes](#4-files-needing-changes)
5. [Database Changes Required](#5-database-changes-required)
6. [RLS and Security Changes](#6-rls-and-security-changes)
7. [Backend and Data Flow](#7-backend-and-data-flow)
8. [Frontend Changes](#8-frontend-changes)
9. [Role Assignment Matrix](#9-role-assignment-matrix)
10. [Employee Filtering Rules](#10-employee-filtering-rules)
11. [Edge Cases](#11-edge-cases)
12. [Testing Plan](#12-testing-plan)
13. [Implementation Order](#13-implementation-order)
14. [Acceptance Criteria](#14-acceptance-criteria)

---

## 1. Current Architecture

### 1.1 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 6 (NOT Next.js despite package presence) |
| Routing | react-router-dom v7 |
| Forms | react-hook-form + zod |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma (used for schema/migrations; NOT used for runtime queries) |
| Runtime DB client | `@supabase/supabase-js` v2 (direct table queries, no ORM at runtime) |
| Auth | Supabase Auth (Google OAuth) + email/mobile lookup (no password) |
| Security model | Row-Level Security (RLS) on all tables |
| Style | Tailwind CSS v3 |
| State | React Context (AuthContext) + local component state |

### 1.2 Authentication Flow

```
User visits app
  └─► AuthContext.initAuth()
        ├─► Load ALL Tenants from Supabase ("Tenant" table)
        ├─► Load ALL Users from Supabase ("User" table, ALL roles, no filter)
        ├─► Check Supabase Auth session (OAuth token or stored session)
        │     └─► Match Supabase email → WMS User record by email
        └─► Store matched User in React context as `user`

Login via Google OAuth:
  User → Google → Supabase → /auth/callback → AuthCallbackPage
    └─► resolveWmsUserByEmail(email) → matches User record → setUser()

Login via email/mobile:
  signInWithEmail(identifier) → searches in-memory allUsers list by email/mobile
    └─► switchUser(matchingUser.id) → sets user in context from in-memory list
    ⚠ NO password verification — just matching on email or mobile
```

**Critical observation:** The Supabase client is initialized with the **anon key** (not service role). All queries run in the `anon`/`authenticated` role context. The RLS policies (see §6) currently grant `FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true)` — meaning RLS is effectively disabled for all tables.

### 1.3 Dual Role System

There are **two separate role concepts** in the system:

**System Role** (`Role` type on `User.role`):
```
PLATFORM_ADMIN     — cross-tenant super admin
MANAGER            — tenant manager
GM                 — general manager
WAREHOUSE_OWNER    — tenant owner (each tenant has one)
WAREHOUSE_MODERATOR — warehouse ops moderator
ACCOUNTS_TEAM      — accounts team member
WAREHOUSE_STAFF    — warehouse floor staff
PRODUCT_RECEIVER   — receives products
ACCOUNTANT         — handles invoices/payments
CLIENT             — client portal user (external)
CLIENT_ACCOUNTANT  — client's accountant (external)
```

**Client Employee Role** (`ClientEmployeeRole` type on `Client.employeeRole`):
```
RECEIVER, STORE, ACCOUNT, MANAGER, GM, MD
```

These are completely independent. A User with `role = "CLIENT"` also has a linked `Client` record that carries `employeeRole`. The `ClientEmployeeRole` is the client company's internal designation; it does NOT affect WMS permissions.

### 1.4 Tenant Isolation Model

- Every WMS resource (Order, Inventory, Invoice, etc.) has a `tenantId` column.
- `User.tenantId` links users to tenants.
- `Client.tenantId` links client records to tenants.
- **WAREHOUSE_OWNER** users have `tenantId` = their own tenant.
- **CLIENT** users also have `tenantId` = the warehouse tenant they belong to (NOT their own company's ID).
- `PLATFORM_ADMIN` has no tenantId (null or system-level).

### 1.5 Current Supabase RLS State

**File:** `supabase/migrations/20260905_enable_rls.sql`

RLS is **enabled** on all tables but the policy is wide-open:

```sql
CREATE POLICY "Allow all for anon and authenticated"
ON public.<table>
FOR ALL TO anon, authenticated, service_role
USING (true) WITH CHECK (true);
```

This means: **Anyone with a valid Supabase anon key can read and write ANY row in ANY table.** There is no tenant isolation enforced at the database level. All isolation is handled exclusively in TypeScript application code — which can be bypassed.

### 1.6 Supabase RPC Functions (SECURITY DEFINER)

The existing RPCs are well-designed atomic operations:
- `rpc_transition_order` — order status state machine with role checks
- `rpc_receive_or_adjust_stock` — inventory stock movements
- `rpc_submit_verification` — client delivery verification
- `rpc_generate_invoice` — invoice generation with business rules
- `rpc_record_payment` — payment recording

These run as `SECURITY DEFINER` (bypasses RLS, runs as postgres superuser). They implement their own business logic validation. Role-change operations do NOT have a corresponding RPC — they go through direct table `UPDATE` queries.

---

## 2. Root Cause Analysis

### 2.1 Problem 1: CLIENT Users Appear in Employees List

**File:** `src/lib/services.ts`, function `fetchEmployees` (lines 2496–2509)

**Current code:**
```typescript
export async function fetchEmployees(tenantId?: string | null) {
  let query = supabase
    .from("User")
    .select("*, tenant:Tenant(*)")
    .order("createdAt", { ascending: false });
  if (tenantId) {
    query = query.eq("tenantId", tenantId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as User[]) || [];
}
```

**Why this causes the bug:**

CLIENT users are stored in the `User` table with:
- `role = "CLIENT"` (or `"CLIENT_ACCOUNTANT"`)
- `tenantId = <warehouse_tenant_id>` — they belong to the warehouse tenant

The query filters ONLY by `tenantId`. Since CLIENT users share the same `tenantId` as warehouse employees, they are returned alongside actual employees. There is no role-based exclusion.

**Additionally**, WAREHOUSE_OWNER users also have `tenantId` set and should probably NOT be editable via this form (they should be managed at the platform level).

**Root cause verdict:** Missing `role` filter in `fetchEmployees()`.

---

### 2.2 Problem 2: Role Cannot Be Changed / Silently Corrupted

**File:** `src/pages/operations/EmployeesPage.tsx`, Edit Modal (~lines 634–740)

**The edit modal initializes `editRole` as:**
```typescript
setEditRole(employee.role || "WAREHOUSE_STAFF");
```

**The role `<select>` only offers:**
```typescript
const ALLOWED_EMPLOYEE_ROLES: Role[] = [
  "WAREHOUSE_STAFF",
  "PRODUCT_RECEIVER",
  "ACCOUNTS_TEAM",
  "ACCOUNTANT"
];
```

**What happens when a CLIENT user (from Problem 1) is opened for editing:**
1. `editRole` is initialized to `"CLIENT"`
2. The `<select>` element has no `<option value="CLIENT">` — only the 4 allowed roles
3. The browser HTML select defaults to the **first available option** — `"WAREHOUSE_STAFF"`
4. The user sees the select showing "Warehouse Staff" even though they're editing a CLIENT
5. If they save without changing the role dropdown, `editRole = "WAREHOUSE_STAFF"` (not `"CLIENT"`)
6. `editRole !== editingEmployee.role` → the "change" is included in the update payload
7. The CLIENT is silently promoted to WAREHOUSE_STAFF without anyone intending that

**What would happen if an employee with a valid role (e.g., WAREHOUSE_STAFF) is edited:**
- `editRole` initializes to `"WAREHOUSE_STAFF"` which IS in `ALLOWED_EMPLOYEE_ROLES`  
- The select shows `"Warehouse Staff"` correctly
- The user CAN change the role using the dropdown — this part WORKS
- `handleEditSubmit` DOES send `role` in the updates if changed — this part WORKS

**Conclusion about "role cannot be changed":** The claim is partially incorrect. For properly-filtered employee records (those with roles in `ALLOWED_EMPLOYEE_ROLES`), the role CAN be changed. The problem manifests most visibly when CLIENT users appear in the list (Problem 1) — their "role" field silently resets on edit. Once Problem 1 is fixed (filtering out CLIENT users), this part becomes largely moot for legitimate employee records.

**However**, there is a secondary concern: the role edit does not validate server-side that:
- The actor has permission to change roles
- The target user belongs to the actor's tenant
- The new role is within the permitted range

---

### 2.3 Problem 3: `updateEmployee` Has No Tenant Isolation or Authorization Check

**File:** `src/lib/services.ts`, function `updateEmployee` (lines 2536–2555)

**Current code:**
```typescript
export async function updateEmployee(
  id: string,
  payload: Partial<{ name: string; email: string; mobile: string; role: string; status: string; }>
) {
  const { data, error } = await supabase
    .from("User")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

**Security gaps:**
1. No check that `id` belongs to the same tenant as the current user
2. No check that the current user's role (`WAREHOUSE_OWNER`) is authorized to change roles
3. No check that `payload.role` is within `ALLOWED_EMPLOYEE_ROLES`
4. No check preventing privilege escalation (e.g., changing role to `WAREHOUSE_OWNER` or `PLATFORM_ADMIN`)
5. Given RLS allows all operations from `anon`/`authenticated` (§1.5), this is a genuine security hole

The only defenses currently are:
- Frontend validation that blocks `WAREHOUSE_OWNER` and `PLATFORM_ADMIN` from being created via `createEmployee`
- Frontend-only dropdown that limits role options in the Edit modal
- Both are client-side and trivially bypassable

---

### 2.4 Problem 4: `createClientEmployeeWithUser` Can Downgrade Employees

**File:** `src/lib/services.ts`, function `createClientEmployeeWithUser` (lines 2140–2316)

When a client employee already has an account (email match), the function overwrites their role:
```typescript
// (paraphrased from the code)
if (existingUser) {
  await supabase.from("User").update({ role: "CLIENT", clientId: newClient.id }).eq("id", existingUser.id);
}
```

If a `WAREHOUSE_STAFF` user's email is used when creating a client employee, they silently become a `CLIENT`. This is a separate but related bug.

---

## 3. Source of Truth

### 3.1 Where Role is Stored

| Store | Field | Purpose |
|---|---|---|
| Supabase `User` table | `role` (text/enum) | Authoritative system role |
| React AuthContext | `user.role` | In-memory cache, read-only at runtime |
| localStorage | `warehouse_os_user_id` | Session persistence (not role) |

**The Supabase `User.role` column is the single source of truth.** The React context reads it on login and holds it for the session. There is no token-based role (no JWT claims carry the role — the anon key's JWT claims only contain Supabase auth metadata, not WMS role).

### 3.2 How Role Affects Runtime Behavior

```
User.role (DB)
  └─► Loaded into allUsers[] in AuthContext.initAuth()
         └─► Matched to current session → user.role in context
               ├─► permissions.ts: hasPermission(role, "employees:manage")
               ├─► permissions.ts: canAccessRoute(role, "/operations/employees")
               ├─► ProtectedRoute: allowedRoles check
               └─► Page-level guards (inline checks in each page component)
```

**Note:** Role changes in the DB take effect on the NEXT login, not immediately. The current session keeps the old role until the user logs out and back in (or `refreshUsers()` is called and `switchUser()` is re-triggered).

### 3.3 Why There Are No JWT Role Claims

The Supabase client is initialized with `persistSession: true` and the anon key. WMS user roles are stored in the application's own `User` table, NOT in Supabase Auth's metadata. There are no custom JWT claims configured. This means the RLS policies cannot use `auth.uid()` to cross-reference roles — they have no way to know a user's WMS role from the JWT.

This is a fundamental architectural limitation that affects what RLS policies can enforce.

---

## 4. Files Needing Changes

### 4.1 Priority 1 — Critical Bug Fixes (Must Fix)

| File | Change Required | Risk |
|---|---|---|
| `src/lib/services.ts` | Add role filter to `fetchEmployees()` | Low — additive filter only |
| `src/lib/services.ts` | Add tenant isolation check to `updateEmployee()` | Medium — new validation logic |
| `src/lib/services.ts` | Add role validation to `updateEmployee()` | Medium — new validation logic |
| `supabase/migrations/` | New migration: `rpc_update_employee_role` secure RPC function | Medium — new SQL function |
| `src/lib/services.ts` | New function `updateEmployeeSecure()` calling the new RPC | Low — new function |

### 4.2 Priority 2 — Important Bug Fixes (Should Fix)

| File | Change Required | Risk |
|---|---|---|
| `src/lib/services.ts` | Guard `createClientEmployeeWithUser` from overwriting non-CLIENT roles | Medium |
| `src/pages/operations/EmployeesPage.tsx` | Guard edit modal: do not open for non-employee roles | Low |
| `src/pages/operations/EmployeesPage.tsx` | Add role-filter display warning for any leaked entries | Low |

### 4.3 Priority 3 — Security Hardening (Should Fix)

| File | Change Required | Risk |
|---|---|---|
| `supabase/migrations/` | New migration: restrictive RLS policies on `User` table | High — requires careful testing |
| `src/contexts/AuthContext.tsx` | `refreshUsers()` — re-hydrate session after role change | Low |

### 4.4 Files That Do NOT Need Changes

| File | Reason |
|---|---|
| `src/types/index.ts` | Role types are correct; `ALLOWED_EMPLOYEE_ROLES` is defined in EmployeesPage not here |
| `src/lib/permissions.ts` | Permission definitions are correct; `hasPermission` logic is sound |
| `src/components/auth/ProtectedRoute.tsx` | Works correctly; used properly in App.tsx |
| `src/App.tsx` | Route definitions are correct; `/operations/employees` is not protected (intentional — AppShell handles it) |
| `src/contexts/AuthContext.tsx` | Minor: `refreshUsers()` needs to re-normalize but body is otherwise correct |
| All RPC functions in `20260904_warehouse_os_core.sql` | These are correct; no changes needed |

---

## 5. Database Changes Required

### 5.1 New RPC: `rpc_update_employee`

A new `SECURITY DEFINER` function is needed to atomically validate and apply employee updates including role changes. This is the secure server-side gatekeeper.

**File to create:** `supabase/migrations/20260914_200000_rpc_update_employee.sql`

```sql
-- ============================================================================
-- Migration: 20260914_200000_rpc_update_employee.sql
-- Description: Secure server-side gatekeeper for employee management updates
--
-- SECURITY NOTICE:
-- The current WMS architecture uses a hybrid authentication model with permissive RLS.
-- Calls from the client use the anon key where p_actor_id and p_actor_role are supplied
-- by the caller. This function provides server-side business-rule validation
-- (tenant boundary checks, role transition validation, self-edit prevention, and
-- audit trail generation). However, it does NOT cryptographically bind WMS User.id
-- to the caller's connection identity. Full actor authentication and cryptographic
-- RLS binding remain a future migration task when all logins are tied to Supabase auth.uid().
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_update_employee(
    p_actor_id       TEXT,           -- The user making the change
    p_actor_role     "Role",         -- Stated actor role (validated against DB record)
    p_target_id      TEXT,           -- The employee being updated
    p_name           TEXT DEFAULT NULL,
    p_email          TEXT DEFAULT NULL,
    p_mobile         TEXT DEFAULT NULL,
    p_new_role       "Role" DEFAULT NULL,
    p_new_status     "UserStatus" DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor       RECORD;
    v_target      RECORD;
    v_prev_value  JSONB;
    v_new_value   JSONB;

    -- Single source of truth: employee roles allowed for targeting & assigning
    -- MUST stay synchronized with ALLOWED_EMPLOYEE_ROLES in src/types/index.ts
    v_allowed_employee_roles "Role"[] := ARRAY[
        'WAREHOUSE_STAFF',
        'PRODUCT_RECEIVER',
        'ACCOUNTS_TEAM',
        'ACCOUNTANT',
        'WAREHOUSE_MODERATOR'
    ]::"Role"[];

    -- Roles authorized to manage employees (verified against src/lib/permissions.ts:
    -- only WAREHOUSE_OWNER has employees:manage; PLATFORM_ADMIN is superadmin.
    -- MANAGER and GM do NOT have employees:manage in permissions.ts and are not authorized here)
    v_authorized_actor_roles "Role"[] := ARRAY[
        'WAREHOUSE_OWNER',
        'PLATFORM_ADMIN'
    ]::"Role"[];
BEGIN
    -- 1. Resolve the actor record from User table
    SELECT * INTO v_actor FROM "User" WHERE "id" = p_actor_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Actor % not found', p_actor_id;
    END IF;

    -- 2. Consistency check: validate that the actor's stated role matches their DB record
    -- (Server-side authorization check; see security notice above regarding auth model)
    IF v_actor.role != p_actor_role AND v_actor.role != 'PLATFORM_ADMIN' THEN
        RAISE EXCEPTION 'Actor role mismatch: stated %, actual %', p_actor_role, v_actor.role;
    END IF;

    -- 3. Check that the actor is authorized to manage employees
    IF NOT (v_actor.role = ANY(v_authorized_actor_roles)) THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot manage employees', v_actor.role;
    END IF;

    -- 4. Resolve the target employee record
    SELECT * INTO v_target FROM "User" WHERE "id" = p_target_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user % not found', p_target_id;
    END IF;

    -- 5. Enforce tenant isolation (PLATFORM_ADMIN bypasses tenant check)
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor."tenantId" IS NULL OR v_actor."tenantId" != v_target."tenantId" THEN
            RAISE EXCEPTION 'Tenant isolation violation: actor tenant % does not match target tenant %',
                v_actor."tenantId", v_target."tenantId";
        END IF;
    END IF;

    -- 6. Prevent acting on yourself via this function
    IF v_actor.id = v_target.id THEN
        RAISE EXCEPTION 'Cannot modify your own account via this function';
    END IF;

    -- 7. Target role check: Target must currently be an employee role
    -- (Prevents modifying CLIENT, WAREHOUSE_OWNER, MANAGER, GM, PLATFORM_ADMIN via this function)
    IF NOT (v_target.role = ANY(v_allowed_employee_roles)) THEN
        RAISE EXCEPTION 'Target user role % is not editable via employee management', v_target.role;
    END IF;

    -- 8. Strict Assignable Role Check:
    -- If a new role is requested, it MUST be an employee role.
    -- General-purpose role management (e.g. promoting to MANAGER, GM, OWNER, ADMIN)
    -- must continue through the dedicated admin flow, NOT this employee RPC.
    IF p_new_role IS NOT NULL THEN
        IF NOT (p_new_role = ANY(v_allowed_employee_roles)) THEN
            RAISE EXCEPTION 'Role % is not assignable via employee management', p_new_role;
        END IF;
    END IF;

    -- 9. Capture previous state for audit
    v_prev_value := to_jsonb(v_target);

    -- 10. Apply updates
    UPDATE "User"
    SET
        "name"      = COALESCE(p_name,       "name"),
        "email"     = COALESCE(p_email,      "email"),
        "mobile"    = COALESCE(p_mobile,     "mobile"),
        "role"      = COALESCE(p_new_role,   "role"),
        "status"    = COALESCE(p_new_status, "status")
    WHERE "id" = p_target_id;

    -- 11. Reload updated target for audit
    SELECT * INTO v_target FROM "User" WHERE "id" = p_target_id;
    v_new_value := to_jsonb(v_target);

    -- 12. Write audit log
    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId",
        "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_target."tenantId",
        p_actor_id,
        v_actor.role,
        'Updated employee record',
        'User',
        p_target_id,
        v_prev_value,
        v_new_value,
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'targetId', p_target_id,
        'previousRole', v_prev_value->>'role',
        'newRole', v_target.role
    );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_update_employee TO anon, authenticated, service_role;
```

**Why an RPC instead of direct UPDATE:**
- Runs as `SECURITY DEFINER` → bypasses the current permissive RLS, but executes our own validation
- Atomic: validation + update + audit log happen in one transaction
- Cannot be bypassed by frontend manipulation
- Mirrors the pattern already used for `rpc_transition_order` and other operations
- The RPC itself enforces all business rules; the frontend is just a UI

### 5.2 No Table Schema Changes Required

The existing `User` table has all required columns: `id`, `tenantId`, `role`, `name`, `email`, `mobile`, `status`. No new columns or tables are needed. No Prisma schema changes are needed.

### 5.3 Enum Consideration

The `role` column uses a PostgreSQL enum type `"Role"`. Adding new values would require a migration. **No new enum values are needed** — the existing values cover all scenarios.

---

## 6. RLS and Security Changes

### 6.1 Current State: Fully Open

```sql
-- Current policy (from 20260905_enable_rls.sql):
CREATE POLICY "Allow all for anon and authenticated"
ON public."User"
FOR ALL TO anon, authenticated, service_role
USING (true) WITH CHECK (true);
```

This is equivalent to RLS being off. Any request with the anon key can read, write, or delete any row.

### 6.2 Why Restrictive RLS on the User Table Is Architecturally Complex

The application uses the **anon key** for all operations. The anon JWT has no concept of which WMS user is the "actor". Without Supabase Auth integration (i.e., users logging in via Supabase Auth and the JWT carrying `auth.uid()`), RLS cannot distinguish which WMS user is making a request.

**Current auth model:**
- Some users log in via Google OAuth → they have a Supabase Auth session, `auth.uid()` is set
- Most users log in via email/mobile (no real authentication) → NO Supabase Auth session → `auth.uid()` is null → `authenticated` role is NOT set; these queries run as `anon`

This means any RLS policy using `auth.uid()` would break email/mobile login users entirely.

### 6.3 Recommended RLS Approach (Two-Phase)

#### Phase 1 (Immediate): Route All Mutations Through RPCs

The RPC approach (`SECURITY DEFINER`) is already the pattern in this codebase. The new `rpc_update_employee` function (§5.1) enforces all business rules server-side, even with the current permissive RLS. This is sufficient to close the privilege escalation hole.

**The permissive RLS policy can remain unchanged for now.** The RPC is the enforcement boundary.

#### Phase 2 (Future, Requires Auth Migration): Real RLS

To properly implement RLS, the following architectural change is needed:

1. All logins must go through Supabase Auth (not just Google OAuth — email login must also use Supabase Auth magic links or OTP)
2. The `User` table must have a `supabaseUserId` column populated for all users (the column exists: `User.supabaseUserId`)
3. RLS policies would use: `auth.uid() = "supabaseUserId"` for self-access, or cross-reference via a `get_current_wms_role()` helper function

**This Phase 2 is out of scope for the current fix.** It requires a full authentication architecture change.

### 6.4 Immediate Security Additions (New Migration)

**File to create:** `supabase/migrations/20260914_210000_user_table_rls_guards.sql`

```sql
-- Block direct UPDATE of role column on User table from anon/authenticated
-- (mutations must go through rpc_update_employee or rpc_update_admin_user)

-- Option A: If we can distinguish actors, add a restrictive UPDATE policy.
-- Since we cannot (anon key, no session context for all paths), at minimum
-- we constrain the CHECK clause to block direct role escalation.

-- For now: the RPC is the enforcement layer.
-- Future: once all users have supabaseUserId, tighten this.

-- Comment-only migration to document intent:
-- The rpc_update_employee function SECURITY DEFINER is the sole intended
-- path for employee role updates from the WAREHOUSE_OWNER interface.
-- Direct table updates to User.role through the anon client should be
-- replaced in services.ts with calls to rpc_update_employee.
```

> **Note:** A purely restrictive RLS policy on `User` would break existing functionality (admin dashboard, client creation, etc.) until every mutation is routed through RPCs. This must be done incrementally.

---

## 7. Backend and Data Flow

### 7.1 Current Data Flow (Broken)

```
WAREHOUSE_OWNER opens /operations/employees
  → EmployeesPage.loadEmployees()
    → fetchEmployees(tenant.id) [services.ts]
      → supabase.from("User").select("*").eq("tenantId", tenantId)
        ← Returns ALL users with matching tenantId
           (includes CLIENT, CLIENT_ACCOUNTANT, WAREHOUSE_OWNER itself)

WAREHOUSE_OWNER clicks Edit on a CLIENT user:
  → startEdit(employee) sets editRole = "CLIENT"
    → Edit modal opens; role <select> shows "Warehouse Staff" (default, CLIENT not in list)
    → User clicks Save without noticing
      → updateEmployee(id, { role: "WAREHOUSE_STAFF" }) [services.ts]
        → supabase.from("User").update({ role: "WAREHOUSE_STAFF" }).eq("id", id)
          ← CLIENT user is now WAREHOUSE_STAFF — SILENT DATA CORRUPTION
```

### 7.2 Target Data Flow (Fixed)

```
WAREHOUSE_OWNER opens /operations/employees
  → EmployeesPage.loadEmployees()
    → fetchEmployees(tenant.id) [services.ts — FIXED]
      → supabase.from("User").select("*")
            .eq("tenantId", tenantId)
            .in("role", EMPLOYEE_ROLES)  ← NEW: filters out CLIENT, OWNER, ADMIN
        ← Returns ONLY warehouse employee roles

WAREHOUSE_OWNER clicks Edit on an employee:
  → startEdit(employee) sets editRole = employee.role (always valid EMPLOYEE_ROLES)
    → Edit modal opens; role <select> correctly shows current role
    → User changes role and clicks Save
      → updateEmployeeSecure(actor.id, actor.role, target.id, updates) [services.ts — NEW]
        → supabase.rpc("rpc_update_employee", { ... })
          → PostgreSQL validates:
            ✓ Actor exists and role matches
            ✓ Actor is WAREHOUSE_OWNER/MANAGER/GM
            ✓ Target belongs to same tenant
            ✓ Target has employee role (not CLIENT/OWNER)
            ✓ New role is in allowed assignable set
            ✓ Writes update + audit log atomically
          ← Returns success or throws descriptive error
```

### 7.3 `services.ts` Changes in Detail

#### Change A: `fetchEmployees` — Add Role Filter

```typescript
// CURRENT (broken):
export async function fetchEmployees(tenantId?: string | null) {
  let query = supabase
    .from("User")
    .select("*, tenant:Tenant(*)")
    .order("createdAt", { ascending: false });
  if (tenantId) {
    query = query.eq("tenantId", tenantId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as User[]) || [];
}

// FIXED:
const EMPLOYEE_ROLES: Role[] = [
  "WAREHOUSE_STAFF",
  "PRODUCT_RECEIVER",
  "ACCOUNTS_TEAM",
  "ACCOUNTANT",
  "WAREHOUSE_MODERATOR",
];

export async function fetchEmployees(tenantId?: string | null) {
  let query = supabase
    .from("User")
    .select("*, tenant:Tenant(*)")
    .in("role", EMPLOYEE_ROLES)   // ← THE FIX
    .order("createdAt", { ascending: false });
  if (tenantId) {
    query = query.eq("tenantId", tenantId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as User[]) || [];
}
```

#### Change B: New `updateEmployeeSecure` Function

```typescript
// NEW function (replaces direct updateEmployee call from EmployeesPage):
export async function updateEmployeeSecure(params: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  name?: string;
  email?: string;
  mobile?: string;
  role?: Role;
  status?: UserStatus;
}): Promise<{ success: boolean; targetId: string; previousRole: string; newRole: string }> {
  const { data, error } = await supabase.rpc("rpc_update_employee", {
    p_actor_id:    params.actorId,
    p_actor_role:  params.actorRole,
    p_target_id:   params.targetId,
    p_name:        params.name ?? null,
    p_email:       params.email ?? null,
    p_mobile:      params.mobile ?? null,
    p_new_role:    params.role ?? null,
    p_new_status:  params.status ?? null,
  });
  if (error) throw error;
  if (!data?.success) throw new Error("Employee update failed");
  return data;
}
```

#### Change C: Guard `createClientEmployeeWithUser` Against Role Downgrade

In the existing `createClientEmployeeWithUser` function, before overwriting role to `"CLIENT"`:

```typescript
// CURRENT (dangerous):
if (existingUser) {
  await supabase.from("User").update({ role: "CLIENT", clientId: newClient.id }).eq("id", existingUser.id);
}

// FIXED — Only downgrade if the user is already CLIENT or has no current role:
if (existingUser) {
  const nonClientRoles: Role[] = [
    "WAREHOUSE_OWNER", "WAREHOUSE_STAFF", "WAREHOUSE_MODERATOR",
    "PRODUCT_RECEIVER", "ACCOUNTS_TEAM", "ACCOUNTANT", "MANAGER", "GM", "PLATFORM_ADMIN"
  ];
  if (nonClientRoles.includes(existingUser.role)) {
    throw new Error(
      `Cannot convert employee '${existingUser.name}' (${existingUser.role}) to a CLIENT. ` +
      `Create a separate account for their client access.`
    );
  }
  // Only proceed if they're already CLIENT or CLIENT_ACCOUNTANT
  await supabase.from("User").update({ clientId: newClient.id }).eq("id", existingUser.id);
}
```

---

## 8. Frontend Changes

### 8.1 `EmployeesPage.tsx` Changes

#### Change A: Replace `updateEmployee` Call with `updateEmployeeSecure`

In `handleEditSubmit`, replace:
```typescript
const updated = await updateEmployee(editingEmployee.id, updates);
```
With:
```typescript
const result = await updateEmployeeSecure({
  actorId: user!.id,
  actorRole: role,
  targetId: editingEmployee.id,
  name: updates.name,
  email: updates.email,
  mobile: updates.mobile,
  role: updates.role as Role | undefined,
  status: updates.status as UserStatus | undefined,
});
```
Then update the local state by refreshing the employee list.

#### Change B: Remove Stale Employee After Update

Currently the code does not refresh the list after an update — it shows a success message but the list still shows old data. After the RPC call:
```typescript
await loadEmployees(); // re-fetch the filtered list
```

#### Change C: Add Guard in `startEdit` for Non-Employee Roles

```typescript
const startEdit = (employee: User) => {
  if (employee.id === user?.id) return; // existing guard
  
  // Guard: should not appear due to filtering, but defensive check
  if (!ALLOWED_EMPLOYEE_ROLES.includes(employee.role as typeof ALLOWED_EMPLOYEE_ROLES[number])) {
    console.warn("Attempted to edit non-employee user via EmployeesPage:", employee.role);
    return;
  }
  
  // ... rest of edit setup
};
```

### 8.2 No Changes to UI Components or Routes

The `ProtectedRoute`, `App.tsx`, `AuthContext`, `permissions.ts`, and all other page components remain unchanged. The route `/operations/employees` is intentionally unprotected at the router level (all roles can reach the AppShell), but the page itself does not render actions for unauthorized roles.

---

## 9. Role Assignment Matrix

### 9.1 Who Can Assign Which Roles

| Actor Role | Can Assign Via Employee RPC | Cannot Assign |
|---|---|---|
| `PLATFORM_ADMIN` | `WAREHOUSE_STAFF`, `PRODUCT_RECEIVER`, `ACCOUNTS_TEAM`, `ACCOUNTANT`, `WAREHOUSE_MODERATOR` (Employee RPC is strictly scoped to employees; platform-wide role assignments continue via dedicated Admin flow) | Non-employee roles via this RPC |
| `WAREHOUSE_OWNER` | `WAREHOUSE_STAFF`, `PRODUCT_RECEIVER`, `ACCOUNTS_TEAM`, `ACCOUNTANT`, `WAREHOUSE_MODERATOR` | `WAREHOUSE_OWNER`, `PLATFORM_ADMIN`, `CLIENT`, `CLIENT_ACCOUNTANT`, `MANAGER`, `GM` |
| `MANAGER` | None (verified against `src/lib/permissions.ts`: does not possess `employees:manage`) | All |
| `GM` | None (verified against `src/lib/permissions.ts`: does not possess `employees:manage`) | All |
| All other roles | None — cannot manage employees | All |

### 9.2 Who Can Be Edited via `EmployeesPage`

| Target User's Current Role | Editable via EmployeesPage? | Reason |
|---|---|---|
| `WAREHOUSE_STAFF` | ✅ Yes | Core employee role |
| `PRODUCT_RECEIVER` | ✅ Yes | Core employee role |
| `ACCOUNTS_TEAM` | ✅ Yes | Core employee role |
| `ACCOUNTANT` | ✅ Yes | Core employee role |
| `WAREHOUSE_MODERATOR` | ✅ Yes (included in fetch filter) | Moderate-privilege employee |
| `WAREHOUSE_OWNER` | ❌ No | Tenant owner — admin-level only |
| `MANAGER` | ❌ No | Above EmployeesPage scope |
| `GM` | ❌ No | Above EmployeesPage scope |
| `CLIENT` | ❌ No | External client — managed via ClientsPage |
| `CLIENT_ACCOUNTANT` | ❌ No | External — managed via ClientsPage |
| `PLATFORM_ADMIN` | ❌ No | Platform-level — AdminDashboard only |

### 9.3 Role Transition Rules (Valid Changes via EmployeesPage)

Any role in `ALLOWED_EMPLOYEE_ROLES` can be changed to any other role in `ALLOWED_EMPLOYEE_ROLES`. No role in `ALLOWED_EMPLOYEE_ROLES` can be changed to a role outside that set via this interface.

```
WAREHOUSE_STAFF    ←→  PRODUCT_RECEIVER
WAREHOUSE_STAFF    ←→  ACCOUNTS_TEAM
WAREHOUSE_STAFF    ←→  ACCOUNTANT
WAREHOUSE_STAFF    ←→  WAREHOUSE_MODERATOR
PRODUCT_RECEIVER   ←→  ACCOUNTS_TEAM
PRODUCT_RECEIVER   ←→  ACCOUNTANT
PRODUCT_RECEIVER   ←→  WAREHOUSE_MODERATOR
ACCOUNTS_TEAM      ←→  ACCOUNTANT
ACCOUNTS_TEAM      ←→  WAREHOUSE_MODERATOR
ACCOUNTANT         ←→  WAREHOUSE_MODERATOR
```

---

## 10. Employee Filtering Rules

### 10.1 Query-Level Filter (What `fetchEmployees` Must Return)

```
User.tenantId = currentTenant.id
AND User.role IN (
  'WAREHOUSE_STAFF',
  'PRODUCT_RECEIVER',
  'ACCOUNTS_TEAM',
  'ACCOUNTANT',
  'WAREHOUSE_MODERATOR'
)
```

### 10.2 Display-Level Filter (Frontend, `filteredEmployees`)

Already applied in `EmployeesPage`:
```typescript
const filteredEmployees = employees.filter((emp) => {
  const term = searchTerm.toLowerCase();
  return (
    emp.name.toLowerCase().includes(term) ||
    emp.email?.toLowerCase().includes(term) ||
    emp.mobile?.includes(term) ||
    ROLE_LABELS[emp.role]?.toLowerCase().includes(term)
  );
});
```

After the query-level fix, this filter only needs to handle search; it no longer needs to guard for role leaks.

### 10.3 Who Can ACCESS `/operations/employees` Route

The route has no `ProtectedRoute` wrapper in `App.tsx`. Access is implied for all logged-in users who reach the AppShell. However, the page should (and currently does via partial logic) render differently per role:

| Role | Can view the page | Can see employee list | Can edit | Can create |
|---|---|---|---|---|
| `WAREHOUSE_OWNER` | ✅ | ✅ | ✅ | ✅ |
| `MANAGER` | ✅ | ✅ | ✅ | ✅ |
| `GM` | ✅ | ✅ | ✅ | ✅ |
| `WAREHOUSE_MODERATOR` | ✅ | ✅ | ❌ | ❌ |
| `WAREHOUSE_STAFF` | ✅ (navigate there) | ❌ (empty / no permission guard currently) | ❌ | ❌ |
| `CLIENT` | ❌ (should be blocked by layout but no ProtectedRoute) | ❌ | ❌ | ❌ |

> **Note:** The EmployeesPage currently has no inline role guard at the top to redirect unauthorized users. Adding a guard (redirect CLIENT users to `/dashboard`) is a defensive improvement but not the core fix.

---

## 11. Edge Cases

### 11.1 Self-Edit Prevention

**Current state:** `startEdit` checks `if (employee.id === user?.id) return;` — prevents editing self.  
`handleEditSubmit` also checks — double protection. ✅ Already handled.  
The new RPC also checks — triple protection. ✅

### 11.2 Tenant ID Missing

If `tenant?.id` is null/undefined, `fetchEmployees` is called without a tenantId and returns all users from all tenants (the condition `if (tenantId)` only adds the filter if truthy). **This is a bug.**

**Fix:** In `loadEmployees()`, if `!tenant?.id`, do NOT call `fetchEmployees` — return early with empty array (the existing code already does this correctly in EmployeesPage lines 87–90, but `fetchEmployees` itself doesn't guard).

### 11.3 WAREHOUSE_MODERATOR in Edit Form

`WAREHOUSE_MODERATOR` is included in the fetch filter so they appear in the list. However, `ALLOWED_EMPLOYEE_ROLES` in EmployeesPage does NOT include `WAREHOUSE_MODERATOR` — so the edit form would show an incorrect role for them (same Problem 2 as CLIENT, but less severe).

**Fix options:**
1. Add `WAREHOUSE_MODERATOR` to `ALLOWED_EMPLOYEE_ROLES` in EmployeesPage (allows demoting them to other roles)
2. Exclude `WAREHOUSE_MODERATOR` from the fetch filter (they appear invisible to WAREHOUSE_OWNER)
3. Show them as read-only in the list but without an Edit button

**Recommended:** Option 1 — include `WAREHOUSE_MODERATOR` in both the fetch filter and `ALLOWED_EMPLOYEE_ROLES`. A WAREHOUSE_OWNER should be able to assign/change a moderator to staff.

### 11.4 Employee with No tenantId

A `User` record could theoretically have a null `tenantId` (e.g., a newly created but unmapped user). The existing `WHERE tenantId = X` filter would exclude them — safe behavior.

### 11.5 Role Change Takes Effect Next Login

After `updateEmployeeSecure` succeeds, the target employee's in-memory session still has the old role. They will operate with the old role until they log out and back in. This is acceptable behavior — no immediate session invalidation mechanism exists.

**If this is a concern:** The `allUsers` list in `AuthContext` would need to be refreshed via `refreshUsers()`. The current user's own session checks `allUsers` on startup; changing someone else's role in the DB will be reflected on their NEXT login.

### 11.6 Concurrent Edit Conflict

If two WAREHOUSE_OWNERs edit the same employee simultaneously, the second `rpc_update_employee` will overwrite the first. No optimistic locking is implemented. Given this is a single-tenant owner scenario, concurrent edits are unlikely — acceptable risk.

### 11.7 Email Already In Use

When creating a new employee, `createEmployee` does not check for email uniqueness. If an email already exists in the `User` table, Supabase will return a unique constraint violation. The frontend should surface this error clearly.

---

## 12. Testing Plan

### 12.1 Unit Tests (Vitest — `vitest run`)

| Test | File | Assertion |
|---|---|---|
| `fetchEmployees` returns only employee roles | `src/lib/services.test.ts` | Mock Supabase: response includes CLIENT user → assert CLIENT not in return |
| `fetchEmployees` with null tenantId returns empty | `src/lib/services.test.ts` | Assert no query is fired, empty array returned |
| `updateEmployeeSecure` calls rpc with correct params | `src/lib/services.test.ts` | Spy on `supabase.rpc`, assert parameter names |

### 12.2 RPC Integration Tests (run against a test Supabase instance)

| Test | Expected Result |
|---|---|
| WAREHOUSE_OWNER updates WAREHOUSE_STAFF in same tenant | ✅ succeeds |
| WAREHOUSE_OWNER updates WAREHOUSE_STAFF in different tenant | ❌ `Tenant isolation violation` error |
| WAREHOUSE_OWNER changes role to `PLATFORM_ADMIN` | ❌ `Role not assignable` error |
| WAREHOUSE_OWNER changes role to `CLIENT` | ❌ `Role not assignable` error |
| WAREHOUSE_OWNER updates their own record | ❌ `Cannot modify your own account` error |
| WAREHOUSE_OWNER updates a `CLIENT` user | ❌ `Target user role CLIENT is not editable` error |
| WAREHOUSE_STAFF calls the RPC | ❌ `Unauthorized: role WAREHOUSE_STAFF cannot manage employees` error |
| PLATFORM_ADMIN updates any user in any tenant | ✅ succeeds |
| Role change from WAREHOUSE_STAFF to ACCOUNTANT | ✅ succeeds; audit log created |
| Actor's stated role doesn't match DB role | ❌ `Actor role mismatch` error |

### 12.3 End-to-End Manual Test Checklist

**Setup:**
- Tenant A: WAREHOUSE_OWNER (Alice), 3 WAREHOUSE_STAFFs, 2 CLIENTs
- Tenant B: WAREHOUSE_OWNER (Bob), 2 WAREHOUSE_STAFFs, 1 CLIENT

**Test Cases:**

1. **CLIENT not in list:** Log in as Alice → navigate to Employees → assert no CLIENT rows appear
2. **Role visible in edit:** Click Edit on a WAREHOUSE_STAFF → assert current role shows correctly in dropdown
3. **Role change persists:** Change WAREHOUSE_STAFF to ACCOUNTANT → save → refresh page → assert role is ACCOUNTANT
4. **Cross-tenant protection:** Using Supabase client directly, attempt `rpc_update_employee` targeting Bob's employee with Alice's actor ID → assert error
5. **Self-edit protection:** Click Edit on own account → assert modal does not open (or Edit button missing)
6. **CLIENT edit blocked:** Using browser dev tools, manually call `rpc_update_employee` targeting a CLIENT user → assert error `Target user role CLIENT is not editable`
7. **Privilege escalation blocked:** In Edit modal (after filtering fix), attempt to POST `role: "PLATFORM_ADMIN"` via dev tools → assert RPC rejects
8. **Audit log created:** After any role change, check `AuditLog` table → assert new entry with correct actor, target, previousRole, newRole

### 12.4 Regression Tests

| Existing Feature | Must Still Work After Fix |
|---|---|
| Create employee via "Add Employee" form | ✅ `createEmployee` is unchanged |
| Admin Dashboard user management | ✅ `updateAdminUserWithRoleAudit` is unchanged |
| Client management (ClientsPage) | ✅ `fetchClients`, `updateClient` are unchanged |
| Order management | ✅ All order RPCs are unchanged |
| Invoice and payment flow | ✅ All accounting functions unchanged |
| Google OAuth login | ✅ AuthContext unchanged |
| Email/mobile login | ✅ AuthContext unchanged |

---

## 13. Implementation Order

All changes should be implemented in this exact sequence to minimize breakage. **Each phase is independently deployable and independently testable.**

### Phase 1: Database — Create the Secure RPC (Deploy First)

1. Create migration file: `supabase/migrations/20260914_200000_rpc_update_employee.sql`
2. Apply migration to Supabase: `supabase db push` or `supabase migration up`
3. Verify function exists in Supabase SQL editor: `SELECT proname FROM pg_proc WHERE proname = 'rpc_update_employee';`
4. Run a quick manual test of the RPC via the Supabase SQL editor

**Why first:** The RPC must exist in the DB before the frontend can call it. Deploying the RPC first means it's ready when the frontend change lands.

### Phase 2: Backend (services.ts) — Fix Fetch Filter and Add Secure Update

5. In `src/lib/services.ts`: Add `EMPLOYEE_ROLES` constant and `.in("role", EMPLOYEE_ROLES)` to `fetchEmployees`
6. In `src/lib/services.ts`: Add new `updateEmployeeSecure` function
7. In `src/lib/services.ts`: Add guard to `createClientEmployeeWithUser` to prevent employee role downgrade
8. Verify TypeScript compiles: `npm run build`

**Why after RPC:** The new `updateEmployeeSecure` references the RPC. The `fetchEmployees` fix is independent — could go first, but grouping backend changes together is cleaner.

### Phase 3: Frontend (EmployeesPage.tsx) — Connect to New API

9. In `EmployeesPage.tsx`: Import and call `updateEmployeeSecure` instead of `updateEmployee` in `handleEditSubmit`
10. In `EmployeesPage.tsx`: Add `WAREHOUSE_MODERATOR` to `ALLOWED_EMPLOYEE_ROLES` and `ROLE_LABELS`
11. In `EmployeesPage.tsx`: Add defensive guard in `startEdit` for unexpected non-employee roles
12. In `EmployeesPage.tsx`: After successful update, call `loadEmployees()` to refresh the list
13. Verify TypeScript compiles and renders correctly: `npm run dev`

**Why last:** This is pure UI wiring. It depends on both the RPC (Phase 1) and the service functions (Phase 2) being in place.

### Phase 4: Validation and Testing

14. Run all unit tests: `npm test`
15. Run manual E2E checklist (§12.3)
16. Check Supabase AuditLog table for test entries
17. Verify no regressions in order management, invoicing, client operations

### Phase 5: (Optional, Future) Restrictive RLS

18. Audit all service functions — ensure every mutation goes through an RPC
19. Once all mutations are via RPCs (SECURITY DEFINER), tighten the RLS `UPDATE` policy on the `User` table
20. This phase requires careful testing and is out of scope for the immediate fix

---

## 14. Acceptance Criteria

The implementation is complete and correct when ALL of the following are true:

### AC-1: CLIENT Users Do NOT Appear in Employees List

- **Given:** A tenant with 5 WAREHOUSE_STAFF and 3 CLIENT users
- **When:** WAREHOUSE_OWNER navigates to `/operations/employees`
- **Then:** The list shows exactly the 5 WAREHOUSE_STAFF; the 3 CLIENT records are NOT visible

### AC-2: Employee Role Is Displayed Correctly in Edit Form

- **Given:** A WAREHOUSE_STAFF employee with `role = "ACCOUNTANT"`
- **When:** WAREHOUSE_OWNER clicks Edit on that employee
- **Then:** The role dropdown shows "Accountant" as the selected option

### AC-3: Role Change Persists Correctly

- **Given:** A WAREHOUSE_STAFF employee
- **When:** WAREHOUSE_OWNER changes their role to "Accounts Team" and saves
- **Then:** The database `User.role` is updated to `ACCOUNTS_TEAM`; the audit log records the change

### AC-4: Cross-Tenant Updates Are Rejected

- **Given:** WAREHOUSE_OWNER of Tenant A attempts to update a user belonging to Tenant B
- **When:** The RPC `rpc_update_employee` is called with a cross-tenant pair
- **Then:** The function raises an exception; no update is applied; no audit log is written for the attempted change

### AC-5: Privilege Escalation Is Rejected

- **Given:** A WAREHOUSE_OWNER
- **When:** They attempt to set an employee's role to `PLATFORM_ADMIN`, `WAREHOUSE_OWNER`, `CLIENT`, or any other non-assignable role
- **Then:** The RPC raises an exception; the role remains unchanged

### AC-6: Self-Edit Is Blocked

- **Given:** Any logged-in user on the Employees page
- **When:** Their own record appears in the list (should no longer happen after fix since WAREHOUSE_OWNER is excluded from the list)
- **Then:** If they somehow click Edit on their own record, the modal does not open (frontend guard) AND the RPC would reject it (server guard)

### AC-7: CLIENT Users Are Not Downgraded by createClientEmployeeWithUser

- **Given:** A WAREHOUSE_STAFF user with email `worker@company.com`
- **When:** An admin creates a new Client Employee using that same email via AdminDashboard
- **Then:** An error is raised: "Cannot convert employee to CLIENT"; the WAREHOUSE_STAFF role is unchanged

### AC-8: Existing Functionality Is Unchanged

- Orders, inventory, invoices, payments, client operations, and authentication all function exactly as before

### AC-9: Audit Trail Is Created for Every Role Change

- **Given:** Any successful role change via `rpc_update_employee`
- **Then:** An `AuditLog` record exists with: `entity = "User"`, `entityId = <target.id>`, `previousValue.role = <old_role>`, `newValue.role = <new_role>`, `userId = <actor.id>`, `userRole = <actor.role>`, `tenantId = <tenant.id>`

### AC-10: TypeScript Compiles Without Errors

- `npm run build` completes with 0 errors after all changes

---

## Appendix A: Questions A–N — Answered

**A. Where is `Role` defined?**  
`src/types/index.ts` — as a TypeScript union type. Also as a PostgreSQL enum `"Role"` referenced in the SQL (`"Role"` in CREATE FUNCTION signatures). The two must be kept in sync.

**B. How does RLS currently work on the User table?**  
The migration `20260905_enable_rls.sql` creates a single permissive policy: `FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true)`. RLS is technically enabled but the policy permits everything — equivalent to open access.

**C. What is the current `fetchEmployees` query?**  
`SELECT *, tenant:Tenant(*) FROM "User" WHERE "tenantId" = <tenantId> ORDER BY createdAt DESC`. No role filter. Returns all user types including CLIENT.

**D. Does the Edit form have a Role field?**  
Yes — `EmployeesPage.tsx` lines ~696–714 contain a `<select>` element for `editRole`. However it only offers `ALLOWED_EMPLOYEE_ROLES` options. If the current employee has a role outside that set (e.g., CLIENT from Problem 1), the select silently resets to the first option.

**E. Does `handleEditSubmit` send role in the update payload?**  
Yes — if `editRole !== editingEmployee.role`, it adds `updates.role = editRole`.

**F. What is `updateEmployee`'s security model?**  
None. It does `.update(payload).eq("id", id)` with no tenant check, no role validation, no actor authorization.

**G. Is there an existing secure role-change function?**  
Yes — `updateAdminUserWithRoleAudit` in `services.ts` (lines 2334–2460) is used only by `AdminDashboardPage` (PLATFORM_ADMIN only). It cannot be reused for WAREHOUSE_OWNER employee management because it's PLATFORM_ADMIN scoped.

**H. Can `createClientEmployeeWithUser` damage employee data?**  
Yes — if a WAREHOUSE_STAFF's email matches the one provided when creating a client employee, that staff member's role is silently overwritten to `"CLIENT"`.

**I. What is the Supabase Auth model? Does the JWT carry the WMS role?**  
No JWT role claims. Supabase anon key JWT contains only Supabase Auth metadata. WMS roles are in the application `User` table. Auth is hybrid: Supabase OAuth for Google login, email/mobile lookup (no real auth) for others.

**J. Is `WAREHOUSE_MODERATOR` in `ALLOWED_EMPLOYEE_ROLES`?**  
No — it's missing from `ALLOWED_EMPLOYEE_ROLES` in EmployeesPage. Should be added so moderators appear and can be edited/demoted.

**K. What tables need changing?**  
No table schema changes. Only a new RPC function (SQL) and TypeScript service function changes.

**L. What is the safest way to implement role changes server-side given this architecture?**  
A `SECURITY DEFINER` PostgreSQL RPC function (matching the existing pattern for order transitions). This bypasses the permissive RLS but enforces its own validation — the only viable approach given the current auth model.

**M. How does role affect what the user sees in the UI?**  
Via `permissions.ts` (`hasPermission`, `canAccessRoute`), `ProtectedRoute` component, and inline page-level role checks. None of these affect what's stored in the DB; they only gate what renders in the browser.

**N. What is the implementation order for zero-regression deployment?**  
Database RPC first → services.ts fix → EmployeesPage fix → test. See §13.

---

## Appendix B: File Quick-Reference

| File | Purpose | Changes Needed |
|---|---|---|
| `src/types/index.ts` | Type definitions & single source of truth | Centralize and export `ALLOWED_EMPLOYEE_ROLES` and `EmployeeRole` |
| `src/lib/services.ts` | All Supabase data operations | `fetchEmployees` filter fix; new `updateEmployeeSecure`; `createClientEmployeeWithUser` guard |
| `src/pages/operations/EmployeesPage.tsx` | Employees UI | Use `updateEmployeeSecure`; import `ALLOWED_EMPLOYEE_ROLES`; defensive edit guard; refresh after save |
| `supabase/migrations/20260914_200000_rpc_update_employee.sql` | New migration | New `rpc_update_employee` function |
| `src/lib/permissions.ts` | Permission map | Verified: only `WAREHOUSE_OWNER` and `PLATFORM_ADMIN` possess `employees:manage` |
| `src/contexts/AuthContext.tsx` | Auth state | NO changes needed |
| `src/components/auth/ProtectedRoute.tsx` | Route guard | NO changes needed |
| `src/App.tsx` | Routes | NO changes needed |
| `supabase/migrations/20260905_enable_rls.sql` | RLS policies | NO immediate changes (Phase 5 future work) |
| `supabase/migrations/20260904_warehouse_os_core.sql` | Existing RPCs | NO changes needed |
| `src/pages/operations/ClientsPage.tsx` | Clients UI | NO changes needed |
| `src/pages/admin/AdminDashboardPage.tsx` | Admin UI | NO changes needed |

---

## Appendix C: Security Disclosure & Boundary Statement

> **IMPORTANT ARCHITECTURAL NOTICE:**
> Current authentication architecture does not cryptographically bind WMS User.id to the Supabase caller for all login paths. The RPC provides server-side business-rule validation but does not replace proper authentication. Full RLS/actor authentication remains a future task.

