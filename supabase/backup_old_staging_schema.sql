


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "postgres";


CREATE TYPE "public"."ClientEmployeeRole" AS ENUM (
    'RECEIVER',
    'STORE',
    'ACCOUNT',
    'MANAGER',
    'GM',
    'MD'
);


ALTER TYPE "public"."ClientEmployeeRole" OWNER TO "postgres";


CREATE TYPE "public"."ClientStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE "public"."ClientStatus" OWNER TO "postgres";


CREATE TYPE "public"."DeliveryVerificationItemStatus" AS ENUM (
    'PENDING',
    'RECEIVED',
    'PARTIALLY_RECEIVED',
    'DAMAGED',
    'MISSING',
    'REJECTED'
);


ALTER TYPE "public"."DeliveryVerificationItemStatus" OWNER TO "postgres";


CREATE TYPE "public"."DocumentType" AS ENUM (
    'COMPANY_LOGO',
    'PRODUCT_IMAGE',
    'CLIENT_DOCUMENT',
    'DELIVERY_DOCUMENT',
    'VERIFICATION_PHOTO',
    'DAMAGE_EVIDENCE',
    'INVOICE_PDF',
    'OTHER'
);


ALTER TYPE "public"."DocumentType" OWNER TO "postgres";


CREATE TYPE "public"."EWayBillStatus" AS ENUM (
    'DRAFT',
    'READY',
    'SUBMITTED',
    'GENERATED',
    'FAILED',
    'CANCELLED',
    'EXPIRED'
);


ALTER TYPE "public"."EWayBillStatus" OWNER TO "postgres";


CREATE TYPE "public"."InventoryMovementType" AS ENUM (
    'PURCHASE',
    'RECEIPT',
    'ORDER_RESERVATION',
    'ORDER_ISSUE',
    'SALE',
    'RETURN',
    'ADJUSTMENT',
    'DAMAGE',
    'TRANSFER_IN',
    'TRANSFER_OUT'
);


ALTER TYPE "public"."InventoryMovementType" OWNER TO "postgres";


CREATE TYPE "public"."InvoiceImportStatus" AS ENUM (
    'UPLOADED',
    'PROCESSING',
    'EXTRACTION_COMPLETE',
    'REVIEW_REQUIRED',
    'CONFIRMED',
    'REJECTED',
    'PROCESSING_FAILED'
);


ALTER TYPE "public"."InvoiceImportStatus" OWNER TO "postgres";


CREATE TYPE "public"."InvoiceStatus" AS ENUM (
    'DRAFT',
    'FINAL',
    'SENT',
    'CANCELLED'
);


ALTER TYPE "public"."InvoiceStatus" OWNER TO "postgres";


CREATE TYPE "public"."NotificationType" AS ENUM (
    'NEW_ORDER',
    'ORDER_ISSUED',
    'PROCESSING_STARTED',
    'READY_FOR_DISPATCH',
    'ORDER_DISPATCHED',
    'CLIENT_RECEIVED_ORDER',
    'CLIENT_STARTED_VERIFICATION',
    'CLIENT_COMPLETED_VERIFICATION',
    'CLIENT_REJECTED_ORDER',
    'DAMAGE_REPORTED',
    'MISSING_ITEMS_REPORTED',
    'VERIFICATION_COMPLETED',
    'INVOICE_GENERATED',
    'INVOICE_SENT',
    'PAYMENT_RECEIVED',
    'PAYMENT_OVERDUE',
    'ORDER_COMPLETED'
);


ALTER TYPE "public"."NotificationType" OWNER TO "postgres";


CREATE TYPE "public"."OrderStatus" AS ENUM (
    'DRAFT',
    'ISSUED',
    'PROCESSING',
    'READY_FOR_DISPATCH',
    'DISPATCHED',
    'RECEIVED',
    'VERIFICATION_PENDING',
    'VERIFIED',
    'PARTIALLY_VERIFIED',
    'REJECTED',
    'INVOICE_PENDING',
    'INVOICED',
    'PAYMENT_PENDING',
    'PAID',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE "public"."OrderStatus" OWNER TO "postgres";


CREATE TYPE "public"."PaymentStatus" AS ENUM (
    'UNPAID',
    'PAYMENT_PENDING',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);


ALTER TYPE "public"."PaymentStatus" OWNER TO "postgres";


CREATE TYPE "public"."ProductStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE "public"."ProductStatus" OWNER TO "postgres";


CREATE TYPE "public"."Role" AS ENUM (
    'PLATFORM_ADMIN',
    'WAREHOUSE_OWNER',
    'WAREHOUSE_MODERATOR',
    'ACCOUNTANT',
    'WAREHOUSE_STAFF',
    'CLIENT',
    'CLIENT_ACCOUNTANT',
    'ACCOUNTS_TEAM'
);


ALTER TYPE "public"."Role" OWNER TO "postgres";


CREATE TYPE "public"."TenantStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED'
);


ALTER TYPE "public"."TenantStatus" OWNER TO "postgres";


CREATE TYPE "public"."UserStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE "public"."UserStatus" OWNER TO "postgres";


CREATE TYPE "public"."VerificationStatus" AS ENUM (
    'PENDING',
    'VERIFIED',
    'PARTIALLY_VERIFIED',
    'REJECTED'
);


ALTER TYPE "public"."VerificationStatus" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_client"("p_target_client_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
    v_client_tenant_id TEXT;
    v_client_company_group_id TEXT;
    v_actor_client_id TEXT;
    v_actor_employee_role "public"."ClientEmployeeRole";
    v_actor_company_group_id TEXT;
