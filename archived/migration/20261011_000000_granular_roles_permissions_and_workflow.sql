-- ============================================================================
-- Migration: 20261011_000000_granular_roles_permissions_and_workflow.sql
-- Description: Roles & Permissions Granular Authorization System,
--              Two-Stage Client Verification Workflow (Delivery -> Store -> Payment),
--              and Payment Authorization for Authorized Client Employees.
--
-- Preserves:
--   1. Authoritative auth.uid() actor resolution via get_current_actor() / resolve_current_actor().
--   2. Strict tenant and client company / corporate group isolation.
--   3. Phase 6B/6C invoice sequencing, order creation, and immutability.
--   4. OrderStatus state machine: ISSUED, PROCESSING, READY_FOR_DISPATCH, DISPATCHED, VERIFIED.
--      (PAID is never an OrderStatus; it is a PaymentStatus).
--   5. ClientEmployeeRole enum remains: RECEIVER, STORE, ACCOUNT, MANAGER, GM, MD.
-- ============================================================================

-- ============================================================================
-- PART 1: Role, Permission, RolePermission Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."RoleDefinition" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "tenantId" TEXT REFERENCES public."Tenant"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemRole" BOOLEAN NOT NULL DEFAULT FALSE,
    "status" public."UserStatus" NOT NULL DEFAULT 'ACTIVE'::public."UserStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Role_tenantId_idx" ON public."RoleDefinition"("tenantId");
CREATE INDEX IF NOT EXISTS "Role_name_idx" ON public."RoleDefinition"("name");

-- Unique role name per tenant (and globally for system roles where tenantId is NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Role_tenantId_name_key'
    ) THEN
        CREATE UNIQUE INDEX "Role_tenantId_name_unique_idx"
        ON public."RoleDefinition" (COALESCE("tenantId", '__SYSTEM__'), "name");
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."Permission" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "key" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Permission_category_idx" ON public."Permission"("category");

CREATE TABLE IF NOT EXISTS public."RolePermission" (
    "roleId" TEXT NOT NULL REFERENCES public."RoleDefinition"("id") ON DELETE CASCADE,
    "permissionId" TEXT NOT NULL REFERENCES public."Permission"("id") ON DELETE CASCADE,
    PRIMARY KEY ("roleId", "permissionId")
);

CREATE INDEX IF NOT EXISTS "RolePermission_roleId_idx" ON public."RolePermission"("roleId");
CREATE INDEX IF NOT EXISTS "RolePermission_permissionId_idx" ON public."RolePermission"("permissionId");

-- Add roleId to ClientEmployee for custom role assignments
ALTER TABLE public."ClientEmployee"
ADD COLUMN IF NOT EXISTS "roleId" TEXT REFERENCES public."RoleDefinition"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "ClientEmployee_roleId_idx" ON public."ClientEmployee"("roleId");

-- Add verification tracking columns to Order
ALTER TABLE public."Order"
ADD COLUMN IF NOT EXISTS "deliveryVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deliveryVerifiedById" TEXT REFERENCES public."User"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "storeVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "storeVerifiedById" TEXT REFERENCES public."User"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Order_deliveryVerifiedAt_idx" ON public."Order"("deliveryVerifiedAt");
CREATE INDEX IF NOT EXISTS "Order_storeVerifiedAt_idx" ON public."Order"("storeVerifiedAt");


-- ============================================================================
-- PART 2: Seed Granular Permissions & Built-in System Roles
-- ============================================================================

INSERT INTO public."Permission" ("key", "name", "description", "category")
VALUES
    ('ORDERS_VIEW', 'View Orders', 'View client order list and order details', 'Orders'),
    ('ORDERS_PROCESS', 'Process Orders', 'Advance order processing workflow', 'Orders'),
    ('ORDERS_DISPATCH', 'Dispatch Orders', 'Confirm shipment dispatch', 'Orders'),
    ('DELIVERY_VERIFY', 'Verify Delivery', 'Verify delivered goods and physical condition', 'Delivery'),
    ('INVENTORY_VERIFY', 'Verify Inventory', 'Verify received items, count, and store inventory update', 'Inventory'),
    ('INVOICES_VIEW', 'View Invoices', 'View commercial invoices and tax details', 'Invoices'),
    ('INVOICES_MANAGE', 'Manage Invoices', 'Manage and download commercial invoices', 'Invoices'),
    ('ACCOUNTS_VIEW', 'View Accounts', 'View account balances, ledger, and payment status', 'Accounts'),
    ('PAYMENTS_VIEW', 'View Payments', 'View recorded payments and payment history', 'Payments'),
    ('PAYMENTS_RECORD', 'Record Payments', 'Record invoice payment settlement', 'Payments'),
    ('PAYMENT_PROOF_UPLOAD', 'Upload Payment Proof', 'Upload payment receipt or transfer proof', 'Payments'),
    ('REPORTS_VIEW', 'View Reports', 'Access operational and financial reports', 'Reports')
ON CONFLICT ("key") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "category" = EXCLUDED."category";

