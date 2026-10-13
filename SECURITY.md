# Security Policy — Warevo

Warevo is an enterprise multi-tenant Warehouse Management System (WMS) managing real-time inventory, financial invoices, client delivery proofs, and commercial supply chain records. Protecting client confidentiality and operational integrity is paramount.

---

## 1. Reporting Security Vulnerabilities

If you discover a security vulnerability within Warevo, **please do NOT report it publicly via GitHub issues or discussions**.

Instead, report it directly through responsible disclosure:
- **Security Contact**: Contact the maintainer privately at `security@warevo.online` (or repository maintainer profile).
- **Required Details**:
  - Description of the vulnerability and affected component.
  - Step-by-step reproduction steps or proof-of-concept.
  - Potential impact on tenant isolation or data integrity.
- **Response Timeline**:
  - Initial acknowledgement within **24 hours**.
  - Triage and severity assessment within **72 hours**.
  - Remediation patch and disclosure coordination following validation.

---

## 2. Secrets Management & Environment Hygiene

- **Never Commit Secrets**: Secrets such as `SUPABASE_SERVICE_ROLE_KEY`, database passwords, Resend API keys, or private signing keys must never be committed to Git.
- **Frontend vs. Backend Separation**:
  - The client SPA bundle only receives public keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`).
  - Elevated service credentials (`SUPABASE_SERVICE_ROLE_KEY`) are restricted exclusively to Supabase Edge Functions or administrative server environments.
- **Git Tracking Rules**: `.env`, `.env.local`, `.env.production`, and credential dumps are strictly excluded via `.gitignore`. Only `.env.example` is tracked.

---

## 3. Multi-Tenant Isolation Model

Tenant isolation is implemented in depth across multiple structural layers:

1. **Logical Separation by Tenant ID**:
   - All tenant-bound entities (`User`, `Warehouse`, `Client`, `Product`, `Inventory`, `Order`, `Invoice`, `Payment`) require a non-null `tenantId`.
2. **PostgreSQL Row-Level Security (RLS)**:
   - RLS is permanently enabled on **all 35 application tables** in the public schema.
   - The helper function `can_access_tenant("tenantId")` evaluates `auth.uid()` against the caller's authorized tenant.
   - Cross-tenant data leakage is blocked at the database engine level, even if client application filters were bypassed.
3. **Database Function Boundary (`SECURITY DEFINER`)**:
   - Atomic RPC functions execute under isolated search paths (`SET search_path = public, pg_temp`).
   - Functions resolve `public.get_current_actor()` and reject requests where the caller's tenant does not match the target entity.

---

## 4. Authentication & Authorization Boundaries

1. **Identity Resolution**:
   - User identity originates from Supabase Auth (`auth.uid()`).
   - The user record in `public."User"` must be in status `ACTIVE`. Inactive or suspended users are prevented from reading or mutating data.
2. **Role-Based Access Control (RBAC)**:
   - Platform superusers (`PLATFORM_ADMIN`) are strictly separated from tenant warehouse operators (`WAREHOUSE_OWNER`, `WAREHOUSE_STAFF`, `ACCOUNTANT`) and external client contacts (`CLIENT`, `CLIENT_ACCOUNTANT`).
   - Client employee actions are additionally restricted by `ClientEmployeeRole` (`MD`, `GENERAL_MANAGER`, `MANAGER`, `RECEIVER`, `ACCOUNTANT`).
3. **Client Isolation**:
   - External clients can only read orders, invoices, and tracking information belonging to their specific `clientId`.
   - Direct ID access to another client's order or invoice returns `null` or an authorization error.

---

## 5. Storage Security & Payment Proof Handling

Warevo stores commercial delivery photographs, signed receipt vouchers, and payment transaction proofs in Supabase Storage.

1. **Private Buckets**:
   - Buckets `invoices`, `delivery-evidence`, and `payment-proofs` are configured as **private**.
   - Public unrestricted read access is disabled.
2. **Path-Based Storage RLS Policies**:
   - Storage objects are partitioned by tenant: `<tenantId>/<resourceId>/<filename>`.
   - Storage RLS policies inspect the authenticated user's tenant ID and role before granting read or upload access.
3. **Evidence Append-Only Policy**:
   - Once a delivery photo or payment proof is uploaded, existing files cannot be overwritten or deleted by unauthorized clients, preserving audit integrity.
4. **Permanent Redaction in Documentation**:
   - Documentation, screenshots, and test fixtures must never contain actual commercial payment slips, bank account details, or customer signatures.

---

## 6. Prohibitions on Live Client Environment Testing

- **No Penetration Testing on Production**: You must NEVER conduct automated security scans, fuzzing, load testing, or vulnerability probes against live client deployments (`warevo.online` or production Supabase project `xiyfpcfgftdvrmuhemhk`).
- **Use Isolated Local Environment**: All security testing, RPC audits, and regression tests must run against local mock containers or an approved staging sandbox with synthetic seed data.
- **No Production Data Modification**: Never create, edit, or delete production database rows for testing or demonstration purposes.