BEGIN
    -- Get current actor
    SELECT * INTO v_actor FROM public.get_current_actor();

    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- PLATFORM_ADMIN -> full access
    IF v_actor.role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- Fetch target client company details
    SELECT c."tenantId", c."companyGroupId"
    INTO v_client_tenant_id, v_client_company_group_id
    FROM public."Client" c
    WHERE c."id" = p_target_client_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Tenant boundary check (non-PLATFORM_ADMIN must match)
    IF v_actor.tenant_id != v_client_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- Staff roles -> full tenant client access
    IF v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_STAFF') THEN
        RETURN TRUE;
    END IF;

    -- Client roles -> scoped access via ClientEmployee.employeeRole
    IF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
        SELECT ce."clientId", ce."employeeRole", c."companyGroupId"
        INTO v_actor_client_id, v_actor_employee_role, v_actor_company_group_id
        FROM public."ClientEmployee" ce
        JOIN public."Client" c ON c."id" = ce."clientId"
        WHERE ce."userId" = v_actor.actor_id;

        IF NOT FOUND THEN
            RETURN FALSE;
        END IF;

        -- Direct client company match: always allowed for all roles (MD, GM, MANAGER, RECEIVER, STORE, ACCOUNT)
        IF p_target_client_id = v_actor_client_id THEN
            RETURN TRUE;
        END IF;

        -- Group-wide access: STRICTLY restricted to MD and GM
        IF v_actor_employee_role IN ('MD', 'GM') THEN
            IF v_actor_company_group_id IS NOT NULL AND v_client_company_group_id = v_actor_company_group_id THEN
                RETURN TRUE;
            END IF;
        END IF;

        -- All other roles (MANAGER, RECEIVER, STORE, ACCOUNT): company-only scope -> denied
        RETURN FALSE;
    END IF;

    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."can_access_client"("p_target_client_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_tenant"("p_target_tenant_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
BEGIN
    -- Get current actor (returns NULL if inactive/unauthenticated)
    SELECT * INTO v_actor FROM public.get_current_actor();

    -- No valid actor → denied
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- PLATFORM_ADMIN → platform-wide access
    IF v_actor.role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- Tenant match → allowed
    IF v_actor.tenant_id = p_target_tenant_id THEN
        RETURN TRUE;
    END IF;

    -- Cross-tenant without PLATFORM_ADMIN → denied
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."can_access_tenant"("p_target_tenant_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_delete_payment_proof_storage"("p_object_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_user_tenant_id TEXT;
    v_user_role      TEXT;
    v_user_status    TEXT;
    v_path_tenant_id TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT u."tenantId", u."role"::TEXT, u."status"::TEXT
    INTO v_user_tenant_id, v_user_role, v_user_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    IF NOT FOUND OR v_user_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    -- Only staff management roles allowed to delete payment proofs
    IF v_user_role NOT IN ('ACCOUNTS_TEAM', 'ACCOUNTANT', 'WAREHOUSE_OWNER', 'PLATFORM_ADMIN') THEN
        RETURN FALSE;
    END IF;

    IF v_user_role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    v_path_tenant_id := split_part(p_object_name, '/', 1);
    IF v_user_tenant_id IS NULL OR v_user_tenant_id != v_path_tenant_id THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."can_delete_payment_proof_storage"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_invoice"("p_invoice_tenant_id" "text", "p_invoice_client_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_user_id        TEXT;
    v_tenant_id      TEXT;
    v_role           TEXT;
    v_status         TEXT;
    v_client_id      TEXT;
    v_employee_role  "public"."ClientEmployeeRole";
    v_company_group_id TEXT;
    v_group_match    BOOLEAN;
BEGIN
    -- 1. Reject unauthenticated callers
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Resolve actor from User table using auth.uid()
    SELECT
        u."id",
        u."tenantId",
        u."role"::TEXT,
        u."status"::TEXT
    INTO
        v_user_id,
        v_tenant_id,
        v_role,
        v_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    -- 3. User not found or inactive -> denied
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    IF v_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    -- 4. PLATFORM_ADMIN -> platform-wide access
    IF v_role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- 5. Cross-tenant -> denied
    IF v_tenant_id IS NULL OR v_tenant_id != p_invoice_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- 6. Tenant staff roles -> full tenant access
    IF v_role IN ('WAREHOUSE_OWNER', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_MODERATOR') THEN
        RETURN TRUE;
    END IF;

    -- 7. Client roles -> scoped access via ClientEmployee.employeeRole
    IF v_role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
        SELECT
            ce."clientId",
            ce."employeeRole",
            c."companyGroupId"
        INTO
            v_client_id,
            v_employee_role,
            v_company_group_id
        FROM public."ClientEmployee" ce
        JOIN public."Client" c ON c."id" = ce."clientId"
        WHERE ce."userId" = v_user_id;

        -- No linked ClientEmployee record -> denied
        IF NOT FOUND THEN
            RETURN FALSE;
        END IF;

        -- Direct client company match: always allowed
        IF p_invoice_client_id = v_client_id THEN
            RETURN TRUE;
        END IF;

        -- Group-wide access: STRICTLY restricted to MD and GM
        IF v_employee_role IN ('MD', 'GM') AND v_company_group_id IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1
                FROM public."Client" gc
                WHERE gc."id" = p_invoice_client_id
                  AND gc."companyGroupId" = v_company_group_id
                  AND gc."tenantId" = v_tenant_id
            ) INTO v_group_match;

            IF v_group_match THEN
                RETURN TRUE;
            END IF;
        END IF;

        RETURN FALSE;
    END IF;

    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."can_read_invoice"("p_invoice_tenant_id" "text", "p_invoice_client_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_invoice_storage"("p_object_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_user_tenant_id TEXT;
    v_user_role      TEXT;
    v_user_status    TEXT;
    v_path_tenant_id TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT u."tenantId", u."role"::TEXT, u."status"::TEXT
    INTO v_user_tenant_id, v_user_role, v_user_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    IF NOT FOUND OR v_user_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    IF v_user_role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    v_path_tenant_id := split_part(p_object_name, '/', 1);
    IF v_user_role IN ('WAREHOUSE_OWNER', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_MODERATOR') THEN
        RETURN (v_user_tenant_id IS NOT NULL AND v_user_tenant_id = v_path_tenant_id);
    END IF;

    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."can_read_invoice_storage"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_payment"("p_payment_tenant_id" "text", "p_payment_invoice_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_invoice_tenant_id TEXT;
    v_invoice_client_id TEXT;
BEGIN
    -- 1. Reject unauthenticated callers
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Lookup the associated Invoice
    SELECT
        inv."tenantId",
        inv."clientId"
    INTO
        v_invoice_tenant_id,
        v_invoice_client_id
    FROM public."Invoice" inv
    WHERE inv."id" = p_payment_invoice_id;

    -- Invoice not found → denied
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 3. Consistency check: payment tenant must match invoice tenant
    IF p_payment_tenant_id != v_invoice_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- 4. Delegate to can_read_invoice
    RETURN public.can_read_invoice(v_invoice_tenant_id, v_invoice_client_id);
END;
$$;


ALTER FUNCTION "public"."can_read_payment"("p_payment_tenant_id" "text", "p_payment_invoice_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_payment_proof_storage"("p_object_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_path_tenant_id  TEXT;
    v_path_invoice_id TEXT;
    v_path_payment_id TEXT;
    v_pay_tenant_id   TEXT;
    v_pay_invoice_id  TEXT;
    v_inv_tenant_id   TEXT;
    v_inv_client_id   TEXT;
BEGIN
    -- 1. Must be authenticated
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Parse path segments: {tenantId}/{invoiceId}/{paymentId}/{filename}
    v_path_tenant_id  := split_part(p_object_name, '/', 1);
    v_path_invoice_id := split_part(p_object_name, '/', 2);
    v_path_payment_id := split_part(p_object_name, '/', 3);

    -- Path must have all 3 required parent segments
    IF v_path_tenant_id = '' OR v_path_invoice_id = '' OR v_path_payment_id = '' THEN
        RETURN FALSE;
    END IF;

    -- 3. Verify Payment exists and fetch its tenantId and invoiceId
    SELECT p."tenantId", p."invoiceId"
    INTO v_pay_tenant_id, v_pay_invoice_id
    FROM public."Payment" p
    WHERE p."id" = v_path_payment_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 4. Verify Payment consistency with path
    IF v_pay_tenant_id != v_path_tenant_id OR v_pay_invoice_id != v_path_invoice_id THEN
        RETURN FALSE;
    END IF;

    -- 5. Verify Invoice exists, matches path & payment tenantId, and fetch clientId
    SELECT inv."tenantId", inv."clientId"
    INTO v_inv_tenant_id, v_inv_client_id
    FROM public."Invoice" inv
    WHERE inv."id" = v_path_invoice_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_inv_tenant_id != v_path_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- 6. Authorize actor using Phase 3 can_read_invoice
    RETURN public.can_read_invoice(v_inv_tenant_id, v_inv_client_id);
END;
$$;


ALTER FUNCTION "public"."can_read_payment_proof_storage"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_upload_payment_proof_storage"("p_object_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_user_tenant_id TEXT;
    v_user_role      TEXT;
    v_user_status    TEXT;
    v_path_tenant_id TEXT;
BEGIN
    -- 1. Must be authenticated
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Resolve actor
    SELECT u."tenantId", u."role"::TEXT, u."status"::TEXT
    INTO v_user_tenant_id, v_user_role, v_user_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    IF NOT FOUND OR v_user_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    -- 3. Authorized payment roles (WAREHOUSE_STAFF strictly excluded)
    IF v_user_role NOT IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_MODERATOR', 'CLIENT', 'CLIENT_ACCOUNTANT') THEN
        RETURN FALSE;
    END IF;

    -- 4. Path must have at least 4 segments: {tenantId}/{invoiceId}/{paymentId}/{filename}
    v_path_tenant_id := split_part(p_object_name, '/', 1);
    IF v_path_tenant_id = '' OR split_part(p_object_name, '/', 2) = '' OR split_part(p_object_name, '/', 3) = '' OR split_part(p_object_name, '/', 4) = '' THEN
        RETURN FALSE;
    END IF;

    -- 5. Tenant validation: PLATFORM_ADMIN can upload across tenants; others only own tenant
    IF v_user_role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    IF v_user_tenant_id IS NULL OR v_user_tenant_id != v_path_tenant_id THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."can_upload_payment_proof_storage"("p_object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_actor_permission"("p_permission_key" "text", "p_target_client_id" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."check_actor_permission"("p_permission_key" "text", "p_target_client_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_settings_for_new_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  default_event_config JSONB;
BEGIN
  -- Default notification settings for a new tenant: inApp = true, clientEmail = false (DEFAULT OFF)
  default_event_config := jsonb_build_object(
    'NEW_ORDER', jsonb_build_object('inApp', true, 'clientEmail', false),
    'ORDER_ISSUED', jsonb_build_object('inApp', true, 'clientEmail', false),
    'PROCESSING_STARTED', jsonb_build_object('inApp', true, 'clientEmail', false),
    'READY_FOR_DISPATCH', jsonb_build_object('inApp', true, 'clientEmail', false),
    'ORDER_DISPATCHED', jsonb_build_object('inApp', true, 'clientEmail', false),
    'CLIENT_RECEIVED_ORDER', jsonb_build_object('inApp', true, 'clientEmail', false),
    'CLIENT_STARTED_VERIFICATION', jsonb_build_object('inApp', true, 'clientEmail', false),
    'CLIENT_COMPLETED_VERIFICATION', jsonb_build_object('inApp', true, 'clientEmail', false),
    'CLIENT_REJECTED_ORDER', jsonb_build_object('inApp', true, 'clientEmail', false),
    'DAMAGE_REPORTED', jsonb_build_object('inApp', true, 'clientEmail', false),
    'MISSING_ITEMS_REPORTED', jsonb_build_object('inApp', true, 'clientEmail', false),
    'VERIFICATION_COMPLETED', jsonb_build_object('inApp', true, 'clientEmail', false),
    'INVOICE_GENERATED', jsonb_build_object('inApp', true, 'clientEmail', false),
    'INVOICE_SENT', jsonb_build_object('inApp', true, 'clientEmail', false),
    'PAYMENT_RECEIVED', jsonb_build_object('inApp', true, 'clientEmail', false),
    'PAYMENT_OVERDUE', jsonb_build_object('inApp', true, 'clientEmail', false),
    'ORDER_COMPLETED', jsonb_build_object('inApp', true, 'clientEmail', false)
  );

  INSERT INTO "NotificationSettings" ("tenantId", "enabled", "eventConfig")
  VALUES (NEW."id", true, default_event_config)
  ON CONFLICT ("tenantId") DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_notification_settings_for_new_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_actor"() RETURNS TABLE("actor_id" "text", "tenant_id" "text", "role" "text", "status" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_user_id TEXT;
    v_tenant_id TEXT;
    v_role TEXT;
    v_status TEXT;
BEGIN
    -- Reject unauthenticated callers
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    -- Resolve actor from User table using ONLY auth.uid()
    SELECT
        u."id",
        u."tenantId",
        u."role"::TEXT,
        u."status"::TEXT
    INTO
        v_user_id,
        v_tenant_id,
        v_role,
        v_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    -- User not found → return NULL (no rows)
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Inactive user → return NULL (no rows)
    IF v_status != 'ACTIVE' THEN
        RETURN;
    END IF;

    -- Return the resolved actor context
    actor_id := v_user_id;
    tenant_id := v_tenant_id;
    role := v_role;
    status := v_status;

    RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."get_current_actor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("p_permission_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."has_permission"("p_permission_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("p_allowed_roles" "text"[]) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
BEGIN
    -- Get current actor
    SELECT * INTO v_actor FROM public.get_current_actor();

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if actor's role is in the allowed list
    RETURN v_actor.role = ANY(p_allowed_roles);
END;
$$;


ALTER FUNCTION "public"."has_role"("p_allowed_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_user"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_status TEXT;
BEGIN
    -- Reject unauthenticated callers
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT u."status"::TEXT
    INTO v_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    -- User not found or inactive
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    RETURN v_status = 'ACTIVE';
END;
$$;


ALTER FUNCTION "public"."is_active_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_notification_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF current_user != 'authenticated' THEN
        RETURN NEW;
    END IF;

    -- Authenticated caller may ONLY set read = true and update readAt
    IF NEW."id" != OLD."id" OR
       NEW."tenantId" != OLD."tenantId" OR
       NEW."userId" IS DISTINCT FROM OLD."userId" OR
       NEW."orderId" IS DISTINCT FROM OLD."orderId" OR
       NEW."type" != OLD."type" OR
       NEW."title" != OLD."title" OR
       NEW."message" != OLD."message" OR
       NEW."actionUrl" IS DISTINCT FROM OLD."actionUrl" OR
       NEW."priority" != OLD."priority" OR
       NEW."createdAt" != OLD."createdAt" OR
       NEW."read" != true THEN
        RAISE EXCEPTION 'Direct notification update may only mark read = true';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_notification_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_user_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Only enforce restrictions for direct calls from authenticated role
    IF current_user != 'authenticated' THEN
        RETURN NEW;
    END IF;

    -- Allow ONLY initial linkage of supabaseUserId where OLD was NULL and NEW matches auth.uid()
    IF OLD."supabaseUserId" IS NULL AND NEW."supabaseUserId" = auth.uid()::TEXT THEN
        -- Strictly verify that NO authorization or profile fields are modified
        IF NEW."id" != OLD."id" OR
           NEW."tenantId" IS DISTINCT FROM OLD."tenantId" OR
           NEW."email" != OLD."email" OR
           NEW."role" != OLD."role" OR
           NEW."status" != OLD."status" OR
           NEW."name" != OLD."name" OR
           NEW."mobile" IS DISTINCT FROM OLD."mobile" THEN
            RAISE EXCEPTION 'Direct user update may only set supabaseUserId';
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Direct modification of User is forbidden. Use appropriate RPCs.';
END;
$$;


ALTER FUNCTION "public"."protect_user_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_current_actor"() RETURNS TABLE("user_id" "text", "tenant_id" "text", "role" "text", "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_user_id TEXT;
    v_tenant_id TEXT;
    v_role TEXT;
    v_status TEXT;
BEGIN
    -- Reject unauthenticated callers - auth.uid() returns NULL for anonymous calls
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required: no valid session found';
    END IF;

    -- Find the WMS user record using ONLY auth.uid() as the identity source
    -- The supabaseUserId column stores the auth.uid() as text
    SELECT
        u."id",
        u."tenantId",
        u."role"::TEXT,
        u."status"::TEXT
    INTO
        v_user_id,
        v_tenant_id,
        v_role,
        v_status
    FROM public."User" u
    WHERE u."supabaseUserId" = auth.uid()::TEXT;

    -- Require the WMS user to exist
    IF NOT FOUND THEN
        RAISE EXCEPTION 'WMS user not found for authenticated user %', auth.uid();
    END IF;

    -- Require the WMS user to be active
    IF v_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'WMS user account is not active. Current status: %', v_status;
    END IF;

    -- Return the resolved actor context
    user_id := v_user_id;
    tenant_id := v_tenant_id;
    role := v_role;
    status := v_status;

    RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."resolve_current_actor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_admin_create_role"("p_name" "text", "p_description" "text" DEFAULT NULL::"text", "p_tenant_id" "text" DEFAULT NULL::"text", "p_permission_keys" "text"[] DEFAULT ARRAY[]::"text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."rpc_admin_create_role"("p_name" "text", "p_description" "text", "p_tenant_id" "text", "p_permission_keys" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_admin_delete_role"("p_role_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."rpc_admin_delete_role"("p_role_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_admin_list_roles"("p_tenant_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."rpc_admin_list_roles"("p_tenant_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_admin_update_role"("p_role_id" "text", "p_name" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_status" "public"."UserStatus" DEFAULT NULL::"public"."UserStatus", "p_permission_keys" "text"[] DEFAULT NULL::"text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."rpc_admin_update_role"("p_role_id" "text", "p_name" "text", "p_description" "text", "p_status" "public"."UserStatus", "p_permission_keys" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_admin_update_user_role"("p_target_user_id" "text", "p_new_role" "public"."Role") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_session_actor RECORD;
    v_target RECORD;
BEGIN
    -- 1. Resolve session actor
    SELECT * INTO v_session_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_session_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- 2. Authorize caller: PLATFORM_ADMIN only
    IF v_session_actor.role != 'PLATFORM_ADMIN' THEN
        RAISE EXCEPTION 'Unauthorized: only PLATFORM_ADMIN can modify user roles';
    END IF;

    -- 3. Resolve target user
    SELECT * INTO v_target FROM public."User" WHERE "id" = p_target_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user % not found', p_target_user_id;
    END IF;

    -- 4. Prevent self-demotion
    IF v_session_actor.actor_id = p_target_user_id AND p_new_role != 'PLATFORM_ADMIN' THEN
        RAISE EXCEPTION 'Platform Admins cannot remove or demote their own PLATFORM_ADMIN role';
    END IF;

    -- 5. Update only the role field and updatedAt
    UPDATE public."User"
    SET
        "role" = p_new_role,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    -- 6. Write AuditLog record
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId",
        "previousValue", "newValue", "createdAt"
    ) VALUES (
        'audit_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
        v_target."tenantId",
        v_session_actor.actor_id,
        v_session_actor.role::"Role",
        'UPDATE_USER_ROLE',
        'User',
        p_target_user_id,
        jsonb_build_object('role', v_target."role"),
        jsonb_build_object('role', p_new_role),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'userId', p_target_user_id,
        'previousRole', v_target."role",
        'newRole', p_new_role
    );
END;
$$;


ALTER FUNCTION "public"."rpc_admin_update_user_role"("p_target_user_id" "text", "p_new_role" "public"."Role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_assign_client_company_group"("p_client_id" "text", "p_company_group_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_session_actor RECORD;
    v_client RECORD;
    v_group RECORD;
    v_effective_group_id TEXT := NULLIF(TRIM(p_company_group_id), '');
BEGIN
    -- 1. Resolve session actor
    SELECT * INTO v_session_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_session_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- 2. Role authorization: PLATFORM_ADMIN, WAREHOUSE_OWNER, WAREHOUSE_MODERATOR
    IF v_session_actor.role NOT IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR') THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot manage company group assignments', v_session_actor.role;
    END IF;

    -- 3. Resolve target client company
    SELECT * INTO v_client FROM public."Client" WHERE "id" = p_client_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client company % not found', p_client_id;
    END IF;

    -- 4. Tenant isolation check for non-PLATFORM_ADMIN
    IF v_session_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_session_actor.tenant_id IS NULL OR v_session_actor.tenant_id != v_client."tenantId" THEN
            RAISE EXCEPTION 'Tenant isolation violation: actor tenant % does not match client tenant %',
                v_session_actor.tenant_id, v_client."tenantId";
        END IF;
    END IF;

    -- 5. If attaching to a group, validate the corporate group exists in the same tenant
    IF v_effective_group_id IS NOT NULL THEN
        SELECT * INTO v_group FROM public."CompanyGroup" WHERE "id" = v_effective_group_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Corporate group % not found', v_effective_group_id;
        END IF;

        IF v_group."tenantId" != v_client."tenantId" THEN
            RAISE EXCEPTION 'Tenant mismatch: Client tenant % does not match Corporate Group tenant %',
                v_client."tenantId", v_group."tenantId";
        END IF;
    END IF;

    -- 6. Update Client record
    UPDATE public."Client"
    SET
        "companyGroupId" = v_effective_group_id,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_client_id;

    -- 7. Write AuditLog record
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId",
        "previousValue", "newValue", "createdAt"
    ) VALUES (
        'audit_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
        v_client."tenantId",
        v_session_actor.actor_id,
        v_session_actor.role::"Role",
        'ASSIGN_COMPANY_GROUP',
        'Client',
        p_client_id,
        jsonb_build_object('companyGroupId', v_client."companyGroupId"),
        jsonb_build_object('companyGroupId', v_effective_group_id),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'clientId', p_client_id,
        'previousCompanyGroupId', v_client."companyGroupId",
        'newCompanyGroupId', v_effective_group_id
    );
END;
$$;


ALTER FUNCTION "public"."rpc_assign_client_company_group"("p_client_id" "text", "p_company_group_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_attach_payment_proof"("p_payment_id" "text", "p_invoice_id" "text", "p_proof_url" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
    v_payment RECORD;
    v_invoice RECORD;
    v_order RECORD;
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

    -- Enforce associated order exists and delivery verification completed
    IF v_invoice."orderId" IS NULL THEN
        RAISE EXCEPTION 'Invoice % is not associated with an order', p_invoice_id;
    END IF;

    SELECT * INTO v_order FROM "Order" WHERE "id" = v_invoice."orderId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % for invoice % not found', v_invoice."orderId", p_invoice_id;
    END IF;

    IF v_order."deliveryVerifiedAt" IS NULL THEN
        RAISE EXCEPTION 'Payment proof upload is available after delivery verification';
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


ALTER FUNCTION "public"."rpc_attach_payment_proof"("p_payment_id" "text", "p_invoice_id" "text", "p_proof_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_cancel_payment_record"("p_payment_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor_user_id      TEXT;
    v_actor_tenant_id    TEXT;
    v_actor_role         TEXT;
    v_actor_status       TEXT;
    v_payment            RECORD;
    v_invoice            RECORD;
    v_total_paid         NUMERIC(12,2);
    v_new_payment_status "PaymentStatus";
BEGIN
    -- 1. Resolve current actor securely from database session
    SELECT user_id, tenant_id, role, status
    INTO v_actor_user_id, v_actor_tenant_id, v_actor_role, v_actor_status
    FROM public.resolve_current_actor();

    -- 2. Verify actor payment authorization (payments:manage)
    IF NOT (v_actor_role IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTS_TEAM', 'ACCOUNTANT', 'CLIENT_ACCOUNTANT')) THEN
        RAISE EXCEPTION 'Permission denied: payment cancellation is not allowed for role %', v_actor_role;
    END IF;

    -- 3. Load Payment
    SELECT * INTO v_payment FROM "Payment" WHERE "id" = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment % not found', p_payment_id;
    END IF;

    -- 4. Verify tenant isolation
    IF v_actor_role != 'PLATFORM_ADMIN' THEN
        IF v_actor_tenant_id IS NULL OR v_actor_tenant_id != v_payment."tenantId" THEN
            RAISE EXCEPTION 'Permission denied: payment belongs to another tenant';
        END IF;
    END IF;

    -- 5. Check if already cancelled
    IF v_payment."status" = 'CANCELLED' THEN
        RAISE EXCEPTION 'Payment % is already cancelled', p_payment_id;
    END IF;

    -- 6. Load Invoice
    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = v_payment."invoiceId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', v_payment."invoiceId";
    END IF;

    -- 7. Update Payment status to CANCELLED (native PaymentStatus enum)
    UPDATE "Payment"
    SET "status" = 'CANCELLED'
    WHERE "id" = v_payment."id";

    -- 8. Recalculate total paid from remaining PAID payments
    SELECT COALESCE(SUM("amount"), 0) INTO v_total_paid
    FROM "Payment"
    WHERE "invoiceId" = v_invoice."id" AND "status" = 'PAID';

    -- 9. Determine new payment status for Invoice
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

    -- 11. Revert order status if invoice was previously paid and order is currently PAID
    IF v_new_payment_status != 'PAID' AND v_invoice."orderId" IS NOT NULL THEN
        UPDATE "Order"
        SET "status" = 'PAYMENT_PENDING',
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = v_invoice."orderId" AND "status" = 'PAID';
    END IF;

    -- 12. Record in AuditLog
    INSERT INTO "AuditLog" (
        "id",
        "tenantId",
        "userId",
        "userRole",
        "action",
        "entity",
        "entityId",
        "previousValue",
        "newValue",
        "createdAt"
    )
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_payment."tenantId",
        v_actor_user_id,
        v_actor_role::"Role",
        'Cancelled payment',
        'Payment',
        v_payment."id",
        jsonb_build_object('status', v_payment."status", 'amount', v_payment."amount"),
        jsonb_build_object('status', 'CANCELLED', 'invoicePaymentStatus', v_new_payment_status, 'totalPaid', v_total_paid),
        CURRENT_TIMESTAMP
    );

    -- 13. Return payload
    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment."id",
        'invoiceId', v_invoice."id",
        'status', 'CANCELLED',
        'newPaymentStatus', v_new_payment_status,
        'totalPaid', v_total_paid
    );
END;
$$;


ALTER FUNCTION "public"."rpc_cancel_payment_record"("p_payment_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_create_notification"("p_tenant_id" "text", "p_order_id" "text" DEFAULT NULL::"text", "p_user_id" "text" DEFAULT NULL::"text", "p_type" "text" DEFAULT 'NEW_ORDER'::"text", "p_title" "text" DEFAULT 'Notification'::"text", "p_message" "text" DEFAULT ''::"text", "p_action_url" "text" DEFAULT NULL::"text", "p_priority" "text" DEFAULT 'normal'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
    v_notification_id TEXT;
    v_existing_id TEXT;
    v_target_user RECORD;
    v_order RECORD;
BEGIN
    -- 1. Resolve authenticated caller
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- 2. Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id != p_tenant_id THEN
            RAISE EXCEPTION 'Tenant boundary violation: cannot create notification for another tenant';
        END IF;
    END IF;

    -- 3. If orderId is provided, verify order belongs to the tenant
    IF p_order_id IS NOT NULL THEN
        SELECT * INTO v_order FROM public."Order" WHERE "id" = p_order_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Order with ID % not found', p_order_id;
        END IF;
        IF v_actor.role != 'PLATFORM_ADMIN' AND v_order."tenantId" != p_tenant_id THEN
            RAISE EXCEPTION 'Tenant boundary violation: order belongs to another tenant';
        END IF;
    END IF;

    -- 4. If userId is provided, verify recipient belongs to the tenant and is active
    IF p_user_id IS NOT NULL THEN
        SELECT * INTO v_target_user FROM public."User" WHERE "id" = p_user_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Recipient user with ID % not found', p_user_id;
        END IF;
        IF v_target_user."tenantId" != p_tenant_id THEN
            RAISE EXCEPTION 'Cross-tenant recipient violation: user belongs to another tenant';
        END IF;
        IF v_target_user."status" != 'ACTIVE' THEN
            -- Inactive recipient: skip creating notification row safely
            RETURN jsonb_build_object(
                'success', true,
                'skipped', true,
                'reason', 'Recipient user is inactive'
            );
        END IF;
    END IF;

    -- 5. Deduplication check: Avoid spamming identical notifications within a 15-second window
    SELECT "id" INTO v_existing_id
    FROM public."Notification"
    WHERE "tenantId" = p_tenant_id
      AND "type" = p_type
      AND ("orderId" = p_order_id OR (p_order_id IS NULL AND "orderId" IS NULL))
      AND ("userId" = p_user_id OR (p_user_id IS NULL AND "userId" IS NULL))
      AND "read" = false
      AND "createdAt" >= (CURRENT_TIMESTAMP - INTERVAL '15 seconds')
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'duplicate', true,
            'notificationId', v_existing_id
        );
    END IF;

    -- 6. Insert new notification
    v_notification_id := concat('notif_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

    INSERT INTO public."Notification" (
        "id",
        "tenantId",
        "orderId",
        "userId",
        "type",
        "title",
        "message",
        "actionUrl",
        "priority",
        "read",
        "createdAt"
    )
    VALUES (
        v_notification_id,
        p_tenant_id,
        p_order_id,
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_action_url,
        COALESCE(p_priority, 'normal'),
        false,
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'notificationId', v_notification_id
    );
END;
$$;


ALTER FUNCTION "public"."rpc_create_notification"("p_tenant_id" "text", "p_order_id" "text", "p_user_id" "text", "p_type" "text", "p_title" "text", "p_message" "text", "p_action_url" "text", "p_priority" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_create_order_with_invoice"("p_tenant_id" "text", "p_client_id" "text", "p_created_by_id" "text", "p_selected_contact_ids" "text"[], "p_assigned_staff_id" "text" DEFAULT NULL::"text", "p_expected_delivery" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text", "p_status" "public"."OrderStatus" DEFAULT 'ISSUED'::"public"."OrderStatus", "p_eway_bill" "jsonb" DEFAULT NULL::"jsonb", "p_items" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
    v_actor RECORD;
    v_created_by_id TEXT;
    v_staff_tenant_id TEXT;
    v_order_id TEXT;
    v_order_number TEXT;
    v_order_date TIMESTAMPTZ := CURRENT_TIMESTAMP;
    v_subtotal NUMERIC(12, 2) := 0;
    v_tax_total NUMERIC(12, 2) := 0;
    v_discount_total NUMERIC(12, 2) := 0;
    v_total_amount NUMERIC(12, 2) := 0;
    v_last_order_num INTEGER := 0;
    v_next_order_num INTEGER := 1;
    v_invoice_id TEXT;
    v_invoice_number TEXT;
    v_configured_prefix TEXT;
    v_next_invoice_seq INTEGER;
    v_max_existing INTEGER := 0;
    v_status "InvoiceStatus" := 'FINAL';
    v_cgst NUMERIC(12, 2) := 0;
    v_sgst NUMERIC(12, 2) := 0;
    v_item JSONB;
    v_item_subtotal NUMERIC(12, 2);
    v_item_tax NUMERIC(12, 2);
    v_item_discount NUMERIC(12, 2);
    v_item_total NUMERIC(12, 2);
    v_item_order_id TEXT;
    v_invoice_item_id TEXT;
    v_item_quantity INTEGER;
    v_item_unit_price NUMERIC(12, 2);
    v_item_tax_rate NUMERIC(12, 2);
    v_order_history_id TEXT;
    v_audit_log_id TEXT;
    v_warehouse_setting RECORD;
    v_contact_id TEXT;
    v_user_id TEXT;
    v_notification_id TEXT;
    v_inv_match TEXT[];
BEGIN
    -- 1. Resolve session actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- PLATFORM_ADMIN can act on any tenant; all others strictly locked to own tenant
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id IS NULL OR v_actor.tenant_id != p_tenant_id THEN
            RAISE EXCEPTION 'Tenant isolation violation: actor does not belong to specified tenant';
        END IF;
    END IF;

    -- Authorize staff role
    IF NOT (v_actor.role = ANY(ARRAY[
        'WAREHOUSE_OWNER',
        'WAREHOUSE_MODERATOR',
        'WAREHOUSE_STAFF',
        'ACCOUNTANT',
        'PLATFORM_ADMIN'
    ])) THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot create orders', v_actor.role;
    END IF;

    -- Authoritative creator identity
    v_created_by_id := v_actor.actor_id;

    -- Validate client belongs to target tenant and is accessible
    IF NOT public.can_access_client(p_client_id) THEN
        RAISE EXCEPTION 'Access denied: client % is not accessible or does not exist', p_client_id;
    END IF;

    -- Validate assigned staff
    IF p_assigned_staff_id IS NOT NULL THEN
        SELECT "tenantId" INTO v_staff_tenant_id
        FROM "User"
        WHERE "id" = p_assigned_staff_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Assigned staff user % not found', p_assigned_staff_id;
        END IF;

        IF v_staff_tenant_id IS NOT NULL AND v_staff_tenant_id != p_tenant_id THEN
            RAISE EXCEPTION 'Assigned staff user belongs to a different tenant';
        END IF;
    END IF;

    -- 2. Generate Tenant-Scoped Order Number (ORD-YYYY-XXXXXX)
    SELECT COALESCE(
        MAX(
            SUBSTRING("orderNumber" FROM '[0-9]+$')::INTEGER
        ),
        0
    )
    INTO v_last_order_num
    FROM "Order"
    WHERE "tenantId" = p_tenant_id;

    v_next_order_num := v_last_order_num + 1;
    v_order_number := concat(
        'ORD-',
        TO_CHAR(CURRENT_DATE, 'YYYY'),
        '-',
        LPAD(v_next_order_num::TEXT, 6, '0')
    );

    v_order_id := concat(
        'ord_',
        substr(md5(random()::text || clock_timestamp()::text), 1, 16)
    );

    -- 3. Calculate financial totals from items
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_item_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);
            v_item_unit_price := COALESCE((v_item->>'unitPrice')::NUMERIC, 0);
            v_item_tax_rate := COALESCE((v_item->>'taxRate')::NUMERIC, 0);
            v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

            v_item_subtotal := v_item_quantity * v_item_unit_price;
            v_item_tax := ROUND(v_item_subtotal * (v_item_tax_rate / 100.0), 2);
            v_item_total := v_item_subtotal + v_item_tax - v_item_discount;

            v_subtotal := v_subtotal + v_item_subtotal;
            v_tax_total := v_tax_total + v_item_tax;
            v_discount_total := v_discount_total + v_item_discount;
            v_total_amount := v_total_amount + v_item_total;
        END LOOP;
    END IF;

    -- Half-half split between CGST and SGST
    v_cgst := ROUND(v_tax_total / 2.0, 2);
    v_sgst := v_tax_total - v_cgst;

    -- 4. Insert Order
    INSERT INTO "Order" (
        "id",
        "tenantId",
        "clientId",
        "orderNumber",
        "orderDate",
        "expectedDelivery",
        "status",
        "verificationStatus",
        "subtotal",
        "taxTotal",
        "discountTotal",
        "totalAmount",
        "notes",
        "createdById",
        "assignedStaffId",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        v_order_id,
        p_tenant_id,
        p_client_id,
        v_order_number,
        v_order_date,
        p_expected_delivery,
        p_status,
        'PENDING',
        v_subtotal,
        v_tax_total,
        v_discount_total,
        v_total_amount,
        p_notes,
        v_created_by_id,
        p_assigned_staff_id,
        v_order_date,
        v_order_date
    );

    -- 5. Insert Order Items
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_item_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);
            v_item_unit_price := COALESCE((v_item->>'unitPrice')::NUMERIC, 0);
            v_item_tax_rate := COALESCE((v_item->>'taxRate')::NUMERIC, 0);
            v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

            v_item_subtotal := v_item_quantity * v_item_unit_price;
            v_item_tax := ROUND(v_item_subtotal * (v_item_tax_rate / 100.0), 2);
            v_item_total := v_item_subtotal + v_item_tax - v_item_discount;

            v_item_order_id := concat(
                'oi_',
                substr(md5(random()::text || clock_timestamp()::text), 1, 16)
            );

            INSERT INTO "OrderItem" (
                "id",
                "orderId",
                "productId",
                "quantity",
                "unitPrice",
                "taxRate",
                "discount",
                "total"
            )
            VALUES (
                v_item_order_id,
                v_order_id,
                v_item->>'productId',
                v_item_quantity,
                v_item_unit_price,
                v_item_tax_rate,
                v_item_discount,
                v_item_total
            );
        END LOOP;
    END IF;

    -- 6. Generate Tenant-Scoped Invoice Number using WarehouseSetting (Phase 6B preserved)
    SELECT * INTO v_warehouse_setting
    FROM "public"."WarehouseSetting"
    WHERE "tenantId" = p_tenant_id
    FOR UPDATE;

    IF FOUND THEN
        v_configured_prefix := COALESCE(v_warehouse_setting."invoicePrefix", '');
        v_next_invoice_seq  := COALESCE(v_warehouse_setting."nextInvoiceNumber", 1);
    ELSE
        v_configured_prefix := '';
        v_next_invoice_seq  := 1;
    END IF;

    -- Safety scan: ensure sequence is strictly greater than any existing invoice number
    SELECT COALESCE(
        MAX(
            CASE
                WHEN ("invoiceNumber" ~ '[0-9]+$') THEN
                    (regexp_match("invoiceNumber", '([0-9]+)$'))[1]::INTEGER
                ELSE 0
            END
        ),
        0
    )
    INTO v_max_existing
    FROM "public"."Invoice"
    WHERE "tenantId" = p_tenant_id;

    IF v_max_existing >= v_next_invoice_seq THEN
        v_next_invoice_seq := v_max_existing + 1;
    END IF;

    -- Format invoice number: configured prefix + 6-digit zero-padded sequence
    v_invoice_number := concat(
        v_configured_prefix,
        LPAD(v_next_invoice_seq::TEXT, 6, '0')
    );

    -- Advance next sequence in WarehouseSetting
    IF FOUND THEN
        UPDATE "public"."WarehouseSetting"
        SET "nextInvoiceNumber" = v_next_invoice_seq + 1,
            "updatedAt"         = CURRENT_TIMESTAMP
        WHERE "tenantId" = p_tenant_id;
    ELSE
        INSERT INTO "public"."WarehouseSetting" (
            "id",
            "tenantId",
            "orderPrefix",
            "invoicePrefix",
            "nextInvoiceNumber",
            "updatedAt"
        )
        VALUES (
            concat('ws_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            p_tenant_id,
            'ORD',
            v_configured_prefix,
            v_next_invoice_seq + 1,
            CURRENT_TIMESTAMP
        );
    END IF;

    -- 7. Insert Invoice
    v_invoice_id := concat(
        'inv_',
        substr(md5(random()::text || clock_timestamp()::text), 1, 16)
    );

    INSERT INTO "Invoice" (
        "id",
        "tenantId",
        "orderId",
        "clientId",
        "invoiceNumber",
        "invoiceDate",
        "status",
        "paymentStatus",
        "subtotal",
        "cgst",
        "sgst",
        "igst",
        "discountTotal",
        "total",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        v_invoice_id,
        p_tenant_id,
        v_order_id,
        p_client_id,
        v_invoice_number,
        v_order_date,
        v_status,
        'UNPAID',
        v_subtotal,
        v_cgst,
        v_sgst,
        0,
        v_discount_total,
        v_total_amount,
        v_order_date,
        v_order_date
    );

    -- 8. Insert Invoice Items
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_item_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);
            v_item_unit_price := COALESCE((v_item->>'unitPrice')::NUMERIC, 0);
            v_item_tax_rate := COALESCE((v_item->>'taxRate')::NUMERIC, 0);
            v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

            v_item_subtotal := v_item_quantity * v_item_unit_price;
            v_item_tax := ROUND(v_item_subtotal * (v_item_tax_rate / 100.0), 2);
            v_item_total := v_item_subtotal + v_item_tax - v_item_discount;

            v_invoice_item_id := concat(
                'ii_',
                substr(md5(random()::text || clock_timestamp()::text), 1, 16)
            );

            INSERT INTO "InvoiceItem" (
                "id",
                "invoiceId",
                "productId",
                "quantity",
                "rate",
                "discount",
                "cgst",
                "sgst",
                "igst",
                "total"
            )
            VALUES (
                v_invoice_item_id,
                v_invoice_id,
                v_item->>'productId',
                v_item_quantity,
                v_item_unit_price,
                v_item_discount,
                ROUND(v_item_tax / 2.0, 2),
                v_item_tax - ROUND(v_item_tax / 2.0, 2),
                0,
                v_item_total
            );
        END LOOP;
    END IF;

    -- 9. Insert Order Status History
    v_order_history_id := concat(
        'osh_',
        substr(md5(random()::text || clock_timestamp()::text), 1, 16)
    );

    INSERT INTO "OrderStatusHistory" (
        "id",
        "tenantId",
        "orderId",
        "previousStatus",
        "newStatus",
        "changedById",
        "notes",
        "createdAt"
    )
    VALUES (
        v_order_history_id,
        p_tenant_id,
        v_order_id,
        NULL,
        p_status,
        v_created_by_id,
        'Initial order created',
        v_order_date
    );

    -- 10. Insert notifications for designated Client Employees
    IF p_selected_contact_ids IS NOT NULL
       AND array_length(p_selected_contact_ids, 1) > 0
    THEN
        FOREACH v_contact_id IN ARRAY p_selected_contact_ids
        LOOP
            -- Look up user ID from ClientEmployee entity
            SELECT ce."userId"
            INTO v_user_id
            FROM "ClientEmployee" ce
            WHERE ce."id" = v_contact_id
              AND ce."clientId" = p_client_id
              AND ce."tenantId" = p_tenant_id;

            IF v_user_id IS NOT NULL THEN
                v_notification_id := concat(
                    'notif_',
                    substr(md5(random()::text || clock_timestamp()::text), 1, 16)
                );

                INSERT INTO "Notification" (
                    "id",
                    "tenantId",
                    "userId",
                    "orderId",
                    "type",
                    "title",
                    "message",
                    "actionUrl",
                    "priority",
                    "read",
                    "createdAt"
                )
                VALUES (
                    v_notification_id,
                    p_tenant_id,
                    v_user_id,
                    v_order_id,
                    'NEW_ORDER',
                    'New Order Created',
                    concat(
                        'Order ',
                        v_order_number,
                        ' has been created for your company.'
                    ),
                    concat('/orders/', v_order_id),
                    'normal',
                    FALSE,
                    v_order_date
                );
            END IF;
        END LOOP;
    END IF;

    -- 11. Insert Audit Log
    v_audit_log_id := concat(
        'aud_',
        substr(md5(random()::text || clock_timestamp()::text), 1, 16)
    );

    INSERT INTO "AuditLog" (
        "id",
        "tenantId",
        "userId",
        "userRole",
        "action",
        "entity",
        "entityId",
        "newValue",
        "createdAt"
    )
    VALUES (
        v_audit_log_id,
        p_tenant_id,
        v_created_by_id,
        v_actor.role::"Role",
        'Created order with final invoice',
        'Order',
        v_order_id,
        jsonb_build_object(
            'orderNumber', v_order_number,
            'status', p_status,
            'invoiceNumber', v_invoice_number,
            'invoiceStatus', v_status,
            'totalAmount', v_total_amount
        ),
        v_order_date
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'order', jsonb_build_object(
            'id', v_order_id,
            'orderNumber', v_order_number,
            'totalAmount', v_total_amount,
            'status', p_status
        ),
        'invoice', jsonb_build_object(
            'id', v_invoice_id,
            'invoiceNumber', v_invoice_number,
            'total', v_total_amount,
            'status', v_status
        )
    );
END;
$_$;


ALTER FUNCTION "public"."rpc_create_order_with_invoice"("p_tenant_id" "text", "p_client_id" "text", "p_created_by_id" "text", "p_selected_contact_ids" "text"[], "p_assigned_staff_id" "text", "p_expected_delivery" timestamp with time zone, "p_notes" "text", "p_status" "public"."OrderStatus", "p_eway_bill" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_generate_invoice"("p_order_id" "text", "p_is_final" boolean DEFAULT false, "p_user_id" "text" DEFAULT NULL::"text", "p_user_role" "public"."Role" DEFAULT 'WAREHOUSE_OWNER'::"public"."Role") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
    v_actor RECORD;
    v_effective_user_id TEXT;
    v_effective_user_role "Role";
    v_order RECORD;
    v_new_invoice_id TEXT;
    v_invoice_number TEXT;
    v_configured_prefix TEXT;
    v_next_invoice_seq INTEGER;
    v_max_existing INTEGER := 0;
    v_status "InvoiceStatus";
    v_cgst NUMERIC(12,2);
    v_sgst NUMERIC(12,2);
    v_item RECORD;
    v_split_tax NUMERIC(12,2);
    v_divisor NUMERIC;
    v_warehouse_setting RECORD;
BEGIN
    -- Resolve authenticated actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id != v_order."tenantId" THEN
            RAISE EXCEPTION 'Tenant authorization failure: order belongs to another tenant';
        END IF;
    END IF;

    v_effective_user_id := v_actor.actor_id;
    v_effective_user_role := v_actor.role::"Role";

    -- CRITICAL BUSINESS RULE: Final invoice blocked until verified!
    IF p_is_final AND v_order."verificationStatus" != 'VERIFIED' THEN
        INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
        VALUES (
            concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            v_order."tenantId",
            v_effective_user_id,
            v_effective_user_role,
            'Blocked final invoice before verification',
            'Order',
            v_order."id",
            jsonb_build_object('verificationStatus', v_order."verificationStatus"),
            jsonb_build_object('requestedFinal', true),
            CURRENT_TIMESTAMP
        );
        RAISE EXCEPTION 'Final invoice generation is blocked until client verification is VERIFIED. Current status: %', v_order."verificationStatus";
    END IF;

    -- Load warehouse settings for invoice prefix and sequence
    SELECT * INTO v_warehouse_setting
    FROM "WarehouseSetting"
    WHERE "tenantId" = v_order."tenantId"
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warehouse settings not found for tenant %', v_order."tenantId";
    END IF;

    -- ====================================================================
    -- INVOICE NUMBER GENERATION — uses WarehouseSetting configuration
    -- ====================================================================

    -- Serialize invoice number generation per tenant (advisory lock)
    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_order."tenantId", 0)
    );

    -- Read configured prefix (empty string if NULL)
    v_configured_prefix := COALESCE(v_warehouse_setting."invoicePrefix", '');

    -- Read authoritative next sequence number from WarehouseSetting
    v_next_invoice_seq := COALESCE(v_warehouse_setting."nextInvoiceNumber", 1);

    -- Safety: cross-check against existing invoices to avoid duplicates
    -- Extract trailing digits from the latest invoice for this tenant
    SELECT COALESCE(
        MAX(
            substring("invoiceNumber" FROM '([0-9]+)$')::INTEGER
        ),
        0
    )
    INTO v_max_existing
    FROM "Invoice"
    WHERE "tenantId" = v_order."tenantId";

    -- Use the greater of the configured sequence or existing max + 1
    IF v_max_existing >= v_next_invoice_seq THEN
        v_next_invoice_seq := v_max_existing + 1;
    END IF;

    -- Format: prefix + six-digit zero-padded sequence
    v_invoice_number := v_configured_prefix || LPAD(v_next_invoice_seq::TEXT, 6, '0');

    -- Increment the sequence in WarehouseSetting for the next invoice
    UPDATE "WarehouseSetting"
    SET "nextInvoiceNumber" = v_next_invoice_seq + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = v_order."tenantId";

    v_status := CASE WHEN p_is_final THEN 'FINAL'::"InvoiceStatus" ELSE 'DRAFT'::"InvoiceStatus" END;
    v_new_invoice_id := concat('inv_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

    v_cgst := ROUND(v_order."taxTotal" / 2.0, 2);
    v_sgst := ROUND(v_order."taxTotal" / 2.0, 2);

    -- Insert Invoice
    INSERT INTO "Invoice" (
        "id", "tenantId", "orderId", "clientId", "invoiceNumber",
        "status", "paymentStatus", "subtotal", "cgst", "sgst", "igst",
        "discountTotal", "total", "finalizedAt", "createdAt", "updatedAt"
    )
    VALUES (
        v_new_invoice_id,
        v_order."tenantId",
        v_order."id",
        v_order."clientId",
        v_invoice_number,
        v_status,
        'UNPAID',
        v_order."subtotal",
        v_cgst,
        v_sgst,
        0,
        v_order."discountTotal",
        v_order."totalAmount",
        CASE WHEN p_is_final THEN CURRENT_TIMESTAMP ELSE NULL END,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

    -- Insert Invoice Items
    FOR v_item IN SELECT * FROM "OrderItem" WHERE "orderId" = v_order."id" LOOP
        v_divisor := 200.0 + (v_item."taxRate" * 2.0);
        v_split_tax := ROUND((v_item."total" * v_item."taxRate") / v_divisor, 2);

        INSERT INTO "InvoiceItem" (
            "id", "invoiceId", "productId", "quantity", "rate",
            "discount", "cgst", "sgst", "igst", "total"
        )
        VALUES (
            concat('ii_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            v_new_invoice_id,
            v_item."productId",
            v_item."quantity",
            v_item."unitPrice",
            v_item."discount",
            v_split_tax,
            v_split_tax,
            0,
            v_item."total"
        );
    END LOOP;

    -- If final invoice, advance order status to INVOICED
    IF p_is_final THEN
        UPDATE "Order" SET "status" = 'INVOICED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = v_order."id";
    END IF;

    -- Audit log
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_effective_user_id,
        v_effective_user_role,
        CASE WHEN p_is_final THEN 'Generated final invoice' ELSE 'Generated draft invoice' END,
        'Invoice',
        v_new_invoice_id,
        jsonb_build_object('invoiceNumber', v_invoice_number, 'status', v_status),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoiceId', v_new_invoice_id,
        'invoiceNumber', v_invoice_number,
        'status', v_status,
        'total', v_order."totalAmount"
    );
END;
$_$;


ALTER FUNCTION "public"."rpc_generate_invoice"("p_order_id" "text", "p_is_final" boolean, "p_user_id" "text", "p_user_role" "public"."Role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_my_permissions"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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
                (SELECT r2."id" FROM public."RoleDefinition" r2 WHERE r2."name" = v_client_employee."employeeRole"::TEXT AND r2."systemRole" = TRUE LIMIT 1)
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


ALTER FUNCTION "public"."rpc_get_my_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_init_inventory_item"("p_product_id" "text", "p_warehouse_id" "text", "p_location_id" "text" DEFAULT NULL::"text", "p_initial_quantity" integer DEFAULT 0, "p_notes" "text" DEFAULT 'Initial stock intake'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
    v_prod RECORD;
    v_inv_id TEXT;
    v_movement_id TEXT;
    v_qty INTEGER;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    IF NOT (v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'PLATFORM_ADMIN')) THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot initialize inventory', v_actor.role;
    END IF;

    SELECT * INTO v_prod FROM "Product" WHERE "id" = p_product_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found', p_product_id;
    END IF;

    IF v_actor.role != 'PLATFORM_ADMIN' AND v_actor.tenant_id != v_prod."tenantId" THEN
        RAISE EXCEPTION 'Tenant authorization failure: product belongs to another tenant';
    END IF;

    v_qty := GREATEST(0, COALESCE(p_initial_quantity, 0));
    v_inv_id := concat('inv_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

    INSERT INTO "Inventory" (
        "id", "tenantId", "warehouseId", "productId", "locationId",
        "totalQuantity", "availableQuantity", "reservedQuantity", "damagedQuantity",
        "quantity", "createdAt", "updatedAt"
    ) VALUES (
        v_inv_id,
        v_prod."tenantId",
        p_warehouse_id,
        p_product_id,
        p_location_id,
        v_qty,
        v_qty,
        0,
        0,
        v_qty,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

    IF v_qty > 0 THEN
        v_movement_id := concat('mov_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
        INSERT INTO "InventoryMovement" (
            "id", "tenantId", "inventoryId", "productId", "type",
            "quantity", "previousQuantity", "newQuantity", "notes", "createdById", "createdAt"
        ) VALUES (
            v_movement_id,
            v_prod."tenantId",
            v_inv_id,
            p_product_id,
            'RECEIPT',
            v_qty,
            0,
            v_qty,
            p_notes,
            v_actor.actor_id,
            CURRENT_TIMESTAMP
        );

        INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
        VALUES (
            concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            v_prod."tenantId",
            v_actor.actor_id,
            v_actor.role::"Role",
            'Initial stock intake',
            'Inventory',
            v_inv_id,
            jsonb_build_object('availableQuantity', 0),
            jsonb_build_object('availableQuantity', v_qty, 'type', 'RECEIPT'),
            CURRENT_TIMESTAMP
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'inventoryId', v_inv_id,
        'productId', p_product_id,
        'quantity', v_qty
    );
END;
$$;


ALTER FUNCTION "public"."rpc_init_inventory_item"("p_product_id" "text", "p_warehouse_id" "text", "p_location_id" "text", "p_initial_quantity" integer, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_link_auth_user_by_email"("p_auth_user_id" "text", "p_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_caller_auth_id TEXT;
    v_clean_email TEXT;
    v_target RECORD;
    v_existing_owner RECORD;
BEGIN
    -- 1. Verify caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required: session not found';
    END IF;

    v_caller_auth_id := auth.uid()::TEXT;

    -- 2. Authoritative identity check: p_auth_user_id must match auth.uid()
    IF p_auth_user_id IS NULL OR p_auth_user_id != v_caller_auth_id THEN
        RAISE EXCEPTION 'Authorization violation: caller identity mismatch';
    END IF;

    -- 3. Clean and validate email parameter
    v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
    IF v_clean_email = '' THEN
        RAISE EXCEPTION 'Invalid email parameter for user linkage';
    END IF;

    -- 4. Check if this supabaseUserId is already assigned to another WMS User
    SELECT * INTO v_existing_owner
    FROM public."User"
    WHERE "supabaseUserId" = v_caller_auth_id;

    IF FOUND THEN
        -- If already linked to the target user with this email, return success idempotent
        IF LOWER(TRIM(v_existing_owner."email")) = v_clean_email THEN
            RETURN jsonb_build_object(
                'success', true,
                'userId', v_existing_owner."id",
                'supabaseUserId', v_caller_auth_id,
                'message', 'User account already linked'
            );
        ELSE
            RAISE EXCEPTION 'Authenticated account % is already linked to a different WMS user (%)',
                v_caller_auth_id, v_existing_owner."id";
        END IF;
    END IF;

    -- 5. Locate target active WMS User by exact case-insensitive email
    SELECT * INTO v_target
    FROM public."User"
    WHERE LOWER(TRIM("email")) = v_clean_email;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No WMS user found matching email %', p_email;
    END IF;

    -- 6. Enforce active status
    IF v_target."status" != 'ACTIVE' THEN
        RAISE EXCEPTION 'WMS user account is inactive';
    END IF;

    -- 7. Reject if target user is already linked to a different Supabase Auth ID
    IF v_target."supabaseUserId" IS NOT NULL AND v_target."supabaseUserId" != v_caller_auth_id THEN
        RAISE EXCEPTION 'WMS user account is already linked to a different authentication identity';
    END IF;

    -- 8. If already linked to this auth user, return idempotent success
    IF v_target."supabaseUserId" = v_caller_auth_id THEN
        RETURN jsonb_build_object(
            'success', true,
            'userId', v_target."id",
            'supabaseUserId', v_caller_auth_id,
            'message', 'User account already linked'
        );
    END IF;

    -- 9. Update ONLY supabaseUserId and updatedAt
    UPDATE public."User"
    SET
        "supabaseUserId" = v_caller_auth_id,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_target."id";

    -- 10. Record AuditLog entry
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId",
        "previousValue", "newValue", "createdAt"
    ) VALUES (
        'audit_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
        v_target."tenantId",
        v_target."id",
        v_target."role",
        'LINK_AUTH_ACCOUNT',
        'User',
        v_target."id",
        jsonb_build_object('supabaseUserId', v_target."supabaseUserId"),
        jsonb_build_object('supabaseUserId', v_caller_auth_id, 'linkedVia', 'OAUTH_EMAIL_LINKAGE'),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'userId', v_target."id",
        'supabaseUserId', v_caller_auth_id,
        'message', 'User account successfully linked'
    );
END;
$$;


ALTER FUNCTION "public"."rpc_link_auth_user_by_email"("p_auth_user_id" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_log_email_delivery"("p_tenant_id" "text", "p_event_type" "public"."NotificationType", "p_recipient_email" "text", "p_subject" "text", "p_status" "text", "p_idempotency_key" "text", "p_notification_id" "text" DEFAULT NULL::"text", "p_order_id" "text" DEFAULT NULL::"text", "p_recipient_user_id" "text" DEFAULT NULL::"text", "p_resend_id" "text" DEFAULT NULL::"text", "p_reason" "text" DEFAULT NULL::"text", "p_error" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_log RECORD;
    v_id TEXT;
BEGIN
    -- Check for existing idempotency key
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_log FROM public."EmailLog" WHERE "idempotencyKey" = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'duplicate', true,
                'emailLogId', v_log.id,
                'status', v_log.status,
                'resendId', v_log."resendId"
            );
        END IF;
    END IF;

    v_id := concat('elog_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

    INSERT INTO public."EmailLog" (
        "id", "tenantId", "notificationId", "orderId", "recipientEmail",
        "recipientUserId", "eventType", "subject", "status", "resendId",
        "idempotencyKey", "reason", "error", "metadata", "createdAt"
    )
    VALUES (
        v_id, p_tenant_id, p_notification_id, p_order_id, p_recipient_email,
        p_recipient_user_id, p_event_type, p_subject, p_status, p_resend_id,
        p_idempotency_key, p_reason, p_error, p_metadata, CURRENT_TIMESTAMP
    )
    RETURNING * INTO v_log;

    RETURN jsonb_build_object(
        'success', true,
        'duplicate', false,
        'emailLogId', v_log.id,
        'status', v_log.status,
        'resendId', v_log."resendId"
    );
END;
$$;


ALTER FUNCTION "public"."rpc_log_email_delivery"("p_tenant_id" "text", "p_event_type" "public"."NotificationType", "p_recipient_email" "text", "p_subject" "text", "p_status" "text", "p_idempotency_key" "text", "p_notification_id" "text", "p_order_id" "text", "p_recipient_user_id" "text", "p_resend_id" "text", "p_reason" "text", "p_error" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_mark_notification_read"("p_notification_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
    v_notif RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_notif FROM public."Notification" WHERE "id" = p_notification_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Notification not found');
    END IF;

    -- Tenant check
    IF v_actor.role != 'PLATFORM_ADMIN' AND v_actor.tenant_id != v_notif."tenantId" THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied: wrong tenant');
    END IF;

    -- Client role access verification:
    -- A client user may only mark as read if it is their direct notification (userId = actor_id)
    -- or if the notification is for an order belonging to their company.
    IF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
        IF v_notif."userId" IS NOT NULL AND v_notif."userId" != v_actor.actor_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Access denied: not recipient');
        END IF;

        IF v_notif."orderId" IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public."Order" o
                WHERE o."id" = v_notif."orderId"
                  AND public.can_access_client(o."clientId")
            ) THEN
                RETURN jsonb_build_object('success', false, 'error', 'Access denied: client boundary violation');
            END IF;
        END IF;
    END IF;

    UPDATE public."Notification"
    SET "read" = true,
        "readAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_notification_id;

    RETURN jsonb_build_object('success', true, 'notificationId', p_notification_id);
END;
$$;


ALTER FUNCTION "public"."rpc_mark_notification_read"("p_notification_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_receive_or_adjust_stock"("p_inventory_id" "text", "p_quantity" integer, "p_type" "public"."InventoryMovementType", "p_notes" "text" DEFAULT NULL::"text", "p_user_id" "text" DEFAULT NULL::"text", "p_user_role" "public"."Role" DEFAULT NULL::"public"."Role") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
    v_effective_user_id TEXT;
    v_effective_user_role "Role";
    v_inv RECORD;
    v_prod RECORD;
    v_new_available INTEGER;
    v_new_total INTEGER;
    v_new_damaged INTEGER;
    v_movement_id TEXT;
    v_default_warehouse_id TEXT;
    v_default_location_id TEXT;
    v_inv_id TEXT;
BEGIN
    -- Resolve authenticated actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- Authorize warehouse management roles
    IF NOT (v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'PLATFORM_ADMIN')) THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot perform stock adjustments', v_actor.role;
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    -- 1. Try to find Inventory record by id
    SELECT * INTO v_inv FROM "Inventory" WHERE "id" = p_inventory_id;
    
    -- 2. If not found by inventory id, check if p_inventory_id is a Product id
    IF NOT FOUND THEN
        SELECT * INTO v_prod FROM "Product" WHERE "id" = p_inventory_id;
        IF FOUND THEN
            -- Tenant isolation check on Product
            IF v_actor.role != 'PLATFORM_ADMIN' AND v_actor.tenant_id != v_prod."tenantId" THEN
                RAISE EXCEPTION 'Tenant authorization failure: product belongs to another tenant';
            END IF;

            -- Check if an Inventory row already exists for this product
            SELECT * INTO v_inv FROM "Inventory" 
            WHERE "productId" = v_prod."id" 
              AND "tenantId" = v_prod."tenantId"
            ORDER BY "createdAt" ASC LIMIT 1;

            -- If still no inventory row, create one
            IF NOT FOUND THEN
                SELECT "id" INTO v_default_warehouse_id 
                FROM "Warehouse" 
                WHERE "tenantId" = v_prod."tenantId" 
                ORDER BY "createdAt" ASC LIMIT 1;

                SELECT "id" INTO v_default_location_id 
                FROM "WarehouseLocation" 
                WHERE "warehouseId" = v_default_warehouse_id 
                LIMIT 1;

                v_inv_id := concat('inv_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
                
                INSERT INTO "Inventory" (
                    "id", "tenantId", "warehouseId", "productId", "locationId",
                    "totalQuantity", "availableQuantity", "reservedQuantity", "damagedQuantity",
                    "quantity", "createdAt", "updatedAt"
                ) VALUES (
                    v_inv_id,
                    v_prod."tenantId",
                    v_default_warehouse_id,
                    v_prod."id",
                    v_default_location_id,
                    0, 0, 0, 0,
                    0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING * INTO v_inv;
            END IF;
        ELSE
            RAISE EXCEPTION 'Inventory record % not found', p_inventory_id;
        END IF;
    END IF;

    -- Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id != v_inv."tenantId" THEN
            RAISE EXCEPTION 'Tenant authorization failure: inventory belongs to another tenant';
        END IF;
    END IF;

    -- Authoritative actor identity
    v_effective_user_id := v_actor.actor_id;
    v_effective_user_role := v_actor.role::"Role";

    IF p_type = 'DAMAGE' THEN
        v_new_available := v_inv."availableQuantity" - p_quantity;
        v_new_total := v_inv."totalQuantity";
        v_new_damaged := v_inv."damagedQuantity" + p_quantity;
    ELSE
        v_new_available := v_inv."availableQuantity" + p_quantity;
        v_new_total := v_inv."totalQuantity" + p_quantity;
        v_new_damaged := v_inv."damagedQuantity";
    END IF;

    IF v_new_available < 0 THEN
        RAISE EXCEPTION 'Insufficient available stock. Cannot reduce stock below 0.';
    END IF;

    -- Update inventory with explicit updatedAt
    UPDATE "Inventory"
    SET "availableQuantity" = v_new_available,
        "totalQuantity" = v_new_total,
        "damagedQuantity" = v_new_damaged,
        "quantity" = v_new_total,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_inv."id";

    -- Create movement record
    v_movement_id := concat('mov_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    INSERT INTO "InventoryMovement" (
        "id", "tenantId", "inventoryId", "productId", "type",
        "quantity", "previousQuantity", "newQuantity", "notes", "createdById", "createdAt"
    )
    VALUES (
        v_movement_id,
        v_inv."tenantId",
        v_inv."id",
        v_inv."productId",
        p_type,
        p_quantity,
        v_inv."availableQuantity",
        v_new_available,
        p_notes,
        v_effective_user_id,
        CURRENT_TIMESTAMP
    );

    -- Log audit
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_inv."tenantId",
        v_effective_user_id,
        v_effective_user_role,
        'Recorded stock movement',
        'Inventory',
        v_inv."id",
        jsonb_build_object('availableQuantity', v_inv."availableQuantity"),
        jsonb_build_object('availableQuantity', v_new_available, 'type', p_type),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'inventoryId', v_inv."id",
        'movementId', v_movement_id,
        'availableQuantity', v_new_available,
        'totalQuantity', v_new_total
    );
END;
$$;


ALTER FUNCTION "public"."rpc_receive_or_adjust_stock"("p_inventory_id" "text", "p_quantity" integer, "p_type" "public"."InventoryMovementType", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_record_payment_secure"("p_invoice_id" "text", "p_amount" numeric, "p_method" "text" DEFAULT 'BANK_TRANSFER'::"text", "p_reference" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
    v_invoice RECORD;
    v_order RECORD;
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

    -- 5. Validate invoice status is FINAL
    IF v_invoice.status != 'FINAL' THEN
        RAISE EXCEPTION 'Invoice % is not in FINAL status', p_invoice_id;
    END IF;

    -- 6. Load associated order and enforce Delivery Verification gate
    IF v_invoice."orderId" IS NULL THEN
        RAISE EXCEPTION 'Invoice % is not associated with an order', p_invoice_id;
    END IF;

    SELECT * INTO v_order FROM "Order" WHERE "id" = v_invoice."orderId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % for invoice % not found', v_invoice."orderId", p_invoice_id;
    END IF;

    IF v_order."deliveryVerifiedAt" IS NULL THEN
        RAISE EXCEPTION 'Payment is available after delivery verification';
    END IF;

    -- 7. Tenant and Client isolation check
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

    -- 8. Generate payment details
    v_payment_id := concat('pay_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    v_method := COALESCE(NULLIF(TRIM(p_method), ''), 'BANK_TRANSFER');
    v_reference := NULLIF(TRIM(p_reference), '');
    IF v_reference IS NULL THEN
        v_reference := concat('PAY-', right((extract(epoch from clock_timestamp()) * 1000)::bigint::text, 6));
    END IF;

    -- 9. Insert Payment record
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

    -- 10. Calculate total paid from trusted database records
    SELECT COALESCE(SUM("amount"), 0) INTO v_total_paid
    FROM "Payment"
    WHERE "invoiceId" = v_invoice."id" AND "status" = 'PAID';

    -- 11. Determine new payment status on the Invoice
    IF v_total_paid >= v_invoice."total" THEN
        v_new_payment_status := 'PAID';
    ELSIF v_total_paid > 0 THEN
        v_new_payment_status := 'PARTIALLY_PAID';
    ELSE
        v_new_payment_status := 'PAYMENT_PENDING';
    END IF;

    -- 12. Update Invoice payment status
    UPDATE "Invoice"
    SET "paymentStatus" = v_new_payment_status,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_invoice."id";

    -- 13. Record in AuditLog using resolved actor
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

    -- 14. Return payload
    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment_id,
        'invoiceId', v_invoice."id",
        'paymentStatus', v_new_payment_status,
        'totalPaid', v_total_paid
    );
END;
$$;


ALTER FUNCTION "public"."rpc_record_payment_secure"("p_invoice_id" "text", "p_amount" numeric, "p_method" "text", "p_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_submit_store_verification"("p_order_id" "text", "p_items" "jsonb" DEFAULT NULL::"jsonb", "p_comments" "text" DEFAULT NULL::"text", "p_inventory_updated" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."rpc_submit_store_verification"("p_order_id" "text", "p_items" "jsonb", "p_comments" "text", "p_inventory_updated" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_submit_verification"("p_order_id" "text", "p_status" "public"."VerificationStatus", "p_responses" "jsonb", "p_comments" "text" DEFAULT NULL::"text", "p_attachments" "jsonb" DEFAULT NULL::"jsonb", "p_user_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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

    -- Advance unpaid invoices for this order to PAYMENT_PENDING immediately upon delivery verification
    UPDATE "Invoice"
    SET "paymentStatus" = 'PAYMENT_PENDING',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "orderId" = v_order."id" AND "paymentStatus" = 'UNPAID';

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


ALTER FUNCTION "public"."rpc_submit_verification"("p_order_id" "text", "p_status" "public"."VerificationStatus", "p_responses" "jsonb", "p_comments" "text", "p_attachments" "jsonb", "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_transition_order"("p_order_id" "text", "p_next_status" "public"."OrderStatus", "p_notes" "text" DEFAULT NULL::"text", "p_user_id" "text" DEFAULT NULL::"text", "p_user_role" "public"."Role" DEFAULT 'WAREHOUSE_STAFF'::"public"."Role") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
    v_effective_user_id TEXT;
    v_effective_user_role "Role";
    v_order RECORD;
    v_new_verification "VerificationStatus";
    v_valid_transition BOOLEAN := FALSE;
BEGIN
    -- Resolve authenticated actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- Retrieve order
    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order with ID % not found', p_order_id;
    END IF;

    -- Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id != v_order."tenantId" THEN
            RAISE EXCEPTION 'Tenant authorization failure: order belongs to another tenant';
        END IF;
    END IF;

    -- Authoritative actor identity and role
    v_effective_user_id := v_actor.actor_id;
    v_effective_user_role := v_actor.role::"Role";

    -- Validate role restrictions
    IF v_effective_user_role = 'CLIENT' THEN
        RAISE EXCEPTION 'Clients must use delivery verification to advance dispatched orders';
    END IF;

    IF v_effective_user_role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT')
       AND p_next_status NOT IN ('INVOICED', 'PAYMENT_PENDING', 'PAID', 'COMPLETED') THEN
        RAISE EXCEPTION 'Accountants cannot perform this order transition';
    END IF;

    -- Validate state machine:
    -- Target workflow: ISSUED -> DISPATCHED -> (Verification RPC) -> VERIFIED
    -- Prohibit DISPATCHED -> RECEIVED and RECEIVED -> VERIFICATION_PENDING
    -- Do not add generic DISPATCHED -> VERIFIED transition (verification RPC is the controlled path)
    CASE v_order.status
        WHEN 'DRAFT' THEN
            v_valid_transition := p_next_status IN ('ISSUED', 'CANCELLED');
        WHEN 'ISSUED' THEN
            v_valid_transition := p_next_status IN ('DISPATCHED', 'PROCESSING', 'CANCELLED');
        WHEN 'PROCESSING' THEN
            v_valid_transition := p_next_status IN ('READY_FOR_DISPATCH', 'CANCELLED');
        WHEN 'READY_FOR_DISPATCH' THEN
            v_valid_transition := p_next_status IN ('DISPATCHED', 'CANCELLED');
        WHEN 'DISPATCHED' THEN
            -- Generic transition cannot bypass verification RPC to reach VERIFIED.
            -- Only emergency cancellation is permitted directly.
            v_valid_transition := p_next_status IN ('CANCELLED');
        WHEN 'RECEIVED' THEN
            -- Historical state: no new active transitions
            v_valid_transition := FALSE;
        WHEN 'VERIFICATION_PENDING' THEN
            -- Historical state: no new active transitions
            v_valid_transition := FALSE;
        WHEN 'VERIFIED' THEN
            v_valid_transition := p_next_status IN ('INVOICE_PENDING', 'INVOICED');
        WHEN 'PARTIALLY_VERIFIED' THEN
            v_valid_transition := p_next_status IN ('PROCESSING', 'CANCELLED');
        WHEN 'REJECTED' THEN
            v_valid_transition := p_next_status IN ('PROCESSING', 'CANCELLED');
        WHEN 'INVOICE_PENDING' THEN
            v_valid_transition := p_next_status IN ('INVOICED');
        WHEN 'INVOICED' THEN
            v_valid_transition := p_next_status IN ('PAYMENT_PENDING');
        WHEN 'PAYMENT_PENDING' THEN
            v_valid_transition := p_next_status IN ('PAID');
        WHEN 'PAID' THEN
            v_valid_transition := p_next_status IN ('COMPLETED');
        ELSE
            v_valid_transition := FALSE;
    END CASE;

    IF NOT v_valid_transition THEN
        RAISE EXCEPTION 'Invalid order status transition from % to %', v_order.status, p_next_status;
    END IF;

    -- Compute verification status if applicable
    IF p_next_status = 'VERIFIED' THEN
        v_new_verification := 'VERIFIED';
    ELSIF p_next_status = 'PARTIALLY_VERIFIED' THEN
        v_new_verification := 'PARTIALLY_VERIFIED';
    ELSIF p_next_status = 'REJECTED' THEN
        v_new_verification := 'REJECTED';
    ELSE
        v_new_verification := v_order."verificationStatus";
    END IF;

    -- Update Order
    UPDATE "Order"
    SET "status" = p_next_status,
        "verificationStatus" = v_new_verification,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_order_id;

    -- Record Order Status History
    INSERT INTO "OrderStatusHistory" ("id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt")
    VALUES (
        concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_order_id,
        v_order.status,
        p_next_status,
        v_effective_user_id,
        p_notes,
        CURRENT_TIMESTAMP
    );

    -- Record Audit Log
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_effective_user_id,
        v_effective_user_role,
        'Changed order status',
        'Order',
        p_order_id,
        jsonb_build_object('status', v_order.status),
        jsonb_build_object('status', p_next_status),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', p_order_id,
        'previousStatus', v_order.status,
        'newStatus', p_next_status,
        'verificationStatus', v_new_verification
    );
END;
$$;


ALTER FUNCTION "public"."rpc_transition_order"("p_order_id" "text", "p_next_status" "public"."OrderStatus", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_update_client_employee"("p_client_employee_id" "text", "p_contact_person" "text" DEFAULT NULL::"text", "p_mobile" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_new_client_id" "text" DEFAULT NULL::"text", "p_new_employee_role" "public"."ClientEmployeeRole" DEFAULT NULL::"public"."ClientEmployeeRole", "p_new_status" "public"."UserStatus" DEFAULT NULL::"public"."UserStatus") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_session_actor RECORD;
    v_target_ce RECORD;
    v_target_client RECORD;
    v_prev_value JSONB;
    v_new_value JSONB;
    v_new_contact_person TEXT;
    v_new_mobile TEXT;
    v_new_email TEXT;
    v_new_client_id TEXT;
    v_new_employee_role "public"."ClientEmployeeRole";
    v_new_status "public"."UserStatus";
BEGIN
    -- 1. Resolve session actor via existing authoritative get_current_actor()
    SELECT * INTO v_session_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_session_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- 2. Enforce narrowest employee management authority: PLATFORM_ADMIN or WAREHOUSE_OWNER only
    IF v_session_actor.role NOT IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER') THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot manage employees', v_session_actor.role;
    END IF;

    -- 3. Resolve target ClientEmployee
    SELECT * INTO v_target_ce FROM public."ClientEmployee" WHERE "id" = p_client_employee_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client employee % not found', p_client_employee_id;
    END IF;

    -- 4. Enforce tenant isolation for non-PLATFORM_ADMIN
    IF v_session_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_session_actor.tenant_id IS NULL OR v_session_actor.tenant_id != v_target_ce."tenantId" THEN
            RAISE EXCEPTION 'Tenant isolation violation: actor tenant % does not match employee tenant %',
                v_session_actor.tenant_id, v_target_ce."tenantId";
        END IF;
    END IF;

    -- 5. Calculate new field values with explicit update semantics
    -- Contact Person: if provided, must be non-empty
    IF p_contact_person IS NOT NULL THEN
        IF LENGTH(TRIM(p_contact_person)) = 0 THEN
            RAISE EXCEPTION 'Contact person name cannot be empty';
        END IF;
        v_new_contact_person := TRIM(p_contact_person);
    ELSE
        v_new_contact_person := v_target_ce."contactPerson";
    END IF;

    -- Mobile: if provided, must be non-empty
    IF p_mobile IS NOT NULL THEN
        IF LENGTH(TRIM(p_mobile)) = 0 THEN
            RAISE EXCEPTION 'Mobile number cannot be empty';
        END IF;
        v_new_mobile := TRIM(p_mobile);
    ELSE
        v_new_mobile := v_target_ce."mobile";
    END IF;

    -- Email: empty string clears it, non-empty sets normalized email
    IF p_email IS NOT NULL THEN
        v_new_email := NULLIF(LOWER(TRIM(p_email)), '');
    ELSE
        v_new_email := v_target_ce."email";
    END IF;

    -- Client Company: if provided and different, validate target company exists in SAME tenant
    IF p_new_client_id IS NOT NULL AND p_new_client_id != v_target_ce."clientId" THEN
        SELECT * INTO v_target_client FROM public."Client" WHERE "id" = p_new_client_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target client company % not found', p_new_client_id;
        END IF;

        IF v_target_client."tenantId" != v_target_ce."tenantId" THEN
            RAISE EXCEPTION 'Cross-tenant company reassignment is strictly prohibited: target client tenant % does not match employee tenant %',
                v_target_client."tenantId", v_target_ce."tenantId";
        END IF;

        v_new_client_id := p_new_client_id;
    ELSE
        v_new_client_id := v_target_ce."clientId";
    END IF;

    -- Employee Role: if provided, update
    IF p_new_employee_role IS NOT NULL THEN
        v_new_employee_role := p_new_employee_role;
    ELSE
        v_new_employee_role := v_target_ce."employeeRole";
    END IF;

    -- Status: if provided, update
    IF p_new_status IS NOT NULL THEN
        v_new_status := p_new_status;
    ELSE
        v_new_status := v_target_ce."status";
    END IF;

    -- 6. Capture previous state for AuditLog
    v_prev_value := to_jsonb(v_target_ce);

    -- 7. Update ClientEmployee record
    UPDATE public."ClientEmployee"
    SET
        "contactPerson" = v_new_contact_person,
        "mobile"        = v_new_mobile,
        "email"         = v_new_email,
        "clientId"      = v_new_client_id,
        "employeeRole"  = v_new_employee_role,
        "status"        = v_new_status,
        "updatedAt"     = CURRENT_TIMESTAMP
    WHERE "id" = p_client_employee_id;

    -- 8. Synchronize linked WMS User record if present
    -- User.id, User.supabaseUserId, User.role, and User.tenantId are PRESERVED and NEVER modified!
    IF v_target_ce."userId" IS NOT NULL THEN
        UPDATE public."User"
        SET
            "name"      = v_new_contact_person,
            "mobile"    = v_new_mobile,
            "email"     = COALESCE(v_new_email, "email"),
            "status"    = v_new_status,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = v_target_ce."userId";
    END IF;

    -- 9. Reload updated ClientEmployee record for AuditLog and return payload
    SELECT * INTO v_target_ce FROM public."ClientEmployee" WHERE "id" = p_client_employee_id;
    v_new_value := to_jsonb(v_target_ce);

    -- 10. Record in AuditLog
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId",
        "previousValue", "newValue", "createdAt"
    ) VALUES (
        'audit_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
        v_target_ce."tenantId",
        v_session_actor.actor_id,
        v_session_actor.role::"Role",
        'UPDATE_CLIENT_EMPLOYEE',
        'ClientEmployee',
        p_client_employee_id,
        v_prev_value,
        v_new_value,
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'clientEmployeeId', p_client_employee_id,
        'userId', v_target_ce."userId",
        'clientId', v_target_ce."clientId",
        'employeeRole', v_target_ce."employeeRole",
        'status', v_target_ce."status"
    );
END;
$$;


ALTER FUNCTION "public"."rpc_update_client_employee"("p_client_employee_id" "text", "p_contact_person" "text", "p_mobile" "text", "p_email" "text", "p_new_client_id" "text", "p_new_employee_role" "public"."ClientEmployeeRole", "p_new_status" "public"."UserStatus") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_update_employee"("p_actor_id" "text", "p_actor_role" "public"."Role", "p_target_id" "text", "p_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_mobile" "text" DEFAULT NULL::"text", "p_new_role" "public"."Role" DEFAULT NULL::"public"."Role", "p_new_status" "public"."UserStatus" DEFAULT NULL::"public"."UserStatus") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_session_actor RECORD;
    v_actor_id TEXT;
    v_actor_role "Role";
    v_target RECORD;
    v_prev_value JSONB;
    v_new_value JSONB;

    -- Single source of truth: employee roles allowed for targeting & assigning
    v_allowed_employee_roles "Role"[] := ARRAY[
        'WAREHOUSE_STAFF',
        'ACCOUNTS_TEAM',
        'ACCOUNTANT',
        'WAREHOUSE_MODERATOR'
    ]::"Role"[];

    -- Roles authorized to manage employees: WAREHOUSE_OWNER and PLATFORM_ADMIN
    v_authorized_actor_roles "Role"[] := ARRAY[
        'WAREHOUSE_OWNER',
        'PLATFORM_ADMIN'
    ]::"Role"[];
BEGIN
    -- 1. Resolve session actor
    SELECT * INTO v_session_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_session_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- 2. Authorize actor role
    IF NOT (v_session_actor.role = ANY(v_authorized_actor_roles::TEXT[])) THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot manage employees', v_session_actor.role;
    END IF;

    v_actor_id := v_session_actor.actor_id;
    v_actor_role := v_session_actor.role::"Role";

    -- 3. Resolve target employee
    SELECT * INTO v_target FROM "User" WHERE "id" = p_target_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user % not found', p_target_id;
    END IF;

    -- 4. Enforce tenant isolation
    IF v_session_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_session_actor.tenant_id IS NULL OR v_session_actor.tenant_id != v_target."tenantId" THEN
            RAISE EXCEPTION 'Tenant isolation violation: actor tenant % does not match target tenant %',
                v_session_actor.tenant_id, v_target."tenantId";
        END IF;
    END IF;

    -- 5. Prevent acting on self
    IF v_actor_id = v_target.id THEN
        RAISE EXCEPTION 'Cannot modify your own account via this function';
    END IF;

    -- 6. Target must currently be an employee role
    IF NOT (v_target.role = ANY(v_allowed_employee_roles)) THEN
        RAISE EXCEPTION 'Target user role % is not editable via employee management', v_target.role;
    END IF;

    -- 7. Assignable role check
    IF p_new_role IS NOT NULL THEN
        IF NOT (p_new_role = ANY(v_allowed_employee_roles)) THEN
            RAISE EXCEPTION 'Role % is not assignable via employee management', p_new_role;
        END IF;
    END IF;

    -- 8. Capture previous state for audit log
    v_prev_value := to_jsonb(v_target);

    -- 9. Apply updates
    UPDATE "User"
    SET
        "name"      = COALESCE(NULLIF(TRIM(p_name), ''), "name"),
        "email"     = CASE WHEN p_email IS NOT NULL THEN NULLIF(TRIM(p_email), '') ELSE "email" END,
        "mobile"    = CASE WHEN p_mobile IS NOT NULL THEN NULLIF(TRIM(p_mobile), '') ELSE "mobile" END,
        "role"      = COALESCE(p_new_role,   "role"),
        "status"    = COALESCE(p_new_status, "status"),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_id;

    -- 10. Reload updated target record
    SELECT * INTO v_target FROM "User" WHERE "id" = p_target_id;
    v_new_value := to_jsonb(v_target);

    -- 11. Write audit log record
    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId",
        "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_target."tenantId",
        v_actor_id,
        v_actor_role,
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


ALTER FUNCTION "public"."rpc_update_employee"("p_actor_id" "text", "p_actor_role" "public"."Role", "p_target_id" "text", "p_name" "text", "p_email" "text", "p_mobile" "text", "p_new_role" "public"."Role", "p_new_status" "public"."UserStatus") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_update_notification_settings"("p_tenant_id" "text", "p_enabled" boolean, "p_event_config" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor RECORD;
    v_settings RECORD;
    v_id TEXT;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Tenant isolation & Role check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id != p_tenant_id THEN
            RAISE EXCEPTION 'Access denied: cannot modify settings for another tenant';
        END IF;

        IF v_actor.role NOT IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR') THEN
            RAISE EXCEPTION 'Insufficient permissions: only warehouse owners and moderators may update notification settings';
        END IF;
    END IF;

    -- Upsert NotificationSettings
    INSERT INTO public."NotificationSettings" ("id", "tenantId", "enabled", "eventConfig", "updatedAt")
    VALUES (
        concat('ns_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        p_tenant_id,
        p_enabled,
        p_event_config,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ("tenantId")
    DO UPDATE SET
        "enabled" = EXCLUDED."enabled",
        "eventConfig" = EXCLUDED."eventConfig",
        "updatedAt" = CURRENT_TIMESTAMP
    RETURNING * INTO v_settings;

    -- Mirror to WarehouseSetting for backward compatibility
    UPDATE public."WarehouseSetting"
    SET "notificationPreferences" = jsonb_build_object(
            'enabled', p_enabled,
            'eventConfig', p_event_config
        ),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true,
        'settings', row_to_json(v_settings)
    );
END;
$$;


ALTER FUNCTION "public"."rpc_update_notification_settings"("p_tenant_id" "text", "p_enabled" boolean, "p_event_config" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_inventory_timestamps"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."createdAt" IS NULL THEN
            NEW."createdAt" := CURRENT_TIMESTAMP;
        END IF;
        IF NEW."updatedAt" IS NULL THEN
            NEW."updatedAt" := CURRENT_TIMESTAMP;
        END IF;
        IF NEW."quantity" IS NOT NULL AND NEW."quantity" > 0 AND (NEW."totalQuantity" IS NULL OR NEW."totalQuantity" = 0) THEN
            NEW."totalQuantity" := NEW."quantity";
            NEW."availableQuantity" := NEW."quantity";
        ELSIF NEW."totalQuantity" IS NOT NULL THEN
            NEW."quantity" := NEW."totalQuantity";
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW."updatedAt" := CURRENT_TIMESTAMP;
        IF NEW."totalQuantity" IS NOT NULL THEN
            NEW."quantity" := NEW."totalQuantity";
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_set_inventory_timestamps"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."AuditLog" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text",
    "userId" "text",
    "userRole" "public"."Role" NOT NULL,
    "action" "text" NOT NULL,
    "entity" "text" NOT NULL,
    "entityId" "text" NOT NULL,
    "previousValue" "jsonb",
    "newValue" "jsonb",
    "ipAddress" "text",
    "userAgent" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."AuditLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Category" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "name" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Category" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Client" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "companyName" "text" NOT NULL,
    "gstNumber" "text",
    "billingAddress" "text" NOT NULL,
    "shippingAddress" "text" NOT NULL,
    "status" "public"."ClientStatus" DEFAULT 'ACTIVE'::"public"."ClientStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "companyGroupId" "text"
);


ALTER TABLE "public"."Client" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ClientEmployee" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "clientId" "text" NOT NULL,
    "userId" "text",
    "employeeRole" "public"."ClientEmployeeRole" DEFAULT 'RECEIVER'::"public"."ClientEmployeeRole" NOT NULL,
    "contactPerson" "text" NOT NULL,
    "mobile" "text" NOT NULL,
    "email" "text",
    "status" "public"."UserStatus" DEFAULT 'ACTIVE'::"public"."UserStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "roleId" "text"
);


ALTER TABLE "public"."ClientEmployee" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."CompanyGroup" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."CompanyGroup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."DeliveryVerification" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "orderId" "text",
    "invoiceId" "text",
    "importedInvoiceId" "text",
    "clientId" "text" NOT NULL,
    "status" "public"."VerificationStatus" DEFAULT 'PENDING'::"public"."VerificationStatus" NOT NULL,
    "confirmationText" "text",
    "comments" "text",
    "attachments" "jsonb",
    "ipAddress" "text",
    "userAgent" "text",
    "verifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."DeliveryVerification" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."DeliveryVerificationItem" (
    "id" "text" NOT NULL,
    "verificationId" "text" NOT NULL,
    "importedInvoiceItemId" "text",
    "expectedQuantity" numeric(12,3) NOT NULL,
    "receivedQuantity" numeric(12,3) DEFAULT 0 NOT NULL,
    "status" "public"."DeliveryVerificationItemStatus" DEFAULT 'PENDING'::"public"."DeliveryVerificationItemStatus" NOT NULL,
    "comment" "text",
    "attachment" "jsonb",
    "verifiedAt" timestamp(3) without time zone
);


ALTER TABLE "public"."DeliveryVerificationItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Document" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "orderId" "text",
    "type" "public"."DocumentType" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "mimeType" "text" NOT NULL,
    "sizeBytes" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Document" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EWayBill" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "invoiceId" "text",
    "importedInvoiceId" "text",
    "ewayBillNumber" "text",
    "documentNumber" "text" NOT NULL,
    "documentDate" timestamp(3) without time zone NOT NULL,
    "supplierGstin" "text",
    "recipientGstin" "text",
    "dispatchFrom" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "shipTo" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "transporterId" "text",
    "vehicleNumber" "text",
    "transportMode" "text",
    "distance" integer,
    "status" "public"."EWayBillStatus" DEFAULT 'DRAFT'::"public"."EWayBillStatus" NOT NULL,
    "missingFields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "requestData" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "responseData" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generatedAt" timestamp(3) without time zone,
    "expiryDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."EWayBill" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EmailLog" (
    "id" "text" DEFAULT "concat"('elog_', "substr"("md5"((("random"())::"text" || ("clock_timestamp"())::"text")), 1, 16)) NOT NULL,
    "tenantId" "text" NOT NULL,
    "notificationId" "text",
    "orderId" "text",
    "recipientEmail" "text" NOT NULL,
    "recipientUserId" "text",
    "eventType" "public"."NotificationType" NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" NOT NULL,
    "resendId" "text",
    "idempotencyKey" "text",
    "reason" "text",
    "error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "EmailLog_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'SENT'::"text", 'SKIPPED'::"text", 'FAILED'::"text"])))
);


ALTER TABLE "public"."EmailLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ImportedInvoice" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "originalDocumentId" "text" NOT NULL,
    "invoiceId" "text",
    "orderId" "text",
    "clientId" "text",
    "uploadedById" "text" NOT NULL,
    "importNumber" "text" NOT NULL,
    "status" "public"."InvoiceImportStatus" DEFAULT 'UPLOADED'::"public"."InvoiceImportStatus" NOT NULL,
    "extractedData" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "correctedData" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "missingFields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "confidence" numeric(5,2),
    "failureReason" "text",
    "confirmedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."ImportedInvoice" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ImportedInvoiceItem" (
    "id" "text" NOT NULL,
    "importedInvoiceId" "text" NOT NULL,
    "productName" "text" NOT NULL,
    "sku" "text",
    "hsnSac" "text",
    "quantity" numeric(12,3) NOT NULL,
    "unit" "text",
    "rate" numeric(12,2),
    "discount" numeric(12,2) DEFAULT 0 NOT NULL,
    "taxableValue" numeric(12,2),
    "gstRate" numeric(5,2),
    "cgst" numeric(12,2) DEFAULT 0 NOT NULL,
    "sgst" numeric(12,2) DEFAULT 0 NOT NULL,
    "igst" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2),
    "requiresReview" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."ImportedInvoiceItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Inventory" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "warehouseId" "text" NOT NULL,
    "locationId" "text",
    "productId" "text" NOT NULL,
    "totalQuantity" integer DEFAULT 0 NOT NULL,
    "availableQuantity" integer DEFAULT 0 NOT NULL,
    "reservedQuantity" integer DEFAULT 0 NOT NULL,
    "damagedQuantity" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "quantity" integer DEFAULT 0
);


ALTER TABLE "public"."Inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."InventoryMovement" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "inventoryId" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "orderId" "text",
    "type" "public"."InventoryMovementType" NOT NULL,
    "quantity" integer NOT NULL,
    "previousQuantity" integer NOT NULL,
    "newQuantity" integer NOT NULL,
    "notes" "text",
    "createdById" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."InventoryMovement" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Invoice" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "orderId" "text" NOT NULL,
    "clientId" "text" NOT NULL,
    "invoiceNumber" "text" NOT NULL,
    "invoiceDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "status" "public"."InvoiceStatus" DEFAULT 'DRAFT'::"public"."InvoiceStatus" NOT NULL,
    "paymentStatus" "public"."PaymentStatus" DEFAULT 'UNPAID'::"public"."PaymentStatus" NOT NULL,
    "subtotal" numeric(12,2) NOT NULL,
    "cgst" numeric(12,2) NOT NULL,
    "sgst" numeric(12,2) NOT NULL,
    "igst" numeric(12,2) NOT NULL,
    "discountTotal" numeric(12,2) NOT NULL,
    "total" numeric(12,2) NOT NULL,
    "pdfUrl" "text",
    "finalizedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."Invoice" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."InvoiceItem" (
    "id" "text" NOT NULL,
    "invoiceId" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "rate" numeric(12,2) NOT NULL,
    "discount" numeric(12,2) DEFAULT 0 NOT NULL,
    "cgst" numeric(12,2) NOT NULL,
    "sgst" numeric(12,2) NOT NULL,
    "igst" numeric(12,2) NOT NULL,
    "total" numeric(12,2) NOT NULL
);


ALTER TABLE "public"."InvoiceItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Notification" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "userId" "text",
    "orderId" "text",
    "type" "public"."NotificationType" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "actionUrl" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "readAt" timestamp(3) without time zone,
    "warehouseId" "text"
);


ALTER TABLE "public"."Notification" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."NotificationSettings" (
    "id" "text" DEFAULT "concat"('ns_', "substr"("md5"((("random"())::"text" || ("clock_timestamp"())::"text")), 1, 16)) NOT NULL,
    "tenantId" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "eventConfig" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."NotificationSettings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Order" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "clientId" "text" NOT NULL,
    "orderNumber" "text" NOT NULL,
    "orderDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expectedDelivery" timestamp(3) without time zone,
    "status" "public"."OrderStatus" DEFAULT 'DRAFT'::"public"."OrderStatus" NOT NULL,
    "verificationStatus" "public"."VerificationStatus" DEFAULT 'PENDING'::"public"."VerificationStatus" NOT NULL,
    "subtotal" numeric(12,2) NOT NULL,
    "taxTotal" numeric(12,2) NOT NULL,
    "discountTotal" numeric(12,2) NOT NULL,
    "totalAmount" numeric(12,2) NOT NULL,
    "notes" "text",
    "createdById" "text" NOT NULL,
    "assignedStaffId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "deliveryVerifiedAt" timestamp(3) without time zone,
    "deliveryVerifiedById" "text",
    "storeVerifiedAt" timestamp(3) without time zone,
    "storeVerifiedById" "text"
);


ALTER TABLE "public"."Order" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."OrderItem" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "orderId" "text" NOT NULL,
    "productId" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL,
    "taxRate" numeric(5,2) NOT NULL,
    "discount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) NOT NULL
);


ALTER TABLE "public"."OrderItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."OrderStatusHistory" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "orderId" "text" NOT NULL,
    "previousStatus" "public"."OrderStatus",
    "newStatus" "public"."OrderStatus" NOT NULL,
    "changedById" "text" NOT NULL,
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."OrderStatusHistory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Payment" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "invoiceId" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL,
    "method" "text" NOT NULL,
    "reference" "text",
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "proofUrl" "text"
);


ALTER TABLE "public"."Payment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Permission" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Permission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PlatformSetting" (
    "id" "text" NOT NULL,
    "tenantId" "text",
    "platformName" "text" DEFAULT 'WarehouseOS'::"text" NOT NULL,
    "platformLogo" "text",
    "featureFlags" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notificationSettings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."PlatformSetting" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Product" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "categoryId" "text",
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "description" "text",
    "unit" "text" NOT NULL,
    "purchasePrice" numeric(12,2) NOT NULL,
    "sellingPrice" numeric(12,2) NOT NULL,
    "gstRate" numeric(5,2) NOT NULL,
    "barcode" "text",
    "minimumStock" integer DEFAULT 0 NOT NULL,
    "reorderLevel" integer DEFAULT 0 NOT NULL,
    "status" "public"."ProductStatus" DEFAULT 'ACTIVE'::"public"."ProductStatus" NOT NULL,
    "imageUrl" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Product" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."RoleDefinition" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "systemRole" boolean DEFAULT false NOT NULL,
    "status" "public"."UserStatus" DEFAULT 'ACTIVE'::"public"."UserStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."RoleDefinition" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."RolePermission" (
    "roleId" "text" NOT NULL,
    "permissionId" "text" NOT NULL
);


ALTER TABLE "public"."RolePermission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Tenant" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "gstNumber" "text",
    "logoUrl" "text",
    "status" "public"."TenantStatus" DEFAULT 'PENDING'::"public"."TenantStatus" NOT NULL,
    "address" "text",
    "phone" "text",
    "email" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Tenant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text",
    "supabaseUserId" "text",
    "role" "public"."Role" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "mobile" "text",
    "status" "public"."UserStatus" DEFAULT 'ACTIVE'::"public"."UserStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "avatarUrl" "text"
);


ALTER TABLE "public"."User" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VerificationChecklist" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."VerificationChecklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VerificationItem" (
    "id" "text" NOT NULL,
    "checklistId" "text" NOT NULL,
    "text" "text" NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sortOrder" integer NOT NULL
);


ALTER TABLE "public"."VerificationItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VerificationResponse" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "orderId" "text" NOT NULL,
    "clientId" "text" NOT NULL,
    "userId" "text",
    "status" "public"."VerificationStatus" NOT NULL,
    "responses" "jsonb" NOT NULL,
    "comments" "text",
    "attachments" "jsonb",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."VerificationResponse" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Warehouse" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "address" "text" NOT NULL,
    "status" "public"."TenantStatus" DEFAULT 'ACTIVE'::"public"."TenantStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Warehouse" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."WarehouseLocation" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "warehouseId" "text" NOT NULL,
    "zone" "text" NOT NULL,
    "rack" "text",
    "shelf" "text",
    "bin" "text",
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."WarehouseLocation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."WarehouseSetting" (
    "id" "text" NOT NULL,
    "tenantId" "text" NOT NULL,
    "orderPrefix" "text" DEFAULT 'ORD'::"text" NOT NULL,
    "invoicePrefix" "text" DEFAULT ''::"text" NOT NULL,
    "gstSettings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notificationPreferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "nextInvoiceNumber" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."WarehouseSetting" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."_prisma_migrations" OWNER TO "postgres";


ALTER TABLE ONLY "public"."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ClientEmployee"
    ADD CONSTRAINT "ClientEmployee_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ClientEmployee"
    ADD CONSTRAINT "ClientEmployee_tenantId_mobile_key" UNIQUE ("tenantId", "mobile");



ALTER TABLE ONLY "public"."ClientEmployee"
    ADD CONSTRAINT "ClientEmployee_userId_key" UNIQUE ("userId");



ALTER TABLE ONLY "public"."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Client"
    ADD CONSTRAINT "Client_tenantId_companyName_key" UNIQUE ("tenantId", "companyName");



ALTER TABLE ONLY "public"."CompanyGroup"
    ADD CONSTRAINT "CompanyGroup_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."DeliveryVerificationItem"
    ADD CONSTRAINT "DeliveryVerificationItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."DeliveryVerification"
    ADD CONSTRAINT "DeliveryVerification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EWayBill"
    ADD CONSTRAINT "EWayBill_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EmailLog"
    ADD CONSTRAINT "EmailLog_idempotencyKey_key" UNIQUE ("idempotencyKey");



ALTER TABLE ONLY "public"."EmailLog"
    ADD CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ImportedInvoiceItem"
    ADD CONSTRAINT "ImportedInvoiceItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ImportedInvoice"
    ADD CONSTRAINT "ImportedInvoice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory"
    ADD CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InvoiceItem"
    ADD CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."NotificationSettings"
    ADD CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."OrderStatusHistory"
    ADD CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Permission"
    ADD CONSTRAINT "Permission_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."Permission"
    ADD CONSTRAINT "Permission_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PlatformSetting"
    ADD CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."RoleDefinition"
    ADD CONSTRAINT "RoleDefinition_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."RolePermission"
    ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId");



ALTER TABLE ONLY "public"."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VerificationChecklist"
    ADD CONSTRAINT "VerificationChecklist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VerificationItem"
    ADD CONSTRAINT "VerificationItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VerificationResponse"
    ADD CONSTRAINT "VerificationResponse_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."WarehouseLocation"
    ADD CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."WarehouseSetting"
    ADD CONSTRAINT "WarehouseSetting_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Warehouse"
    ADD CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."NotificationSettings"
    ADD CONSTRAINT "notification_settings_tenant_id_unique" UNIQUE ("tenantId");



CREATE INDEX "AuditLog_entity_entityId_idx" ON "public"."AuditLog" USING "btree" ("entity", "entityId");



CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "public"."AuditLog" USING "btree" ("tenantId", "createdAt");



CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "public"."Category" USING "btree" ("tenantId", "name");



CREATE INDEX "ClientEmployee_clientId_idx" ON "public"."ClientEmployee" USING "btree" ("clientId");



CREATE INDEX "ClientEmployee_roleId_idx" ON "public"."ClientEmployee" USING "btree" ("roleId");



CREATE INDEX "ClientEmployee_tenantId_idx" ON "public"."ClientEmployee" USING "btree" ("tenantId");



CREATE INDEX "ClientEmployee_userId_idx" ON "public"."ClientEmployee" USING "btree" ("userId");



CREATE INDEX "Client_companyGroupId_idx" ON "public"."Client" USING "btree" ("companyGroupId");



CREATE INDEX "Client_tenantId_idx" ON "public"."Client" USING "btree" ("tenantId");



CREATE INDEX "CompanyGroup_tenantId_idx" ON "public"."CompanyGroup" USING "btree" ("tenantId");



CREATE UNIQUE INDEX "CompanyGroup_tenantId_name_key" ON "public"."CompanyGroup" USING "btree" ("tenantId", "name");



CREATE UNIQUE INDEX "DeliveryVerification_importedInvoiceId_key" ON "public"."DeliveryVerification" USING "btree" ("importedInvoiceId");



CREATE INDEX "DeliveryVerification_tenantId_status_createdAt_idx" ON "public"."DeliveryVerification" USING "btree" ("tenantId", "status", "createdAt");



CREATE INDEX "Document_tenantId_type_idx" ON "public"."Document" USING "btree" ("tenantId", "type");



CREATE UNIQUE INDEX "EWayBill_importedInvoiceId_key" ON "public"."EWayBill" USING "btree" ("importedInvoiceId");



CREATE INDEX "EWayBill_tenantId_status_createdAt_idx" ON "public"."EWayBill" USING "btree" ("tenantId", "status", "createdAt");



CREATE UNIQUE INDEX "ImportedInvoice_originalDocumentId_key" ON "public"."ImportedInvoice" USING "btree" ("originalDocumentId");



CREATE UNIQUE INDEX "ImportedInvoice_tenantId_importNumber_key" ON "public"."ImportedInvoice" USING "btree" ("tenantId", "importNumber");



CREATE INDEX "ImportedInvoice_tenantId_status_createdAt_idx" ON "public"."ImportedInvoice" USING "btree" ("tenantId", "status", "createdAt");



CREATE INDEX "InventoryMovement_tenantId_createdAt_idx" ON "public"."InventoryMovement" USING "btree" ("tenantId", "createdAt");



CREATE INDEX "Inventory_tenantId_productId_idx" ON "public"."Inventory" USING "btree" ("tenantId", "productId");



CREATE UNIQUE INDEX "Inventory_tenantId_warehouseId_locationId_productId_key" ON "public"."Inventory" USING "btree" ("tenantId", "warehouseId", "locationId", "productId");



CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumber_key" ON "public"."Invoice" USING "btree" ("tenantId", "invoiceNumber");



CREATE INDEX "Invoice_tenantId_status_paymentStatus_idx" ON "public"."Invoice" USING "btree" ("tenantId", "status", "paymentStatus");



CREATE INDEX "Notification_tenantId_createdAt_idx" ON "public"."Notification" USING "btree" ("tenantId", "createdAt");



CREATE INDEX "Notification_tenantId_userId_read_idx" ON "public"."Notification" USING "btree" ("tenantId", "userId", "read");



CREATE INDEX "Notification_tenantId_warehouseId_read_idx" ON "public"."Notification" USING "btree" ("tenantId", "warehouseId", "read");



CREATE INDEX "OrderStatusHistory_tenantId_orderId_createdAt_idx" ON "public"."OrderStatusHistory" USING "btree" ("tenantId", "orderId", "createdAt");



CREATE INDEX "Order_clientId_idx" ON "public"."Order" USING "btree" ("clientId");



CREATE INDEX "Order_deliveryVerifiedAt_idx" ON "public"."Order" USING "btree" ("deliveryVerifiedAt");



CREATE INDEX "Order_storeVerifiedAt_idx" ON "public"."Order" USING "btree" ("storeVerifiedAt");



CREATE UNIQUE INDEX "Order_tenantId_orderNumber_key" ON "public"."Order" USING "btree" ("tenantId", "orderNumber");



CREATE INDEX "Order_tenantId_status_idx" ON "public"."Order" USING "btree" ("tenantId", "status");



CREATE INDEX "Payment_tenantId_status_idx" ON "public"."Payment" USING "btree" ("tenantId", "status");



CREATE INDEX "Permission_category_idx" ON "public"."Permission" USING "btree" ("category");



CREATE UNIQUE INDEX "PlatformSetting_tenantId_key" ON "public"."PlatformSetting" USING "btree" ("tenantId");



CREATE INDEX "Product_tenantId_name_idx" ON "public"."Product" USING "btree" ("tenantId", "name");



CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "public"."Product" USING "btree" ("tenantId", "sku");



CREATE INDEX "RolePermission_permissionId_idx" ON "public"."RolePermission" USING "btree" ("permissionId");



CREATE INDEX "RolePermission_roleId_idx" ON "public"."RolePermission" USING "btree" ("roleId");



CREATE INDEX "Role_name_idx" ON "public"."RoleDefinition" USING "btree" ("name");



CREATE INDEX "Role_tenantId_idx" ON "public"."RoleDefinition" USING "btree" ("tenantId");



CREATE UNIQUE INDEX "Role_tenantId_name_unique_idx" ON "public"."RoleDefinition" USING "btree" (COALESCE("tenantId", '__SYSTEM__'::"text"), "name");



CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant" USING "btree" ("slug");



CREATE UNIQUE INDEX "User_email_key" ON "public"."User" USING "btree" ("email");



CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "public"."User" USING "btree" ("supabaseUserId");



CREATE INDEX "User_tenantId_role_idx" ON "public"."User" USING "btree" ("tenantId", "role");



CREATE UNIQUE INDEX "VerificationResponse_orderId_key" ON "public"."VerificationResponse" USING "btree" ("orderId");



CREATE INDEX "WarehouseLocation_tenantId_warehouseId_idx" ON "public"."WarehouseLocation" USING "btree" ("tenantId", "warehouseId");



CREATE UNIQUE INDEX "WarehouseSetting_tenantId_key" ON "public"."WarehouseSetting" USING "btree" ("tenantId");



CREATE UNIQUE INDEX "Warehouse_tenantId_code_key" ON "public"."Warehouse" USING "btree" ("tenantId", "code");



CREATE INDEX "Warehouse_tenantId_idx" ON "public"."Warehouse" USING "btree" ("tenantId");



CREATE INDEX "idx_email_log_created_at" ON "public"."EmailLog" USING "btree" ("createdAt" DESC);



CREATE INDEX "idx_email_log_idempotency" ON "public"."EmailLog" USING "btree" ("idempotencyKey");



CREATE INDEX "idx_email_log_recipient" ON "public"."EmailLog" USING "btree" ("recipientEmail");



CREATE INDEX "idx_email_log_tenant" ON "public"."EmailLog" USING "btree" ("tenantId");



CREATE INDEX "idx_notification_settings_tenant" ON "public"."NotificationSettings" USING "btree" ("tenantId");



CREATE OR REPLACE TRIGGER "create_notification_settings_on_tenant_create" AFTER INSERT ON "public"."Tenant" FOR EACH ROW EXECUTE FUNCTION "public"."create_notification_settings_for_new_tenant"();



CREATE OR REPLACE TRIGGER "trg_inventory_timestamps" BEFORE INSERT OR UPDATE ON "public"."Inventory" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_inventory_timestamps"();



CREATE OR REPLACE TRIGGER "trg_protect_notification_fields" BEFORE UPDATE ON "public"."Notification" FOR EACH ROW EXECUTE FUNCTION "public"."protect_notification_fields"();



CREATE OR REPLACE TRIGGER "trg_protect_user_fields" BEFORE UPDATE ON "public"."User" FOR EACH ROW EXECUTE FUNCTION "public"."protect_user_fields"();



ALTER TABLE ONLY "public"."AuditLog"
    ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ClientEmployee"
    ADD CONSTRAINT "ClientEmployee_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ClientEmployee"
    ADD CONSTRAINT "ClientEmployee_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."RoleDefinition"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ClientEmployee"
    ADD CONSTRAINT "ClientEmployee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ClientEmployee"
    ADD CONSTRAINT "ClientEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Client"
    ADD CONSTRAINT "Client_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "public"."CompanyGroup"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Client"
    ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."CompanyGroup"
    ADD CONSTRAINT "CompanyGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."DeliveryVerificationItem"
    ADD CONSTRAINT "DeliveryVerificationItem_importedInvoiceItemId_fkey" FOREIGN KEY ("importedInvoiceItemId") REFERENCES "public"."ImportedInvoiceItem"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."DeliveryVerificationItem"
    ADD CONSTRAINT "DeliveryVerificationItem_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "public"."DeliveryVerification"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."DeliveryVerification"
    ADD CONSTRAINT "DeliveryVerification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."DeliveryVerification"
    ADD CONSTRAINT "DeliveryVerification_importedInvoiceId_fkey" FOREIGN KEY ("importedInvoiceId") REFERENCES "public"."ImportedInvoice"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."DeliveryVerification"
    ADD CONSTRAINT "DeliveryVerification_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."DeliveryVerification"
    ADD CONSTRAINT "DeliveryVerification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."DeliveryVerification"
    ADD CONSTRAINT "DeliveryVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Document"
    ADD CONSTRAINT "Document_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Document"
    ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EWayBill"
    ADD CONSTRAINT "EWayBill_importedInvoiceId_fkey" FOREIGN KEY ("importedInvoiceId") REFERENCES "public"."ImportedInvoice"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."EWayBill"
    ADD CONSTRAINT "EWayBill_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."EWayBill"
    ADD CONSTRAINT "EWayBill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EmailLog"
    ADD CONSTRAINT "EmailLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "public"."Notification"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."EmailLog"
    ADD CONSTRAINT "EmailLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."EmailLog"
    ADD CONSTRAINT "EmailLog_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."EmailLog"
    ADD CONSTRAINT "EmailLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ImportedInvoiceItem"
    ADD CONSTRAINT "ImportedInvoiceItem_importedInvoiceId_fkey" FOREIGN KEY ("importedInvoiceId") REFERENCES "public"."ImportedInvoice"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ImportedInvoice"
    ADD CONSTRAINT "ImportedInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ImportedInvoice"
    ADD CONSTRAINT "ImportedInvoice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ImportedInvoice"
    ADD CONSTRAINT "ImportedInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ImportedInvoice"
    ADD CONSTRAINT "ImportedInvoice_originalDocumentId_fkey" FOREIGN KEY ("originalDocumentId") REFERENCES "public"."Document"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ImportedInvoice"
    ADD CONSTRAINT "ImportedInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ImportedInvoice"
    ADD CONSTRAINT "ImportedInvoice_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "public"."Inventory"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."InventoryMovement"
    ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Inventory"
    ADD CONSTRAINT "Inventory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."WarehouseLocation"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Inventory"
    ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Inventory"
    ADD CONSTRAINT "Inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."Warehouse"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvoiceItem"
    ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvoiceItem"
    ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Invoice"
    ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Invoice"
    ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Invoice"
    ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."NotificationSettings"
    ADD CONSTRAINT "NotificationSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Notification"
    ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Notification"
    ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."OrderStatusHistory"
    ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_deliveryVerifiedById_fkey" FOREIGN KEY ("deliveryVerifiedById") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_storeVerifiedById_fkey" FOREIGN KEY ("storeVerifiedById") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Payment"
    ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlatformSetting"
    ADD CONSTRAINT "PlatformSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Product"
    ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."RoleDefinition"
    ADD CONSTRAINT "RoleDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."RolePermission"
    ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."Permission"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."RolePermission"
    ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."RoleDefinition"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VerificationItem"
    ADD CONSTRAINT "VerificationItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "public"."VerificationChecklist"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VerificationResponse"
    ADD CONSTRAINT "VerificationResponse_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."WarehouseLocation"
    ADD CONSTRAINT "WarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."Warehouse"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."WarehouseSetting"
    ADD CONSTRAINT "WarehouseSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Warehouse"
    ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Allow read on Invoice" ON "public"."Invoice" FOR SELECT TO "authenticated" USING ("public"."can_read_invoice"("tenantId", "clientId"));



CREATE POLICY "Allow read on Payment" ON "public"."Payment" FOR SELECT TO "authenticated" USING ("public"."can_read_payment"("tenantId", "invoiceId"));



ALTER TABLE "public"."AuditLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Category" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Client" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ClientEmployee" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."CompanyGroup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."DeliveryVerification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."DeliveryVerificationItem" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Deny direct delete on Invoice" ON "public"."Invoice" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "Deny direct delete on Payment" ON "public"."Payment" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "Deny direct insert on Invoice" ON "public"."Invoice" AS RESTRICTIVE FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "Deny direct insert on Payment" ON "public"."Payment" AS RESTRICTIVE FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "Deny direct update on Invoice" ON "public"."Invoice" AS RESTRICTIVE FOR UPDATE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "Deny direct update on Payment" ON "public"."Payment" AS RESTRICTIVE FOR UPDATE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "Deny public on prisma_migrations" ON "public"."_prisma_migrations" TO "service_role" USING (true);



ALTER TABLE "public"."Document" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EWayBill" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EmailLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ImportedInvoice" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ImportedInvoiceItem" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InventoryMovement" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Invoice" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InvoiceItem" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Notification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."NotificationSettings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Order" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."OrderItem" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."OrderStatusHistory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Payment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Permission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PlatformSetting" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Product" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."RoleDefinition" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."RolePermission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Tenant" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VerificationChecklist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VerificationItem" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VerificationResponse" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Warehouse" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."WarehouseLocation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."WarehouseSetting" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_insert_policy" ON "public"."AuditLog" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "audit_log_select_policy" ON "public"."AuditLog" FOR SELECT TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'ACCOUNTANT'::"text"])));



CREATE POLICY "category_select_policy" ON "public"."Category" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "category_staff_mutation_policy" ON "public"."Category" TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"]))) WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"])));



CREATE POLICY "client_employee_select_policy" ON "public"."ClientEmployee" FOR SELECT TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND ("public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text", 'ACCOUNTANT'::"text", 'ACCOUNTS_TEAM'::"text"]) OR "public"."can_access_client"("clientId"))));



CREATE POLICY "client_employee_staff_mutation_policy" ON "public"."ClientEmployee" TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'ACCOUNTANT'::"text"]))) WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'ACCOUNTANT'::"text"])));



CREATE POLICY "client_select_policy" ON "public"."Client" FOR SELECT TO "authenticated" USING ("public"."can_access_client"("id"));



CREATE POLICY "client_staff_mutation_policy" ON "public"."Client" TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'ACCOUNTANT'::"text", 'ACCOUNTS_TEAM'::"text"]))) WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'ACCOUNTANT'::"text", 'ACCOUNTS_TEAM'::"text"])));