-- Seed Built-in System Roles (tenantId = NULL indicates system-wide built-in role)
INSERT INTO public."RoleDefinition" ("id", "tenantId", "name", "description", "systemRole", "status")
VALUES
    ('role_md', NULL, 'MD', 'Managing Director - Full client workflow and financial access', TRUE, 'ACTIVE'),
    ('role_gm', NULL, 'GM', 'General Manager - Full client workflow and financial access', TRUE, 'ACTIVE'),
    ('role_manager', NULL, 'MANAGER', 'Manager - Full client workflow and operational access', TRUE, 'ACTIVE'),
    ('role_receiver', NULL, 'RECEIVER', 'Product Receiver - Delivery verification only', TRUE, 'ACTIVE'),
    ('role_store', NULL, 'STORE', 'Storekeeper - Inventory and store verification only', TRUE, 'ACTIVE'),
    ('role_account', NULL, 'ACCOUNT', 'Accountant - Invoices, accounting, and payments only', TRUE, 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Assign permissions to MD (all permissions)
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
CROSS JOIN public."Permission" p
WHERE r."name" = 'MD' AND r."systemRole" = TRUE
ON CONFLICT DO NOTHING;

-- Assign permissions to GM (all permissions)
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
CROSS JOIN public."Permission" p
WHERE r."name" = 'GM' AND r."systemRole" = TRUE
ON CONFLICT DO NOTHING;

-- Assign permissions to MANAGER (all permissions)
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
CROSS JOIN public."Permission" p
WHERE r."name" = 'MANAGER' AND r."systemRole" = TRUE
ON CONFLICT DO NOTHING;

-- Assign permissions to RECEIVER: ORDERS_VIEW, DELIVERY_VERIFY
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
JOIN public."Permission" p ON p."key" IN ('ORDERS_VIEW', 'DELIVERY_VERIFY')
WHERE r."name" = 'RECEIVER' AND r."systemRole" = TRUE
ON CONFLICT DO NOTHING;

-- Assign permissions to STORE: ORDERS_VIEW, INVENTORY_VERIFY
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
JOIN public."Permission" p ON p."key" IN ('ORDERS_VIEW', 'INVENTORY_VERIFY')
WHERE r."name" = 'STORE' AND r."systemRole" = TRUE
ON CONFLICT DO NOTHING;

-- Assign permissions to ACCOUNT: INVOICES_VIEW, INVOICES_MANAGE, ACCOUNTS_VIEW, PAYMENTS_VIEW, PAYMENTS_RECORD, PAYMENT_PROOF_UPLOAD
INSERT INTO public."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM public."RoleDefinition" r
JOIN public."Permission" p ON p."key" IN ('INVOICES_VIEW', 'INVOICES_MANAGE', 'ACCOUNTS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_RECORD', 'PAYMENT_PROOF_UPLOAD')
WHERE r."name" = 'ACCOUNT' AND r."systemRole" = TRUE
ON CONFLICT DO NOTHING;

-- Auto-link any existing ClientEmployee records to their corresponding system role
UPDATE public."ClientEmployee" ce
SET "roleId" = r."id"
FROM public."RoleDefinition" r
WHERE r."systemRole" = TRUE
  AND r."name" = ce."employeeRole"::TEXT
  AND ce."roleId" IS NULL;


-- ============================================================================
-- PART 3: Enable RLS on New Tables
-- ============================================================================

ALTER TABLE public."RoleDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RolePermission" ENABLE ROW LEVEL SECURITY;

-- Permissions are readable by all authenticated users
DROP POLICY IF EXISTS "permission_select_policy" ON public."Permission";
CREATE POLICY "permission_select_policy"
ON public."Permission"
FOR SELECT
TO authenticated
USING (TRUE);

-- Roles are readable if system role (tenantId IS NULL) or accessible within actor's tenant
DROP POLICY IF EXISTS "role_select_policy" ON public."RoleDefinition";
CREATE POLICY "role_select_policy"
ON public."RoleDefinition"
FOR SELECT
TO authenticated
USING (
    "tenantId" IS NULL
    OR public.can_access_tenant("tenantId")
);

-- RolePermissions are readable if the associated role is readable
DROP POLICY IF EXISTS "role_permission_select_policy" ON public."RolePermission";
CREATE POLICY "role_permission_select_policy"
ON public."RolePermission"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public."RoleDefinition" r
        WHERE r."id" = "roleId"
          AND (r."tenantId" IS NULL OR public.can_access_tenant(r."tenantId"))
    )
);

GRANT SELECT ON TABLE public."RoleDefinition" TO authenticated;
GRANT SELECT ON TABLE public."Permission" TO authenticated;
GRANT SELECT ON TABLE public."RolePermission" TO authenticated;

GRANT ALL ON TABLE public."RoleDefinition" TO service_role;
GRANT ALL ON TABLE public."Permission" TO service_role;
GRANT ALL ON TABLE public."RolePermission" TO service_role;


