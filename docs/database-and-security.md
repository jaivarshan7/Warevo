# Warevo — Database Architecture & Security Design

This document details the PostgreSQL database schema, Row-Level Security (RLS) enforcement, database migrations, stored procedures, and file storage security for **Warevo — Multi-Tenant Warehouse Management System (WMS)**.

---

## 1. Identity & Profile Architecture

Warevo integrates Supabase Auth (`auth.users`) with application-managed profiles (`public."User"`):

```text
[ Supabase Auth Engine ]
       │
       ▼
  auth.users (UUID id, email, phone, encrypted_password, raw_user_meta_data)
       │
       │ (1-to-1 match via User.supabaseUserId)
       ▼
  public."User"
       ├── id (TEXT Primary Key: usr_...)
       ├── tenantId (TEXT Foreign Key -> public."Tenant")
       ├── email (TEXT Unique)
       ├── name (TEXT)
       ├── role (ENUM public."Role")
       ├── status (ENUM public."UserStatus": ACTIVE, INACTIVE, SUSPENDED)
       └── supabaseUserId (TEXT Unique)
```

### Identity Resolution Function:
```sql
CREATE OR REPLACE FUNCTION public.get_current_actor()
RETURNS TABLE (actor_id text, tenant_id text, role text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u."tenantId", u.role::text
  FROM public."User" u
  WHERE u."supabaseUserId" = auth.uid()::text
    AND u.status = 'ACTIVE';
$$;
```

---

## 2. Row-Level Security (RLS) & Tenant Isolation

Row-Level Security is **enabled on all 35 application tables** in the public schema. 

### Tenant Boundary Helper:
```sql
CREATE OR REPLACE FUNCTION public.can_access_tenant(target_tenant_id text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor record;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT * INTO v_actor FROM public.get_current_actor();
    IF v_actor.actor_id IS NULL THEN
        RETURN false;
    END IF;

    -- PLATFORM_ADMIN has global access across all tenants
    IF v_actor.role = 'PLATFORM_ADMIN' THEN
        RETURN true;
    END IF;

    -- Tenant match check
    RETURN v_actor.tenant_id = target_tenant_id;
END;
$$;
```

### Standard Table Select Policy Example:
```sql
CREATE POLICY "order_select_policy"
ON public."Order"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND (
        public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
        OR public.can_access_client("clientId")
    )
);
```

---

## 3. Database Functions & Transactional RPCs

To eliminate race conditions and enforce zero-compromise data integrity, core mutations bypass direct table writes and execute via PostgreSQL RPCs:

| Function Name | Security Context | Purpose |
|:--------------|:----------------:|:--------|
| `rpc_transition_order` | `SECURITY DEFINER` | Validates state transition order, writes history log, and inserts audit entry atomically. |
| `rpc_submit_verification` | `SECURITY DEFINER` | Records client checklist responses, updates verification status, and attaches photos. |
| `rpc_add_delivery_evidence` | `SECURITY DEFINER` | Appends proof images without overwriting previous evidence. |
| `rpc_update_order_before_dispatched` | `SECURITY DEFINER` | Permits modifications only while order is not yet dispatched. |
| `rpc_receive_or_adjust_stock` | `SECURITY DEFINER` | Updates stock balances, validates non-negative availability, and logs `InventoryMovement`. |
| `rpc_get_email_sent_count` | `SECURITY DEFINER` | Computes aggregate sent email statistics without exposing raw email rows. |
| `rpc_record_payment_secure` | `SECURITY DEFINER` | Updates invoice balances and stores payment references in a single transaction. |

---

## 4. Supabase Storage Policies & Security

All document buckets are configured as **private** to protect sensitive corporate assets:

| Bucket Name | Purpose | Visibility | Storage RLS Enforcement |
|:------------|:--------|:----------:|:------------------------|
| `invoices` | Generated and uploaded customer invoices | Private | Tenant match + Client ownership |
| `delivery-evidence` | Delivery photos and signed receipts | Private | Tenant match + Receiver upload access |
| `payment-proofs` | Bank transfer slips and payment receipts | Private | Tenant match + Accountant access |
| `warehouse-documents` | Operational checklists and manifests | Private | Warehouse staff and admin only |

Storage paths follow the strict tenant convention:
`<tenant_id>/<resource_id>/<file_name>`

---

## 5. Database Migrations & Version Control

Migrations are tracked chronologically in [`supabase/migrations/`](file:///d:/Dev/warehouse_management/supabase/migrations):
- `20261018_000000_order_lifecycle_verification_evidence.sql`
- `20261019_000000_delivery_verification_override_and_timestamps.sql`
- `20261020_000000_get_email_sent_count_rpc.sql`

To deploy to fresh production environments without migration chain conflicts, follow [`docs/PRODUCTION_SCHEMA_BOOTSTRAP.md`](file:///d:/Dev/warehouse_management/docs/PRODUCTION_SCHEMA_BOOTSTRAP.md).