CREATE POLICY "company_group_select_policy" ON "public"."CompanyGroup" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "company_group_staff_mutation_policy" ON "public"."CompanyGroup" TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text"]))) WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text"])));



CREATE POLICY "delivery_verification_item_select_policy" ON "public"."DeliveryVerificationItem" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."DeliveryVerification" "dv"
  WHERE (("dv"."id" = "DeliveryVerificationItem"."verificationId") AND "public"."can_access_tenant"("dv"."tenantId")))));



CREATE POLICY "delivery_verification_select_policy" ON "public"."DeliveryVerification" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "deny_anon_notification_settings" ON "public"."NotificationSettings" AS RESTRICTIVE TO "anon" USING (false);



CREATE POLICY "deny_direct_delete_audit_log" ON "public"."AuditLog" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "deny_direct_delete_email_log" ON "public"."EmailLog" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "deny_direct_delete_inventory_movement" ON "public"."InventoryMovement" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "deny_direct_delete_invoice_item" ON "public"."InvoiceItem" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "deny_direct_delete_notification" ON "public"."Notification" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "deny_direct_delete_order" ON "public"."Order" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "deny_direct_delete_order_item" ON "public"."OrderItem" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "deny_direct_delete_order_status_history" ON "public"."OrderStatusHistory" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "deny_direct_delete_verification_response" ON "public"."VerificationResponse" AS RESTRICTIVE FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "deny_direct_insert_email_log" ON "public"."EmailLog" AS RESTRICTIVE FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "deny_direct_insert_invoice_item" ON "public"."InvoiceItem" AS RESTRICTIVE FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "deny_direct_insert_notification" ON "public"."Notification" AS RESTRICTIVE FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "deny_direct_insert_order" ON "public"."Order" AS RESTRICTIVE FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "deny_direct_insert_order_item" ON "public"."OrderItem" AS RESTRICTIVE FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "deny_direct_update_audit_log" ON "public"."AuditLog" AS RESTRICTIVE FOR UPDATE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "deny_direct_update_email_log" ON "public"."EmailLog" AS RESTRICTIVE FOR UPDATE TO "authenticated", "anon" USING (false);