-- ============================================================================
-- PART 4: Secure Permission Resolution Helper Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_client_employee RECORD;
    v_effective_role_id TEXT;
    v_has_perm BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- PLATFORM_ADMIN has all permissions
    IF v_actor.role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- Warehouse owner and moderator have full warehouse permissions
    IF v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR') THEN
        IF p_permission_key IN (
            'ORDERS_VIEW', 'ORDERS_PROCESS', 'ORDERS_DISPATCH',
            'DELIVERY_VERIFY', 'INVENTORY_VERIFY',
            'INVOICES_VIEW', 'INVOICES_MANAGE', 'ACCOUNTS_VIEW',
            'PAYMENTS_VIEW', 'PAYMENTS_RECORD', 'PAYMENT_PROOF_UPLOAD',
            'REPORTS_VIEW'
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Warehouse Staff operational permissions
    IF v_actor.role = 'WAREHOUSE_STAFF' THEN
        IF p_permission_key IN ('ORDERS_VIEW', 'ORDERS_PROCESS', 'ORDERS_DISPATCH') THEN
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END IF;

    -- Warehouse Accounting Team / Accountant permissions
    IF v_actor.role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM') THEN
        IF p_permission_key IN (
            'INVOICES_VIEW', 'INVOICES_MANAGE', 'ACCOUNTS_VIEW',
            'PAYMENTS_VIEW', 'PAYMENTS_RECORD', 'PAYMENT_PROOF_UPLOAD',
            'REPORTS_VIEW', 'ORDERS_VIEW'
        ) THEN
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END IF;

    -- Client accountant without ClientEmployee record defaults to ACCOUNT permissions
    IF v_actor.role = 'CLIENT_ACCOUNTANT' THEN
        IF p_permission_key IN (
            'INVOICES_VIEW', 'INVOICES_MANAGE', 'ACCOUNTS_VIEW',
            'PAYMENTS_VIEW', 'PAYMENTS_RECORD', 'PAYMENT_PROOF_UPLOAD'
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Resolve for CLIENT and CLIENT_ACCOUNTANT via ClientEmployee
    IF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
        SELECT ce.* INTO v_client_employee
        FROM public."ClientEmployee" ce
        WHERE ce."userId" = v_actor.actor_id
          AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF NOT FOUND THEN
            -- No active employee record
            RETURN FALSE;
        END IF;

        -- Determine effective roleId: custom role if set, else built-in system role
        v_effective_role_id := v_client_employee."roleId";
        IF v_effective_role_id IS NULL THEN
            SELECT r."id" INTO v_effective_role_id
            FROM public."RoleDefinition" r
            WHERE r."name" = v_client_employee."employeeRole"::TEXT
              AND r."systemRole" = TRUE
            LIMIT 1;
        END IF;

        IF v_effective_role_id IS NULL THEN
            RETURN FALSE;
        END IF;

        -- Check if effective role is ACTIVE and has the requested permission
        SELECT EXISTS (
            SELECT 1
            FROM public."RolePermission" rp
            JOIN public."RoleDefinition" r ON r."id" = rp."roleId"
            JOIN public."Permission" p ON p."id" = rp."permissionId"
            WHERE rp."roleId" = v_effective_role_id
              AND r."status" = 'ACTIVE'
              AND p."key" = p_permission_key
        ) INTO v_has_perm;

        RETURN v_has_perm;
    END IF;

    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.has_permission(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION public.check_actor_permission(
    p_permission_key TEXT,
    p_target_client_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.has_permission(p_permission_key) THEN
        RETURN FALSE;
    END IF;

    IF p_target_client_id IS NOT NULL THEN
        RETURN public.can_access_client(p_target_client_id);
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.check_actor_permission(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_actor_permission(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_actor_permission(TEXT, TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION public.rpc_get_my_permissions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_client_employee RECORD;
    v_role_record RECORD;
    v_permissions JSONB := '[]'::JSONB;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RETURN jsonb_build_object('authenticated', false);
    END IF;

    IF v_actor.role = 'PLATFORM_ADMIN' THEN
        SELECT jsonb_agg(p."key") INTO v_permissions FROM public."Permission" p;
        RETURN jsonb_build_object(
            'authenticated', true,
            'role', v_actor.role,
            'permissions', COALESCE(v_permissions, '[]'::JSONB)
        );
    END IF;

    IF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
        SELECT ce.*, c."companyName"
        INTO v_client_employee
        FROM public."ClientEmployee" ce
        JOIN public."Client" c ON c."id" = ce."clientId"
        WHERE ce."userId" = v_actor.actor_id AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF FOUND THEN
            -- Custom role or system role
            SELECT jsonb_agg(p."key") INTO v_permissions
            FROM public."RolePermission" rp
            JOIN public."RoleDefinition" r ON r."id" = rp."roleId"
            JOIN public."Permission" p ON p."id" = rp."permissionId"
            WHERE rp."roleId" = COALESCE(
                v_client_employee."roleId",
                (SELECT id FROM public."RoleDefinition" WHERE name = v_client_employee."employeeRole"::TEXT AND systemRole = TRUE LIMIT 1)
            ) AND r."status" = 'ACTIVE';

            RETURN jsonb_build_object(
                'authenticated', true,
                'role', v_actor.role,
                'employeeRole', v_client_employee."employeeRole",
                'clientId', v_client_employee."clientId",
                'companyName', v_client_employee."companyName",
                'permissions', COALESCE(v_permissions, '[]'::JSONB)
            );
        END IF;
    END IF;

    -- Other tenant staff roles
    SELECT jsonb_agg(p."key") INTO v_permissions
    FROM public."Permission" p
    WHERE public.has_permission(p."key");

    RETURN jsonb_build_object(
        'authenticated', true,
        'role', v_actor.role,
        'permissions', COALESCE(v_permissions, '[]'::JSONB)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_my_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_my_permissions() FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_my_permissions() TO authenticated;


-- ============================================================================
-- PART 5: Fix Payment Authorization in rpc_record_payment_secure
-- Fixes: "Permission denied: payment management is not allowed for role CLIENT"
-- Authorizes: PLATFORM_ADMIN, WAREHOUSE_OWNER, ACCOUNTANT, ACCOUNTS_TEAM,
--             CLIENT_ACCOUNTANT, and CLIENT with permission PAYMENTS_RECORD
--             (MD, GM, MANAGER, ACCOUNT). Rejects RECEIVER and STORE.
-- Preserves: OrderStatus state machine (PAID is NOT an OrderStatus).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_record_payment_secure(
    p_invoice_id TEXT,
    p_amount NUMERIC,
    p_method TEXT DEFAULT 'BANK_TRANSFER',
    p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_invoice RECORD;
    v_payment_id TEXT;
    v_method TEXT;
    v_reference TEXT;
    v_total_paid NUMERIC(12,2);
    v_new_payment_status "PaymentStatus";
    v_client_employee RECORD;
BEGIN
    -- 1. Resolve current actor securely from database session
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- 2. Verify actor payment authorization
    IF v_actor.role IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTS_TEAM', 'ACCOUNTANT', 'CLIENT_ACCOUNTANT') THEN
        -- Standard authorized staff / accounting roles
        NULL;
    ELSIF v_actor.role = 'CLIENT' THEN
        -- Check ClientEmployee specific permission
        SELECT ce.* INTO v_client_employee
        FROM public."ClientEmployee" ce
        WHERE ce."userId" = v_actor.actor_id AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Permission denied: no active client employee record found for user';
        END IF;

        -- Explicit rejection for RECEIVER and STORE client roles
        IF v_client_employee."employeeRole" IN ('RECEIVER', 'STORE') THEN
            RAISE EXCEPTION 'Permission denied: Client employee role % is not authorized to record payments',
                v_client_employee."employeeRole";
        END IF;

        -- Authorize via granular permission check
        IF NOT public.has_permission('PAYMENTS_RECORD') THEN
            RAISE EXCEPTION 'Permission denied: payment management is not allowed for current role';
        END IF;
    ELSE
        RAISE EXCEPTION 'Permission denied: payment management is not allowed for role %', v_actor.role;
    END IF;

    -- 3. Validate payment amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- 4. Load and validate invoice
    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    -- 5. Tenant and Client isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id IS NULL OR v_actor.tenant_id != v_invoice."tenantId" THEN
            RAISE EXCEPTION 'Permission denied: invoice belongs to another tenant';
        END IF;

        -- Verify client actor has access to this client's invoice (respecting group-wide for MD/GM)
        IF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
            IF NOT public.can_access_client(v_invoice."clientId") THEN
                RAISE EXCEPTION 'Permission denied: invoice belongs to another client company';
            END IF;
        END IF;
    END IF;

    -- 6. Generate payment details
    v_payment_id := concat('pay_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    v_method := COALESCE(NULLIF(TRIM(p_method), ''), 'BANK_TRANSFER');
    v_reference := NULLIF(TRIM(p_reference), '');
    IF v_reference IS NULL THEN
        v_reference := concat('PAY-', right((extract(epoch from clock_timestamp()) * 1000)::bigint::text, 6));
    END IF;

    -- 7. Insert Payment record
    INSERT INTO "Payment" (
        "id", "tenantId", "invoiceId", "amount", "status", "method", "reference", "proofUrl", "paidAt", "createdAt"
    ) VALUES (
        v_payment_id,
        v_invoice."tenantId",
        v_invoice."id",
        p_amount,
        'PAID',
        v_method,
        v_reference,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

    -- 8. Calculate total paid from trusted database records
    SELECT COALESCE(SUM("amount"), 0) INTO v_total_paid
    FROM "Payment"
    WHERE "invoiceId" = v_invoice."id" AND "status" = 'PAID';

    -- 9. Determine new payment status on the Invoice
    -- Note: OrderStatus remains VERIFIED; PAID is strictly a PaymentStatus on Invoice/Payment
    IF v_total_paid >= v_invoice."total" THEN
        v_new_payment_status := 'PAID';
    ELSIF v_total_paid > 0 THEN
        v_new_payment_status := 'PARTIALLY_PAID';
    ELSE
        v_new_payment_status := 'UNPAID';
    END IF;

    -- 10. Update Invoice payment status
    UPDATE "Invoice"
    SET "paymentStatus" = v_new_payment_status,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_invoice."id";

    -- 11. Record in AuditLog using resolved actor
    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_invoice."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'RECORD_PAYMENT',
        'Payment',
        v_payment_id,
        jsonb_build_object(
            'amount', p_amount,
            'paymentStatus', v_new_payment_status,
            'method', v_method,
            'reference', v_reference,
            'totalPaid', v_total_paid,
            'invoiceTotal', v_invoice."total"
        ),
        CURRENT_TIMESTAMP
    );

    -- 12. Return payload
    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment_id,
        'invoiceId', v_invoice."id",
        'paymentStatus', v_new_payment_status,
        'totalPaid', v_total_paid
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_record_payment_secure(TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_record_payment_secure(TEXT, NUMERIC, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_record_payment_secure(TEXT, NUMERIC, TEXT, TEXT) TO authenticated;


-- ============================================================================
-- PART 6: Update rpc_attach_payment_proof for Authorized Client Employees
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_attach_payment_proof(
    p_payment_id TEXT,
    p_invoice_id TEXT,
    p_proof_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_payment RECORD;
    v_invoice RECORD;
    v_client_employee RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- Verify actor authorization
    IF v_actor.role IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTS_TEAM', 'ACCOUNTANT', 'CLIENT_ACCOUNTANT') THEN
        NULL;
    ELSIF v_actor.role = 'CLIENT' THEN
        SELECT ce.* INTO v_client_employee
        FROM public."ClientEmployee" ce
        WHERE ce."userId" = v_actor.actor_id AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Permission denied: active client employee record not found';
        END IF;

        IF v_client_employee."employeeRole" IN ('RECEIVER', 'STORE') THEN
            RAISE EXCEPTION 'Permission denied: Client employee role % is not authorized to upload payment proof',
                v_client_employee."employeeRole";
        END IF;

        IF NOT public.has_permission('PAYMENT_PROOF_UPLOAD') THEN
            RAISE EXCEPTION 'Permission denied: payment proof upload is not allowed';
        END IF;
    ELSE
        RAISE EXCEPTION 'Permission denied: payment proof attachment is not allowed for role %', v_actor.role;
    END IF;

    IF p_proof_url IS NULL OR TRIM(p_proof_url) = '' THEN
        RAISE EXCEPTION 'Proof URL cannot be empty';
    END IF;

    SELECT * INTO v_payment FROM "Payment" WHERE "id" = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment % not found', p_payment_id;
    END IF;

    IF v_payment."invoiceId" != p_invoice_id THEN
        RAISE EXCEPTION 'Permission denied: payment does not belong to invoice';
    END IF;

    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id IS NULL OR v_actor.tenant_id != v_payment."tenantId" THEN
            RAISE EXCEPTION 'Permission denied: payment belongs to another tenant';
        END IF;

        IF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
            IF NOT public.can_access_client(v_invoice."clientId") THEN
                RAISE EXCEPTION 'Permission denied: invoice belongs to another client company';
            END IF;
        END IF;
    END IF;

    UPDATE "Payment"
    SET "proofUrl" = p_proof_url
    WHERE "id" = p_payment_id;

    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_payment."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'ATTACH_PAYMENT_PROOF',
        'Payment',
        p_payment_id,
        jsonb_build_object('proofUrl', p_proof_url, 'invoiceId', p_invoice_id),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'paymentId', p_payment_id,
        'invoiceId', p_invoice_id,
        'proofUrl', p_proof_url
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_attach_payment_proof(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_attach_payment_proof(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_attach_payment_proof(TEXT, TEXT, TEXT) TO authenticated;


-- ============================================================================
-- PART 7: Update Delivery Verification RPC (rpc_submit_verification)
-- Authorizes: RECEIVER, MANAGER, GM, MD (via DELIVERY_VERIFY permission)
-- Rejects: STORE, ACCOUNT
-- Preserves: 6-parameter signature, checklist validation, and actor resolution.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_submit_verification(
    p_order_id text,
    p_status "VerificationStatus",
    p_responses jsonb,
    p_comments text DEFAULT NULL::text,
    p_attachments jsonb DEFAULT NULL::jsonb,
    p_user_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_order RECORD;
    v_user RECORD;
    v_client_employee RECORD;
    v_item JSONB;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit delivery verification';
    END IF;

    -- Authoritative user ID from session
    p_user_id := v_actor.actor_id;

    SELECT * INTO v_user FROM "User" WHERE "id" = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % not found', p_user_id;
    END IF;

    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    IF v_order.status = 'ISSUED' THEN
        RAISE EXCEPTION 'Order % is still in ISSUED status and cannot be verified until dispatched', v_order."orderNumber";
    END IF;

    IF v_order.status != 'DISPATCHED' THEN
        RAISE EXCEPTION 'This order (%) is not ready for client verification. Current status: %', v_order."orderNumber", v_order.status;
    END IF;

    IF p_status::text IN ('RECEIVED', 'VERIFICATION_PENDING', 'PENDING') THEN
        RAISE EXCEPTION 'Invalid verification status: %. Only VERIFIED, PARTIALLY_VERIFIED, or REJECTED are permitted', p_status;
    END IF;

    -- Tenant isolation check
    IF v_user."tenantId" IS NOT NULL AND v_user."tenantId" != v_order."tenantId" THEN
        RAISE EXCEPTION 'Cross-tenant verification access denied';
    END IF;

    -- Role & Granular Permission Validation
    IF v_user.role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT') THEN
        RAISE EXCEPTION 'Accounting users cannot submit delivery verifications';
    END IF;

    IF v_user.role = 'CLIENT' THEN
        SELECT ce.*, c."companyGroupId"
        INTO v_client_employee
        FROM "ClientEmployee" ce
        JOIN "Client" c ON c."id" = ce."clientId"
        WHERE ce."userId" = v_user.id AND ce."tenantId" = v_order."tenantId" AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Active client employee profile not associated with authenticated user';
        END IF;

        -- STORE and ACCOUNT cannot verify delivery
        IF v_client_employee."employeeRole" = 'STORE' THEN
            RAISE EXCEPTION 'Storekeepers (STORE) are restricted to inventory verification and cannot perform delivery verification';
        END IF;

        IF v_client_employee."employeeRole" = 'ACCOUNT' THEN
            RAISE EXCEPTION 'Accountants (ACCOUNT) cannot perform delivery verification';
        END IF;

        -- Verify granular permission DELIVERY_VERIFY
        IF NOT public.has_permission('DELIVERY_VERIFY') THEN
            RAISE EXCEPTION 'Permission denied: DELIVERY_VERIFY permission required';
        END IF;

        -- Company isolation: must match order's clientId (or corporate group for MD/GM)
        IF NOT public.can_access_client(v_order."clientId") THEN
            RAISE EXCEPTION 'Client employee is not authorized for this client order';
        END IF;
    END IF;

    -- Validate Checklist Items
    IF p_status = 'VERIFIED' THEN
        IF p_responses IS NULL OR jsonb_typeof(p_responses) != 'array' OR jsonb_array_length(p_responses) < 7 THEN
            RAISE EXCEPTION 'All 7 delivery inspection checklist items must be provided for verification';
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_responses)
        LOOP
            IF COALESCE((v_item->>'checked')::BOOLEAN, FALSE) IS NOT TRUE THEN
                RAISE EXCEPTION 'All inspection checklist items must be checked to confirm verification';
            END IF;
        END LOOP;
    END IF;

    -- Upsert VerificationResponse
    INSERT INTO "VerificationResponse" (
        "id", "tenantId", "orderId", "clientId", "userId", "status", "responses", "comments", "attachments", "createdAt"
    ) VALUES (
        concat('vr_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."clientId",
        p_user_id,
        p_status,
        p_responses,
        p_comments,
        p_attachments,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ("orderId") DO UPDATE
    SET "status" = p_status,
        "responses" = p_responses,
        "comments" = p_comments,
        "attachments" = p_attachments,
        "userId" = p_user_id;

    -- Update Order: Record delivery verification timestamp and user
    -- Order remains DISPATCHED until store/inventory verification is completed
    UPDATE "Order"
    SET "deliveryVerifiedAt" = CURRENT_TIMESTAMP,
        "deliveryVerifiedById" = p_user_id,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_order."id";

    -- Record Audit Log
    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_user_id,
        v_actor.role::"Role",
        'SUBMIT_DELIVERY_VERIFICATION',
        'Order',
        v_order."id",
        jsonb_build_object(
            'status', v_order."status",
            'deliveryVerifiedAt', v_order."deliveryVerifiedAt"
        ),
        jsonb_build_object(
            'status', v_order."status",
            'deliveryVerifiedAt', CURRENT_TIMESTAMP,
            'verifiedBy', p_user_id,
            'comments', p_comments
        ),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order."id",
        'orderNumber', v_order."orderNumber",
        'deliveryVerified', true,
        'inventoryPending', true,
        'orderStatus', v_order."status",
        'verifiedAt', CURRENT_TIMESTAMP,
        'verifiedBy', p_user_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) TO authenticated;


-- ============================================================================
-- PART 8: Store / Inventory Verification RPC (rpc_submit_store_verification)
-- Authorizes: STORE, MANAGER, GM, MD (via INVENTORY_VERIFY permission)
-- Rejects: RECEIVER, ACCOUNT
-- Advances order: DISPATCHED (with deliveryVerifiedAt) -> VERIFIED
-- Advances invoice payment status: UNPAID -> PAYMENT_PENDING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_submit_store_verification(
    p_order_id TEXT,
    p_items JSONB DEFAULT NULL,
    p_comments TEXT DEFAULT NULL,
    p_inventory_updated BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_order RECORD;
    v_client_employee RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit store inventory verification';
    END IF;

    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Order must be DISPATCHED with delivery verified first
    IF v_order.status != 'DISPATCHED' AND v_order.status != 'VERIFIED' THEN
        RAISE EXCEPTION 'Order % is in status % and cannot be store-verified', v_order."orderNumber", v_order.status;
    END IF;

    IF v_order."deliveryVerifiedAt" IS NULL AND v_order.status != 'VERIFIED' THEN
        RAISE EXCEPTION 'Delivery must be verified before storekeeper can verify inventory';
    END IF;

    IF v_actor.role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT') THEN
        RAISE EXCEPTION 'Accounting users cannot submit store inventory verifications';
    END IF;

    IF v_actor.role = 'CLIENT' THEN
        SELECT ce.*, c."companyGroupId"
        INTO v_client_employee
        FROM "ClientEmployee" ce
        JOIN "Client" c ON c."id" = ce."clientId"
        WHERE ce."userId" = v_actor.actor_id AND ce."tenantId" = v_order."tenantId" AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Active client employee profile not associated with authenticated user';
        END IF;

        -- RECEIVER cannot verify store inventory
        IF v_client_employee."employeeRole" = 'RECEIVER' THEN
            RAISE EXCEPTION 'Product Receivers (RECEIVER) cannot perform inventory verification. Storekeeper verification required';
        END IF;

        -- ACCOUNT cannot verify store inventory
        IF v_client_employee."employeeRole" = 'ACCOUNT' THEN
            RAISE EXCEPTION 'Accountants (ACCOUNT) cannot perform inventory verification';
        END IF;

        IF NOT public.has_permission('INVENTORY_VERIFY') THEN
            RAISE EXCEPTION 'Permission denied: INVENTORY_VERIFY permission required';
        END IF;

        IF NOT public.can_access_client(v_order."clientId") THEN
            RAISE EXCEPTION 'Client employee is not authorized for this client order';
        END IF;
    END IF;

    -- Confirm inventory updated flag
    IF p_inventory_updated IS NOT TRUE THEN
        RAISE EXCEPTION 'Store verification requires confirming client inventory was updated';
    END IF;

    -- Advance Order status to VERIFIED and record store verification timestamp
    UPDATE "Order"
    SET "storeVerifiedAt" = CURRENT_TIMESTAMP,
        "storeVerifiedById" = v_actor.actor_id,
        "verificationStatus" = 'VERIFIED',
        "status" = 'VERIFIED',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_order."id";

    -- Advance unpaid invoices for this order to PAYMENT_PENDING
    UPDATE "Invoice"
    SET "paymentStatus" = 'PAYMENT_PENDING',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "orderId" = v_order."id" AND "paymentStatus" = 'UNPAID';

    -- Record Order Status History
    INSERT INTO "OrderStatusHistory" (
        "id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt"
    ) VALUES (
        concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."status",
        'VERIFIED',
        v_actor.actor_id,
        COALESCE(p_comments, 'Store inventory verification completed. Order verified and payment pending.'),
        CURRENT_TIMESTAMP
    );

    -- Record in Audit Log
    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'SUBMIT_STORE_VERIFICATION',
        'Order',
        v_order."id",
        jsonb_build_object(
            'status', v_order."status",
            'verificationStatus', v_order."verificationStatus"
        ),
        jsonb_build_object(
            'status', 'VERIFIED',
            'verificationStatus', 'VERIFIED',
            'storeVerifiedAt', CURRENT_TIMESTAMP,
            'verifiedBy', v_actor.actor_id,
            'comments', p_comments
        ),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order."id",
        'orderNumber', v_order."orderNumber",
        'orderStatus', 'VERIFIED',
        'verificationStatus', 'VERIFIED',
        'paymentPending', true,
        'storeVerifiedAt', CURRENT_TIMESTAMP,
        'verifiedBy', v_actor.actor_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_store_verification(TEXT, JSONB, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_submit_store_verification(TEXT, JSONB, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_store_verification(TEXT, JSONB, TEXT, BOOLEAN) TO authenticated;


-- ============================================================================
-- PART 9: Administrative Roles & Permissions RPCs
-- Protected: PLATFORM_ADMIN (global + all tenants) and WAREHOUSE_OWNER (tenant only)
-- ============================================================================

-- List Roles
CREATE OR REPLACE FUNCTION public.rpc_admin_list_roles(p_tenant_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_effective_tenant_id TEXT;
    v_roles JSONB;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    IF v_actor.role NOT IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR') THEN
        RAISE EXCEPTION 'Unauthorized: only administrative users can access role definitions';
    END IF;

    IF v_actor.role = 'PLATFORM_ADMIN' THEN
        v_effective_tenant_id := p_tenant_id;
    ELSE
        v_effective_tenant_id := v_actor.tenant_id;
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', r."id",
                'tenantId', r."tenantId",
                'name', r."name",
                'description', r."description",
                'systemRole', r."systemRole",
                'status', r."status",
                'createdAt', r."createdAt",
                'updatedAt', r."updatedAt",
                'userCount', (
                    SELECT COUNT(*)::INT
                    FROM public."ClientEmployee" ce
                    WHERE ce."roleId" = r."id"
                       OR (ce."roleId" IS NULL AND r."systemRole" = TRUE AND ce."employeeRole"::TEXT = r."name")
                ),
                'permissions', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', p."id",
                            'key', p."key",
                            'name', p."name",
                            'description', p."description",
                            'category', p."category"
                        )
                    )
                    FROM public."RolePermission" rp
                    JOIN public."Permission" p ON p."id" = rp."permissionId"
                    WHERE rp."roleId" = r."id"
                ), '[]'::JSONB)
            ) ORDER BY r."systemRole" DESC, r."name" ASC
        ),
        '[]'::JSONB
    ) INTO v_roles
    FROM public."RoleDefinition" r
    WHERE (r."tenantId" IS NULL OR v_effective_tenant_id IS NULL OR r."tenantId" = v_effective_tenant_id);

    RETURN jsonb_build_object('success', true, 'roles', v_roles);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_list_roles(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_admin_list_roles(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_list_roles(TEXT) TO authenticated;


-- Create Custom Role
CREATE OR REPLACE FUNCTION public.rpc_admin_create_role(
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_tenant_id TEXT DEFAULT NULL,
    p_permission_keys TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_target_tenant_id TEXT;
    v_role_id TEXT;
    v_perm_key TEXT;
    v_perm_id TEXT;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    IF v_actor.role NOT IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER') THEN
        RAISE EXCEPTION 'Unauthorized: only PLATFORM_ADMIN or WAREHOUSE_OWNER can create custom roles';
    END IF;

    IF TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Role name cannot be empty';
    END IF;

    -- Prevent custom role from taking built-in system role names
    IF UPPER(TRIM(p_name)) IN ('MD', 'GM', 'MANAGER', 'RECEIVER', 'STORE', 'ACCOUNT') THEN
        RAISE EXCEPTION 'Role name "%" is reserved for system roles', p_name;
    END IF;

    IF v_actor.role = 'PLATFORM_ADMIN' THEN
        v_target_tenant_id := p_tenant_id;
    ELSE
        v_target_tenant_id := v_actor.tenant_id;
    END IF;

    v_role_id := concat('role_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

    INSERT INTO public."RoleDefinition" ("id", "tenantId", "name", "description", "systemRole", "status")
    VALUES (v_role_id, v_target_tenant_id, TRIM(p_name), TRIM(p_description), FALSE, 'ACTIVE');

    IF p_permission_keys IS NOT NULL AND array_length(p_permission_keys, 1) > 0 THEN
        FOREACH v_perm_key IN ARRAY p_permission_keys
        LOOP
            SELECT id INTO v_perm_id FROM public."Permission" WHERE key = v_perm_key;
            IF FOUND THEN
                INSERT INTO public."RolePermission" ("roleId", "permissionId")
                VALUES (v_role_id, v_perm_id)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_target_tenant_id,
        v_actor.actor_id,
        v_actor.role::"Role",
        'ROLE_CREATED',
        'Role',
        v_role_id,
        jsonb_build_object('name', p_name, 'description', p_description, 'permissions', p_permission_keys),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object('success', true, 'roleId', v_role_id, 'name', p_name);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_create_role(TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_admin_create_role(TEXT, TEXT, TEXT, TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_role(TEXT, TEXT, TEXT, TEXT[]) TO authenticated;


-- Update Role & Permissions
CREATE OR REPLACE FUNCTION public.rpc_admin_update_role(
    p_role_id TEXT,
    p_name TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_status "UserStatus" DEFAULT NULL,
    p_permission_keys TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_role RECORD;
    v_perm_key TEXT;
    v_perm_id TEXT;
    v_action TEXT := 'ROLE_UPDATED';
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    IF v_actor.role NOT IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER') THEN
        RAISE EXCEPTION 'Unauthorized: only PLATFORM_ADMIN or WAREHOUSE_OWNER can modify roles';
    END IF;

    SELECT * INTO v_role FROM public."RoleDefinition" WHERE "id" = p_role_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Role % not found', p_role_id;
    END IF;

    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_role."tenantId" IS NULL OR v_role."tenantId" != v_actor.tenant_id THEN
            RAISE EXCEPTION 'Tenant isolation violation: cannot modify role of another tenant';
        END IF;
    END IF;

    -- System role protection: cannot change name or deactivate built-in roles
    IF v_role."systemRole" = TRUE THEN
        IF p_name IS NOT NULL AND TRIM(p_name) != v_role."name" THEN
            RAISE EXCEPTION 'System role names cannot be renamed';
        END IF;
        IF p_status IS NOT NULL AND p_status != 'ACTIVE' THEN
            RAISE EXCEPTION 'System roles cannot be deactivated';
        END IF;
    END IF;

    IF p_status = 'INACTIVE' AND v_role."status" = 'ACTIVE' THEN
        v_action := 'ROLE_DEACTIVATED';
    ELSIF p_status = 'ACTIVE' AND v_role."status" = 'INACTIVE' THEN
        v_action := 'ROLE_REACTIVATED';
    END IF;

    UPDATE public."RoleDefinition"
    SET "name" = COALESCE(NULLIF(TRIM(p_name), ''), "name"),
        "description" = COALESCE(p_description, "description"),
        "status" = COALESCE(p_status, "status"),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_role_id;

    -- If permission keys provided, update permissions
    IF p_permission_keys IS NOT NULL THEN
        DELETE FROM public."RolePermission" WHERE "roleId" = p_role_id;

        FOREACH v_perm_key IN ARRAY p_permission_keys
        LOOP
            SELECT id INTO v_perm_id FROM public."Permission" WHERE key = v_perm_key;
            IF FOUND THEN
                INSERT INTO public."RolePermission" ("roleId", "permissionId")
                VALUES (p_role_id, v_perm_id)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_role."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        v_action,
        'Role',
        p_role_id,
        jsonb_build_object('name', v_role."name", 'status', v_role."status"),
        jsonb_build_object('name', COALESCE(p_name, v_role."name"), 'status', COALESCE(p_status, v_role."status")),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object('success', true, 'roleId', p_role_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_update_role(TEXT, TEXT, TEXT, "UserStatus", TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_admin_update_role(TEXT, TEXT, TEXT, "UserStatus", TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_update_role(TEXT, TEXT, TEXT, "UserStatus", TEXT[]) TO authenticated;


-- Delete Role (system protected; checks assigned employees)
CREATE OR REPLACE FUNCTION public.rpc_admin_delete_role(p_role_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_role RECORD;
    v_assigned_count INT;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    IF v_actor.role NOT IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER') THEN
        RAISE EXCEPTION 'Unauthorized: only PLATFORM_ADMIN or WAREHOUSE_OWNER can delete roles';
    END IF;

    SELECT * INTO v_role FROM public."RoleDefinition" WHERE "id" = p_role_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Role % not found', p_role_id;
    END IF;

    IF v_role."systemRole" = TRUE THEN
        RAISE EXCEPTION 'System roles cannot be deleted';
    END IF;

    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_role."tenantId" IS NULL OR v_role."tenantId" != v_actor.tenant_id THEN
            RAISE EXCEPTION 'Tenant isolation violation: cannot delete role of another tenant';
        END IF;
    END IF;

    -- Check if employees are assigned to this role
    SELECT COUNT(*) INTO v_assigned_count
    FROM public."ClientEmployee"
    WHERE "roleId" = p_role_id;

    IF v_assigned_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete role %: % employees are currently assigned to it. Please reassign them first',
            v_role."name", v_assigned_count;
    END IF;

    DELETE FROM public."RolePermission" WHERE "roleId" = p_role_id;
    DELETE FROM public."RoleDefinition" WHERE "id" = p_role_id;

    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_role."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'ROLE_DELETED',
        'Role',
        p_role_id,
        jsonb_build_object('name', v_role."name"),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object('success', true, 'roleId', p_role_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_delete_role(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_admin_delete_role(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_delete_role(TEXT) TO authenticated;