CREATE POLICY "deny_direct_update_inventory_movement" ON "public"."InventoryMovement" AS RESTRICTIVE FOR UPDATE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "deny_direct_update_invoice_item" ON "public"."InvoiceItem" AS RESTRICTIVE FOR UPDATE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "deny_direct_update_order" ON "public"."Order" AS RESTRICTIVE FOR UPDATE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "deny_direct_update_order_item" ON "public"."OrderItem" AS RESTRICTIVE FOR UPDATE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "deny_direct_update_order_status_history" ON "public"."OrderStatusHistory" AS RESTRICTIVE FOR UPDATE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "deny_direct_update_verified_response" ON "public"."VerificationResponse" AS RESTRICTIVE FOR UPDATE TO "authenticated", "anon" USING (("status" <> 'VERIFIED'::"public"."VerificationStatus")) WITH CHECK (("status" <> 'VERIFIED'::"public"."VerificationStatus"));



CREATE POLICY "document_select_policy" ON "public"."Document" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "email_log_select_policy" ON "public"."EmailLog" FOR SELECT TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'ACCOUNTANT'::"text"])));



CREATE POLICY "eway_bill_select_policy" ON "public"."EWayBill" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "imported_invoice_item_select_policy" ON "public"."ImportedInvoiceItem" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ImportedInvoice" "ii"
  WHERE (("ii"."id" = "ImportedInvoiceItem"."importedInvoiceId") AND "public"."can_access_tenant"("ii"."tenantId")))));



CREATE POLICY "imported_invoice_select_policy" ON "public"."ImportedInvoice" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "inventory_movement_insert_policy" ON "public"."InventoryMovement" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"])));



CREATE POLICY "inventory_movement_select_policy" ON "public"."InventoryMovement" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "inventory_select_policy" ON "public"."Inventory" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "inventory_staff_mutation_policy" ON "public"."Inventory" TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"]))) WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"])));



CREATE POLICY "invoice_item_select_policy" ON "public"."InvoiceItem" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."Invoice" "i"
  WHERE (("i"."id" = "InvoiceItem"."invoiceId") AND "public"."can_read_invoice"("i"."tenantId", "i"."clientId")))));



CREATE POLICY "notification_select_policy" ON "public"."Notification" FOR SELECT TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND ("public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text", 'ACCOUNTANT'::"text", 'ACCOUNTS_TEAM'::"text"]) OR ("userId" = ( SELECT "get_current_actor"."actor_id"
   FROM "public"."get_current_actor"() "get_current_actor"("actor_id", "tenant_id", "role", "status"))) OR (EXISTS ( SELECT 1
   FROM "public"."Order" "o"
  WHERE (("o"."id" = "Notification"."orderId") AND "public"."can_access_client"("o"."clientId")))))));



CREATE POLICY "notification_settings_insert_policy" ON "public"."NotificationSettings" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text"])));



CREATE POLICY "notification_settings_select_policy" ON "public"."NotificationSettings" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "notification_settings_update_policy" ON "public"."NotificationSettings" FOR UPDATE TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text"]))) WITH CHECK ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "notification_update_read_policy" ON "public"."Notification" FOR UPDATE TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND (("userId" = ( SELECT "get_current_actor"."actor_id"
   FROM "public"."get_current_actor"() "get_current_actor"("actor_id", "tenant_id", "role", "status"))) OR "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"])))) WITH CHECK (("read" = true));



CREATE POLICY "order_item_select_policy" ON "public"."OrderItem" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."Order" "o"
  WHERE (("o"."id" = "OrderItem"."orderId") AND "public"."can_access_tenant"("o"."tenantId") AND ("public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text", 'ACCOUNTANT'::"text", 'ACCOUNTS_TEAM'::"text"]) OR "public"."can_access_client"("o"."clientId"))))));



CREATE POLICY "order_select_policy" ON "public"."Order" FOR SELECT TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND ("public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text", 'ACCOUNTANT'::"text", 'ACCOUNTS_TEAM'::"text"]) OR "public"."can_access_client"("clientId"))));



CREATE POLICY "order_status_history_select_policy" ON "public"."OrderStatusHistory" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."Order" "o"
  WHERE (("o"."id" = "OrderStatusHistory"."orderId") AND "public"."can_access_tenant"("o"."tenantId") AND ("public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text", 'ACCOUNTANT'::"text", 'ACCOUNTS_TEAM'::"text"]) OR "public"."can_access_client"("o"."clientId"))))));



CREATE POLICY "permission_select_policy" ON "public"."Permission" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "platform_setting_admin_mutation_policy" ON "public"."PlatformSetting" TO "authenticated" USING ("public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text"]));



CREATE POLICY "platform_setting_select_policy" ON "public"."PlatformSetting" FOR SELECT TO "authenticated" USING ("public"."is_active_user"());



CREATE POLICY "product_select_policy" ON "public"."Product" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "product_staff_mutation_policy" ON "public"."Product" TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"]))) WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"])));



CREATE POLICY "role_permission_select_policy" ON "public"."RolePermission" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."RoleDefinition" "r"
  WHERE (("r"."id" = "RolePermission"."roleId") AND (("r"."tenantId" IS NULL) OR "public"."can_access_tenant"("r"."tenantId"))))));



CREATE POLICY "role_select_policy" ON "public"."RoleDefinition" FOR SELECT TO "authenticated" USING ((("tenantId" IS NULL) OR "public"."can_access_tenant"("tenantId")));



CREATE POLICY "tenant_admin_mutation_policy" ON "public"."Tenant" TO "authenticated" USING ("public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text"]));



CREATE POLICY "tenant_select_policy" ON "public"."Tenant" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("id"));



CREATE POLICY "user_auth_callback_link_policy" ON "public"."User" FOR UPDATE TO "authenticated" USING ((("email" = ("auth"."jwt"() ->> 'email'::"text")) AND ("supabaseUserId" IS NULL))) WITH CHECK (("supabaseUserId" = ("auth"."uid"())::"text"));



CREATE POLICY "user_select_policy" ON "public"."User" FOR SELECT TO "authenticated" USING ((("supabaseUserId" = ("auth"."uid"())::"text") OR "public"."can_access_tenant"("tenantId")));



CREATE POLICY "verification_checklist_select_policy" ON "public"."VerificationChecklist" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "verification_item_select_policy" ON "public"."VerificationItem" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."VerificationChecklist" "vc"
  WHERE (("vc"."id" = "VerificationItem"."checklistId") AND "public"."can_access_tenant"("vc"."tenantId")))));



CREATE POLICY "verification_response_select_policy" ON "public"."VerificationResponse" FOR SELECT TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND ("public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"]) OR "public"."can_access_client"("clientId"))));



CREATE POLICY "warehouse_location_select_policy" ON "public"."WarehouseLocation" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "warehouse_location_staff_mutation_policy" ON "public"."WarehouseLocation" TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"]))) WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text", 'WAREHOUSE_STAFF'::"text"])));



CREATE POLICY "warehouse_select_policy" ON "public"."Warehouse" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "warehouse_setting_select_policy" ON "public"."WarehouseSetting" FOR SELECT TO "authenticated" USING ("public"."can_access_tenant"("tenantId"));



CREATE POLICY "warehouse_setting_staff_mutation_policy" ON "public"."WarehouseSetting" TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text"]))) WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text"])));



CREATE POLICY "warehouse_staff_mutation_policy" ON "public"."Warehouse" TO "authenticated" USING (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text"]))) WITH CHECK (("public"."can_access_tenant"("tenantId") AND "public"."has_role"(ARRAY['PLATFORM_ADMIN'::"text", 'WAREHOUSE_OWNER'::"text", 'WAREHOUSE_MODERATOR'::"text"])));



REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_access_client"("p_target_client_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_access_client"("p_target_client_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_client"("p_target_client_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_access_tenant"("p_target_tenant_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_access_tenant"("p_target_tenant_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_tenant"("p_target_tenant_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_delete_payment_proof_storage"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_delete_payment_proof_storage"("p_object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_read_invoice"("p_invoice_tenant_id" "text", "p_invoice_client_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_read_invoice"("p_invoice_tenant_id" "text", "p_invoice_client_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_read_invoice_storage"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_read_invoice_storage"("p_object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_read_payment"("p_payment_tenant_id" "text", "p_payment_invoice_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_read_payment"("p_payment_tenant_id" "text", "p_payment_invoice_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_read_payment_proof_storage"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_read_payment_proof_storage"("p_object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_upload_payment_proof_storage"("p_object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_upload_payment_proof_storage"("p_object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."check_actor_permission"("p_permission_key" "text", "p_target_client_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_actor_permission"("p_permission_key" "text", "p_target_client_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_actor_permission"("p_permission_key" "text", "p_target_client_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_settings_for_new_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_settings_for_new_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_settings_for_new_tenant"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_current_actor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_current_actor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_actor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_permission"("p_permission_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_permission"("p_permission_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("p_permission_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("p_allowed_roles" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("p_allowed_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("p_allowed_roles" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_active_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_active_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_notification_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_notification_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_notification_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_user_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_user_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_user_fields"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_current_actor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_current_actor"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_admin_create_role"("p_name" "text", "p_description" "text", "p_tenant_id" "text", "p_permission_keys" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_admin_create_role"("p_name" "text", "p_description" "text", "p_tenant_id" "text", "p_permission_keys" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_admin_create_role"("p_name" "text", "p_description" "text", "p_tenant_id" "text", "p_permission_keys" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_admin_delete_role"("p_role_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_admin_delete_role"("p_role_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_admin_delete_role"("p_role_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_admin_list_roles"("p_tenant_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_admin_list_roles"("p_tenant_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_admin_list_roles"("p_tenant_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_admin_update_role"("p_role_id" "text", "p_name" "text", "p_description" "text", "p_status" "public"."UserStatus", "p_permission_keys" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_admin_update_role"("p_role_id" "text", "p_name" "text", "p_description" "text", "p_status" "public"."UserStatus", "p_permission_keys" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_admin_update_role"("p_role_id" "text", "p_name" "text", "p_description" "text", "p_status" "public"."UserStatus", "p_permission_keys" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_admin_update_user_role"("p_target_user_id" "text", "p_new_role" "public"."Role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_admin_update_user_role"("p_target_user_id" "text", "p_new_role" "public"."Role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_admin_update_user_role"("p_target_user_id" "text", "p_new_role" "public"."Role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_assign_client_company_group"("p_client_id" "text", "p_company_group_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_assign_client_company_group"("p_client_id" "text", "p_company_group_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_assign_client_company_group"("p_client_id" "text", "p_company_group_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_attach_payment_proof"("p_payment_id" "text", "p_invoice_id" "text", "p_proof_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_attach_payment_proof"("p_payment_id" "text", "p_invoice_id" "text", "p_proof_url" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_cancel_payment_record"("p_payment_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_cancel_payment_record"("p_payment_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_create_notification"("p_tenant_id" "text", "p_order_id" "text", "p_user_id" "text", "p_type" "text", "p_title" "text", "p_message" "text", "p_action_url" "text", "p_priority" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_create_notification"("p_tenant_id" "text", "p_order_id" "text", "p_user_id" "text", "p_type" "text", "p_title" "text", "p_message" "text", "p_action_url" "text", "p_priority" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_create_notification"("p_tenant_id" "text", "p_order_id" "text", "p_user_id" "text", "p_type" "text", "p_title" "text", "p_message" "text", "p_action_url" "text", "p_priority" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_create_order_with_invoice"("p_tenant_id" "text", "p_client_id" "text", "p_created_by_id" "text", "p_selected_contact_ids" "text"[], "p_assigned_staff_id" "text", "p_expected_delivery" timestamp with time zone, "p_notes" "text", "p_status" "public"."OrderStatus", "p_eway_bill" "jsonb", "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_create_order_with_invoice"("p_tenant_id" "text", "p_client_id" "text", "p_created_by_id" "text", "p_selected_contact_ids" "text"[], "p_assigned_staff_id" "text", "p_expected_delivery" timestamp with time zone, "p_notes" "text", "p_status" "public"."OrderStatus", "p_eway_bill" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_create_order_with_invoice"("p_tenant_id" "text", "p_client_id" "text", "p_created_by_id" "text", "p_selected_contact_ids" "text"[], "p_assigned_staff_id" "text", "p_expected_delivery" timestamp with time zone, "p_notes" "text", "p_status" "public"."OrderStatus", "p_eway_bill" "jsonb", "p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_generate_invoice"("p_order_id" "text", "p_is_final" boolean, "p_user_id" "text", "p_user_role" "public"."Role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_generate_invoice"("p_order_id" "text", "p_is_final" boolean, "p_user_id" "text", "p_user_role" "public"."Role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_generate_invoice"("p_order_id" "text", "p_is_final" boolean, "p_user_id" "text", "p_user_role" "public"."Role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_get_my_permissions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_get_my_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_get_my_permissions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_init_inventory_item"("p_product_id" "text", "p_warehouse_id" "text", "p_location_id" "text", "p_initial_quantity" integer, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_init_inventory_item"("p_product_id" "text", "p_warehouse_id" "text", "p_location_id" "text", "p_initial_quantity" integer, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_init_inventory_item"("p_product_id" "text", "p_warehouse_id" "text", "p_location_id" "text", "p_initial_quantity" integer, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_link_auth_user_by_email"("p_auth_user_id" "text", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_link_auth_user_by_email"("p_auth_user_id" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_link_auth_user_by_email"("p_auth_user_id" "text", "p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_log_email_delivery"("p_tenant_id" "text", "p_event_type" "public"."NotificationType", "p_recipient_email" "text", "p_subject" "text", "p_status" "text", "p_idempotency_key" "text", "p_notification_id" "text", "p_order_id" "text", "p_recipient_user_id" "text", "p_resend_id" "text", "p_reason" "text", "p_error" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_log_email_delivery"("p_tenant_id" "text", "p_event_type" "public"."NotificationType", "p_recipient_email" "text", "p_subject" "text", "p_status" "text", "p_idempotency_key" "text", "p_notification_id" "text", "p_order_id" "text", "p_recipient_user_id" "text", "p_resend_id" "text", "p_reason" "text", "p_error" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_log_email_delivery"("p_tenant_id" "text", "p_event_type" "public"."NotificationType", "p_recipient_email" "text", "p_subject" "text", "p_status" "text", "p_idempotency_key" "text", "p_notification_id" "text", "p_order_id" "text", "p_recipient_user_id" "text", "p_resend_id" "text", "p_reason" "text", "p_error" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_mark_notification_read"("p_notification_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_mark_notification_read"("p_notification_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_mark_notification_read"("p_notification_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_receive_or_adjust_stock"("p_inventory_id" "text", "p_quantity" integer, "p_type" "public"."InventoryMovementType", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_receive_or_adjust_stock"("p_inventory_id" "text", "p_quantity" integer, "p_type" "public"."InventoryMovementType", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_receive_or_adjust_stock"("p_inventory_id" "text", "p_quantity" integer, "p_type" "public"."InventoryMovementType", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_record_payment_secure"("p_invoice_id" "text", "p_amount" numeric, "p_method" "text", "p_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_record_payment_secure"("p_invoice_id" "text", "p_amount" numeric, "p_method" "text", "p_reference" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_submit_store_verification"("p_order_id" "text", "p_items" "jsonb", "p_comments" "text", "p_inventory_updated" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_submit_store_verification"("p_order_id" "text", "p_items" "jsonb", "p_comments" "text", "p_inventory_updated" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_submit_store_verification"("p_order_id" "text", "p_items" "jsonb", "p_comments" "text", "p_inventory_updated" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_submit_verification"("p_order_id" "text", "p_status" "public"."VerificationStatus", "p_responses" "jsonb", "p_comments" "text", "p_attachments" "jsonb", "p_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_submit_verification"("p_order_id" "text", "p_status" "public"."VerificationStatus", "p_responses" "jsonb", "p_comments" "text", "p_attachments" "jsonb", "p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_submit_verification"("p_order_id" "text", "p_status" "public"."VerificationStatus", "p_responses" "jsonb", "p_comments" "text", "p_attachments" "jsonb", "p_user_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_transition_order"("p_order_id" "text", "p_next_status" "public"."OrderStatus", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_transition_order"("p_order_id" "text", "p_next_status" "public"."OrderStatus", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_transition_order"("p_order_id" "text", "p_next_status" "public"."OrderStatus", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_update_client_employee"("p_client_employee_id" "text", "p_contact_person" "text", "p_mobile" "text", "p_email" "text", "p_new_client_id" "text", "p_new_employee_role" "public"."ClientEmployeeRole", "p_new_status" "public"."UserStatus") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_update_client_employee"("p_client_employee_id" "text", "p_contact_person" "text", "p_mobile" "text", "p_email" "text", "p_new_client_id" "text", "p_new_employee_role" "public"."ClientEmployeeRole", "p_new_status" "public"."UserStatus") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_update_client_employee"("p_client_employee_id" "text", "p_contact_person" "text", "p_mobile" "text", "p_email" "text", "p_new_client_id" "text", "p_new_employee_role" "public"."ClientEmployeeRole", "p_new_status" "public"."UserStatus") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_update_employee"("p_actor_id" "text", "p_actor_role" "public"."Role", "p_target_id" "text", "p_name" "text", "p_email" "text", "p_mobile" "text", "p_new_role" "public"."Role", "p_new_status" "public"."UserStatus") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_update_employee"("p_actor_id" "text", "p_actor_role" "public"."Role", "p_target_id" "text", "p_name" "text", "p_email" "text", "p_mobile" "text", "p_new_role" "public"."Role", "p_new_status" "public"."UserStatus") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_update_employee"("p_actor_id" "text", "p_actor_role" "public"."Role", "p_target_id" "text", "p_name" "text", "p_email" "text", "p_mobile" "text", "p_new_role" "public"."Role", "p_new_status" "public"."UserStatus") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_update_notification_settings"("p_tenant_id" "text", "p_enabled" boolean, "p_event_config" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_update_notification_settings"("p_tenant_id" "text", "p_enabled" boolean, "p_event_config" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_update_notification_settings"("p_tenant_id" "text", "p_enabled" boolean, "p_event_config" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_inventory_timestamps"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_inventory_timestamps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_inventory_timestamps"() TO "service_role";



GRANT ALL ON TABLE "public"."AuditLog" TO "anon";
GRANT ALL ON TABLE "public"."AuditLog" TO "authenticated";
GRANT ALL ON TABLE "public"."AuditLog" TO "service_role";



GRANT ALL ON TABLE "public"."Category" TO "anon";
GRANT ALL ON TABLE "public"."Category" TO "authenticated";
GRANT ALL ON TABLE "public"."Category" TO "service_role";



GRANT ALL ON TABLE "public"."Client" TO "anon";
GRANT ALL ON TABLE "public"."Client" TO "authenticated";
GRANT ALL ON TABLE "public"."Client" TO "service_role";



GRANT ALL ON TABLE "public"."ClientEmployee" TO "anon";
GRANT ALL ON TABLE "public"."ClientEmployee" TO "authenticated";
GRANT ALL ON TABLE "public"."ClientEmployee" TO "service_role";



GRANT ALL ON TABLE "public"."CompanyGroup" TO "anon";
GRANT ALL ON TABLE "public"."CompanyGroup" TO "authenticated";
GRANT ALL ON TABLE "public"."CompanyGroup" TO "service_role";



GRANT ALL ON TABLE "public"."DeliveryVerification" TO "anon";
GRANT ALL ON TABLE "public"."DeliveryVerification" TO "authenticated";
GRANT ALL ON TABLE "public"."DeliveryVerification" TO "service_role";



GRANT ALL ON TABLE "public"."DeliveryVerificationItem" TO "anon";
GRANT ALL ON TABLE "public"."DeliveryVerificationItem" TO "authenticated";
GRANT ALL ON TABLE "public"."DeliveryVerificationItem" TO "service_role";



GRANT ALL ON TABLE "public"."Document" TO "anon";
GRANT ALL ON TABLE "public"."Document" TO "authenticated";
GRANT ALL ON TABLE "public"."Document" TO "service_role";



GRANT ALL ON TABLE "public"."EWayBill" TO "anon";
GRANT ALL ON TABLE "public"."EWayBill" TO "authenticated";
GRANT ALL ON TABLE "public"."EWayBill" TO "service_role";



GRANT ALL ON TABLE "public"."EmailLog" TO "anon";
GRANT ALL ON TABLE "public"."EmailLog" TO "authenticated";
GRANT ALL ON TABLE "public"."EmailLog" TO "service_role";



GRANT ALL ON TABLE "public"."ImportedInvoice" TO "anon";
GRANT ALL ON TABLE "public"."ImportedInvoice" TO "authenticated";
GRANT ALL ON TABLE "public"."ImportedInvoice" TO "service_role";



GRANT ALL ON TABLE "public"."ImportedInvoiceItem" TO "anon";
GRANT ALL ON TABLE "public"."ImportedInvoiceItem" TO "authenticated";
GRANT ALL ON TABLE "public"."ImportedInvoiceItem" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory" TO "anon";
GRANT ALL ON TABLE "public"."Inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory" TO "service_role";



GRANT ALL ON TABLE "public"."InventoryMovement" TO "anon";
GRANT ALL ON TABLE "public"."InventoryMovement" TO "authenticated";
GRANT ALL ON TABLE "public"."InventoryMovement" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."Invoice" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."Invoice" TO "authenticated";
GRANT ALL ON TABLE "public"."Invoice" TO "service_role";



GRANT ALL ON TABLE "public"."InvoiceItem" TO "anon";
GRANT ALL ON TABLE "public"."InvoiceItem" TO "authenticated";
GRANT ALL ON TABLE "public"."InvoiceItem" TO "service_role";



GRANT ALL ON TABLE "public"."Notification" TO "anon";
GRANT ALL ON TABLE "public"."Notification" TO "authenticated";
GRANT ALL ON TABLE "public"."Notification" TO "service_role";



GRANT ALL ON TABLE "public"."NotificationSettings" TO "anon";
GRANT ALL ON TABLE "public"."NotificationSettings" TO "authenticated";
GRANT ALL ON TABLE "public"."NotificationSettings" TO "service_role";



GRANT ALL ON TABLE "public"."Order" TO "anon";
GRANT ALL ON TABLE "public"."Order" TO "authenticated";
GRANT ALL ON TABLE "public"."Order" TO "service_role";



GRANT ALL ON TABLE "public"."OrderItem" TO "anon";
GRANT ALL ON TABLE "public"."OrderItem" TO "authenticated";
GRANT ALL ON TABLE "public"."OrderItem" TO "service_role";



GRANT ALL ON TABLE "public"."OrderStatusHistory" TO "anon";
GRANT ALL ON TABLE "public"."OrderStatusHistory" TO "authenticated";
GRANT ALL ON TABLE "public"."OrderStatusHistory" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."Payment" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."Payment" TO "authenticated";
GRANT ALL ON TABLE "public"."Payment" TO "service_role";



GRANT ALL ON TABLE "public"."Permission" TO "anon";
GRANT ALL ON TABLE "public"."Permission" TO "authenticated";
GRANT ALL ON TABLE "public"."Permission" TO "service_role";



GRANT ALL ON TABLE "public"."PlatformSetting" TO "anon";
GRANT ALL ON TABLE "public"."PlatformSetting" TO "authenticated";
GRANT ALL ON TABLE "public"."PlatformSetting" TO "service_role";



GRANT ALL ON TABLE "public"."Product" TO "anon";
GRANT ALL ON TABLE "public"."Product" TO "authenticated";
GRANT ALL ON TABLE "public"."Product" TO "service_role";



GRANT ALL ON TABLE "public"."RoleDefinition" TO "anon";
GRANT ALL ON TABLE "public"."RoleDefinition" TO "authenticated";
GRANT ALL ON TABLE "public"."RoleDefinition" TO "service_role";



GRANT ALL ON TABLE "public"."RolePermission" TO "anon";
GRANT ALL ON TABLE "public"."RolePermission" TO "authenticated";
GRANT ALL ON TABLE "public"."RolePermission" TO "service_role";



GRANT ALL ON TABLE "public"."Tenant" TO "anon";
GRANT ALL ON TABLE "public"."Tenant" TO "authenticated";
GRANT ALL ON TABLE "public"."Tenant" TO "service_role";



GRANT ALL ON TABLE "public"."User" TO "anon";
GRANT ALL ON TABLE "public"."User" TO "authenticated";
GRANT ALL ON TABLE "public"."User" TO "service_role";



GRANT ALL ON TABLE "public"."VerificationChecklist" TO "anon";
GRANT ALL ON TABLE "public"."VerificationChecklist" TO "authenticated";
GRANT ALL ON TABLE "public"."VerificationChecklist" TO "service_role";



GRANT ALL ON TABLE "public"."VerificationItem" TO "anon";
GRANT ALL ON TABLE "public"."VerificationItem" TO "authenticated";
GRANT ALL ON TABLE "public"."VerificationItem" TO "service_role";



GRANT ALL ON TABLE "public"."VerificationResponse" TO "anon";
GRANT ALL ON TABLE "public"."VerificationResponse" TO "authenticated";
GRANT ALL ON TABLE "public"."VerificationResponse" TO "service_role";



GRANT ALL ON TABLE "public"."Warehouse" TO "anon";
GRANT ALL ON TABLE "public"."Warehouse" TO "authenticated";
GRANT ALL ON TABLE "public"."Warehouse" TO "service_role";



GRANT ALL ON TABLE "public"."WarehouseLocation" TO "anon";
GRANT ALL ON TABLE "public"."WarehouseLocation" TO "authenticated";
GRANT ALL ON TABLE "public"."WarehouseLocation" TO "service_role";



GRANT ALL ON TABLE "public"."WarehouseSetting" TO "anon";
GRANT ALL ON TABLE "public"."WarehouseSetting" TO "authenticated";
GRANT ALL ON TABLE "public"."WarehouseSetting" TO "service_role";



GRANT ALL ON TABLE "public"."_prisma_migrations" TO "anon";
GRANT ALL ON TABLE "public"."_prisma_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."_prisma_migrations" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




