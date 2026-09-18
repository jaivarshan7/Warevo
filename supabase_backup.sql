


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




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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

    -- 3. User not found or inactive → denied
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    IF v_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    -- 4. PLATFORM_ADMIN → platform-wide access
    IF v_role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- 5. Cross-tenant → denied
    IF v_tenant_id IS NULL OR v_tenant_id != p_invoice_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- 6. Tenant staff roles → full tenant access
    IF v_role IN ('WAREHOUSE_OWNER', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_MODERATOR') THEN
        RETURN TRUE;
    END IF;

    -- 7. Client roles → client/company-group scoped access
    IF v_role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
        -- Lookup the Client record linked to this user
        SELECT
            c."id",
            c."companyGroupId"
        INTO
            v_client_id,
            v_company_group_id
        FROM public."Client" c
        WHERE c."userId" = v_user_id;

        -- No linked Client record → denied
        IF NOT FOUND THEN
            RETURN FALSE;
        END IF;

        -- Direct client match
        IF p_invoice_client_id = v_client_id THEN
            RETURN TRUE;
        END IF;

        -- Company group match: check if invoice's client belongs to same group
        IF v_company_group_id IS NOT NULL THEN
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

        -- Client role but no matching client or group → denied
        RETURN FALSE;
    END IF;

    -- 8. Any other role (e.g. WAREHOUSE_STAFF) → denied
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


CREATE OR REPLACE FUNCTION "public"."create_notification_settings_for_new_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  default_event_config JSONB;
BEGIN
  -- Default notification settings for a new tenant
  default_event_config := jsonb_build_object(
    'NEW_ORDER', jsonb_build_object('inApp', true, 'clientEmail', true),
    'ORDER_ISSUED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'PROCESSING_STARTED', jsonb_build_object('inApp', true, 'clientEmail', false),
    'READY_FOR_DISPATCH', jsonb_build_object('inApp', true, 'clientEmail', true),
    'ORDER_DISPATCHED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'CLIENT_RECEIVED_ORDER', jsonb_build_object('inApp', true, 'clientEmail', false),
    'CLIENT_STARTED_VERIFICATION', jsonb_build_object('inApp', true, 'clientEmail', false),
    'CLIENT_COMPLETED_VERIFICATION', jsonb_build_object('inApp', true, 'clientEmail', true),
    'CLIENT_REJECTED_ORDER', jsonb_build_object('inApp', true, 'clientEmail', true),
    'DAMAGE_REPORTED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'MISSING_ITEMS_REPORTED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'VERIFICATION_COMPLETED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'INVOICE_GENERATED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'INVOICE_SENT', jsonb_build_object('inApp', true, 'clientEmail', true),
    'PAYMENT_RECEIVED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'PAYMENT_OVERDUE', jsonb_build_object('inApp', true, 'clientEmail', true),
    'ORDER_COMPLETED', jsonb_build_object('inApp', true, 'clientEmail', true)
  );

  INSERT INTO "NotificationSettings" ("tenantId", "enabled", "eventConfig")
  VALUES (NEW."id", true, default_event_config);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_notification_settings_for_new_tenant"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."rpc_attach_payment_proof"("p_payment_id" "text", "p_invoice_id" "text", "p_proof_url" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_actor_user_id   TEXT;
    v_actor_tenant_id TEXT;
    v_actor_role      TEXT;
    v_actor_status    TEXT;
    v_payment         RECORD;
    v_invoice         RECORD;
BEGIN
    -- 1. Resolve current actor securely from database session
    SELECT user_id, tenant_id, role, status
    INTO v_actor_user_id, v_actor_tenant_id, v_actor_role, v_actor_status
    FROM public.resolve_current_actor();

    -- 2. Verify actor payment authorization (payments:manage)
    IF NOT (v_actor_role IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTS_TEAM', 'ACCOUNTANT', 'CLIENT_ACCOUNTANT')) THEN
        RAISE EXCEPTION 'Permission denied: payment proof attachment is not allowed for role %', v_actor_role;
    END IF;

    -- 3. Validate proof URL is non-empty
    IF p_proof_url IS NULL OR TRIM(p_proof_url) = '' THEN
        RAISE EXCEPTION 'Proof URL cannot be empty';
    END IF;

    -- 4. Load and validate Payment
    SELECT * INTO v_payment FROM "Payment" WHERE "id" = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment % not found', p_payment_id;
    END IF;

    -- 5. Verify payment belongs to specified invoice
    IF v_payment."invoiceId" != p_invoice_id THEN
        RAISE EXCEPTION 'Permission denied: payment does not belong to invoice';
    END IF;

    -- 6. Tenant isolation check on Payment
    IF v_actor_role != 'PLATFORM_ADMIN' THEN
        IF v_actor_tenant_id IS NULL OR v_actor_tenant_id != v_payment."tenantId" THEN
            RAISE EXCEPTION 'Permission denied: payment belongs to another tenant';
        END IF;
    END IF;

    -- 7. Load and validate Invoice
    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    -- 8. Verify tenant consistency between Payment and Invoice
    IF v_payment."tenantId" != v_invoice."tenantId" THEN
        RAISE EXCEPTION 'Data inconsistency: payment tenant does not match invoice tenant';
    END IF;

    -- 9. Validate Storage path isolation:
    -- Expected format: {tenantId}/{invoiceId}/{paymentId}/{filename}
    IF NOT (p_proof_url LIKE (v_payment."tenantId" || '/' || v_payment."invoiceId" || '/' || v_payment."id" || '/%')) THEN
        RAISE EXCEPTION 'Invalid proof URL format: storage path must match payment and invoice context';
    END IF;

    -- 10. Update ONLY the proofUrl field on Payment
    UPDATE "Payment"
    SET "proofUrl" = p_proof_url
    WHERE "id" = v_payment."id";

    -- 11. Record in AuditLog using resolved actor
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
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_payment."tenantId",
        v_actor_user_id,
        v_actor_role::"Role",
        'Attached payment proof',
        'Payment',
        v_payment."id",
        jsonb_build_object(
            'paymentId', v_payment."id",
            'invoiceId', v_payment."invoiceId",
            'proofUrl', p_proof_url
        ),
        CURRENT_TIMESTAMP
    );

    -- 12. Return payload
    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment."id",
        'invoiceId', v_payment."invoiceId",
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


CREATE OR REPLACE FUNCTION "public"."rpc_create_order_with_invoice"("p_tenant_id" "text", "p_client_id" "text", "p_created_by_id" "text", "p_selected_contact_ids" "text"[], "p_assigned_staff_id" "text" DEFAULT NULL::"text", "p_expected_delivery" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text", "p_status" "public"."OrderStatus" DEFAULT 'ISSUED'::"public"."OrderStatus", "p_eway_bill" "jsonb" DEFAULT NULL::"jsonb", "p_items" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
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
    v_latest_invoice_num INTEGER := 0;
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
BEGIN
    -- Validate tenant exists
    IF NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "id" = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
    END IF;

    -- Validate client exists
    IF NOT EXISTS (SELECT 1 FROM "Client" WHERE "id" = p_client_id) THEN
        RAISE EXCEPTION 'Client % not found', p_client_id;
    END IF;

    -- Validate created_by exists
    IF p_created_by_id IS NOT NULL AND p_created_by_id != '' THEN
        IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = p_created_by_id) THEN
            RAISE EXCEPTION 'User % not found', p_created_by_id;
        END IF;
    END IF;

    -- Validate assigned_staff if provided
    IF p_assigned_staff_id IS NOT NULL AND p_assigned_staff_id != '' THEN
        IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = p_assigned_staff_id) THEN
            RAISE EXCEPTION 'Assigned staff % not found', p_assigned_staff_id;
        END IF;
    END IF;

    -- Get warehouse settings for order/invoice prefixes
    SELECT * INTO v_warehouse_setting
    FROM "WarehouseSetting"
    WHERE "tenantId" = p_tenant_id
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warehouse settings not found for tenant %', p_tenant_id;
    END IF;

    -- Generate order number
    SELECT COALESCE(
        MAX(
            SUBSTRING(
                "orderNumber"
                FROM v_warehouse_setting."orderPrefix" || '-2026-([0-9]+)'
            )::INTEGER
        ),
        0
    )
    INTO v_last_order_num
    FROM "Order"
    WHERE "tenantId" = p_tenant_id
      AND "orderNumber" LIKE v_warehouse_setting."orderPrefix" || '-2026-%';

    v_next_order_num := v_last_order_num + 1;
    v_order_number :=
        v_warehouse_setting."orderPrefix"
        || '-2026-'
        || LPAD(v_next_order_num::TEXT, 6, '0');

    -- Calculate totals from items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_subtotal :=
            (v_item->>'quantity')::NUMERIC
            * (v_item->>'unitPrice')::NUMERIC
            - COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_item_tax :=
            v_item_subtotal
            * (v_item->>'taxRate')::NUMERIC
            / 100;

        v_item_discount :=
            COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_subtotal := v_subtotal + v_item_subtotal;
        v_tax_total := v_tax_total + v_item_tax;
        v_discount_total := v_discount_total + v_item_discount;
    END LOOP;

    v_total_amount := v_subtotal + v_tax_total;

    -- Generate IDs
    v_order_id :=
        concat(
            'ord_',
            substr(md5(random()::text || clock_timestamp()::text), 1, 16)
        );

    v_invoice_id :=
        concat(
            'inv_',
            substr(md5(random()::text || clock_timestamp()::text), 1, 16)
        );

    -- Calculate invoice CGST/SGST
    v_cgst := ROUND(v_tax_total / 2.0, 2);
    v_sgst := ROUND(v_tax_total / 2.0, 2);

    -- Serialize invoice number generation per tenant
    PERFORM pg_advisory_xact_lock(
        hashtextextended(p_tenant_id, 0)
    );

    SELECT COALESCE(
        MAX(
            SUBSTRING(
                "invoiceNumber"
                FROM 'INV-2026-([0-9]+)'
            )::INTEGER
        ),
        0
    )
    INTO v_latest_invoice_num
    FROM "Invoice"
    WHERE "tenantId" = p_tenant_id
      AND "invoiceNumber" LIKE 'INV-2026-%';

    v_invoice_number :=
        concat(
            'INV-2026-',
            LPAD((v_latest_invoice_num + 1)::TEXT, 6, '0')
        );

    -- 1. Insert Order
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
        "createdAt"
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
        p_created_by_id,
        p_assigned_staff_id,
        v_order_date
    );

    -- 2. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_order_id :=
            concat(
                'oi_',
                substr(md5(random()::text || clock_timestamp()::text), 1, 16)
            );

        v_item_quantity := (v_item->>'quantity')::INTEGER;
        v_item_unit_price := (v_item->>'unitPrice')::NUMERIC;
        v_item_tax_rate := (v_item->>'taxRate')::NUMERIC;
        v_item_discount :=
            COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_item_subtotal :=
            v_item_quantity * v_item_unit_price - v_item_discount;

        v_item_tax :=
            v_item_subtotal * v_item_tax_rate / 100;

        v_item_total := v_item_subtotal + v_item_tax;

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

    -- 3. Insert Invoice as FINAL
    INSERT INTO "Invoice" (
        "id",
        "tenantId",
        "orderId",
        "clientId",
        "invoiceNumber",
        "status",
        "paymentStatus",
        "subtotal",
        "cgst",
        "sgst",
        "igst",
        "discountTotal",
        "total",
        "invoiceDate",
        "finalizedAt",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        v_invoice_id,
        p_tenant_id,
        v_order_id,
        p_client_id,
        v_invoice_number,
        v_status,
        'UNPAID',
        v_subtotal,
        v_cgst,
        v_sgst,
        0,
        v_discount_total,
        v_total_amount,
        CURRENT_DATE,
        NOW(),
        v_order_date,
        NOW()
    );

    -- 4. Insert Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_invoice_item_id :=
            concat(
                'ii_',
                substr(md5(random()::text || clock_timestamp()::text), 1, 16)
            );

        v_item_quantity := (v_item->>'quantity')::INTEGER;
        v_item_unit_price := (v_item->>'unitPrice')::NUMERIC;
        v_item_tax_rate := (v_item->>'taxRate')::NUMERIC;
        v_item_discount :=
            COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_item_subtotal :=
            v_item_quantity * v_item_unit_price - v_item_discount;

        v_item_tax :=
            v_item_subtotal * v_item_tax_rate / 100;

        v_item_total := v_item_subtotal + v_item_tax;

        v_cgst := ROUND(v_item_tax / 2.0, 2);
        v_sgst := ROUND(v_item_tax / 2.0, 2);

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
            v_cgst,
            v_sgst,
            0,
            v_item_total
        );
    END LOOP;

    -- 5. Insert Order Status History
    v_order_history_id :=
        concat(
            'osh_',
            substr(md5(random()::text || clock_timestamp()::text), 1, 16)
        );

    INSERT INTO "OrderStatusHistory" (
        "id",
        "tenantId",
        "orderId",
        "newStatus",
        "changedById",
        "notes",
        "createdAt"
    )
    VALUES (
        v_order_history_id,
        p_tenant_id,
        v_order_id,
        p_status,
        p_created_by_id,
        'Initial order created',
        v_order_date
    );

    -- 6. Insert notifications
    IF p_selected_contact_ids IS NOT NULL
       AND array_length(p_selected_contact_ids, 1) > 0
    THEN
        FOREACH v_contact_id IN ARRAY p_selected_contact_ids
        LOOP
            SELECT "userId"
            INTO v_user_id
            FROM "Client"
            WHERE "id" = v_contact_id
              AND "tenantId" = p_tenant_id
              AND "id" = p_client_id;

            IF v_user_id IS NOT NULL THEN
                v_notification_id :=
                    concat(
                        'notif_',
                        substr(
                            md5(random()::text || clock_timestamp()::text),
                            1,
                            16
                        )
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
                        ' has been created with final invoice.'
                    ),
                    concat(
                        '/operations/orders/',
                        v_order_id
                    ),
                    'normal',
                    false,
                    v_order_date
                );
            END IF;
        END LOOP;
    END IF;

    -- 7. Insert Audit Log
    v_audit_log_id :=
        concat(
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
        p_created_by_id,
        'WAREHOUSE_STAFF',
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
        'success', true,
        'orderId', v_order_id,
        'orderNumber', v_order_number,
        'invoiceId', v_invoice_id,
        'invoiceNumber', v_invoice_number,
        'invoiceStatus', v_status,
        'orderStatus', p_status,
        'totalAmount', v_total_amount
    );
END;
$$;


ALTER FUNCTION "public"."rpc_create_order_with_invoice"("p_tenant_id" "text", "p_client_id" "text", "p_created_by_id" "text", "p_selected_contact_ids" "text"[], "p_assigned_staff_id" "text", "p_expected_delivery" timestamp with time zone, "p_notes" "text", "p_status" "public"."OrderStatus", "p_eway_bill" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_generate_invoice"("p_order_id" "text", "p_is_final" boolean DEFAULT false, "p_user_id" "text" DEFAULT NULL::"text", "p_user_role" "public"."Role" DEFAULT 'WAREHOUSE_OWNER'::"public"."Role") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_order RECORD;
    v_latest_number INTEGER := 0;
    v_new_invoice_id TEXT;
    v_invoice_number TEXT;
    v_status "InvoiceStatus";
    v_cgst NUMERIC(12,2);
    v_sgst NUMERIC(12,2);
    v_item RECORD;
    v_split_tax NUMERIC(12,2);
    v_divisor NUMERIC;
BEGIN
    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Sanitize user
    SELECT "id" INTO p_user_id FROM "User" WHERE "id" = p_user_id;

    -- CRITICAL BUSINESS RULE: Final invoice blocked until verified!
    IF p_is_final AND v_order."verificationStatus" != 'VERIFIED' THEN
        INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
        VALUES (
            concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            v_order."tenantId",
            p_user_id,
            p_user_role,
            'Blocked final invoice before verification',
            'Order',
            v_order."id",
            jsonb_build_object('verificationStatus', v_order."verificationStatus"),
            jsonb_build_object('requestedFinal', true),
            CURRENT_TIMESTAMP
        );
        RAISE EXCEPTION 'Final invoice generation is blocked until client verification is VERIFIED. Current status: %', v_order."verificationStatus";
    END IF;

    -- Calculate next invoice number
    SELECT COALESCE(MAX(SUBSTRING("invoiceNumber" FROM 'INV-2026-([0-9]+)')::INTEGER), 0)
    INTO v_latest_number
    FROM "Invoice"
    WHERE "tenantId" = v_order."tenantId" AND "invoiceNumber" LIKE 'INV-2026-%';

    v_invoice_number := concat('INV-2026-', LPAD((v_latest_number + 1)::TEXT, 6, '0'));
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
        p_user_id,
        p_user_role,
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
$$;


ALTER FUNCTION "public"."rpc_generate_invoice"("p_order_id" "text", "p_is_final" boolean, "p_user_id" "text", "p_user_role" "public"."Role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_receive_or_adjust_stock"("p_inventory_id" "text", "p_quantity" integer, "p_type" "public"."InventoryMovementType", "p_notes" "text" DEFAULT NULL::"text", "p_user_id" "text" DEFAULT NULL::"text", "p_user_role" "public"."Role" DEFAULT 'WAREHOUSE_STAFF'::"public"."Role") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_inv RECORD;
    v_new_available INTEGER;
    v_new_total INTEGER;
    v_new_damaged INTEGER;
    v_movement_id TEXT;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    SELECT * INTO v_inv FROM "Inventory" WHERE "id" = p_inventory_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record % not found', p_inventory_id;
    END IF;

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

    SELECT "id" INTO p_user_id FROM "User" WHERE "id" = p_user_id;

    -- Update inventory
    UPDATE "Inventory"
    SET "availableQuantity" = v_new_available,
        "totalQuantity" = v_new_total,
        "damagedQuantity" = v_new_damaged,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_inventory_id;

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
        p_user_id,
        CURRENT_TIMESTAMP
    );

    -- Log audit
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_inv."tenantId",
        p_user_id,
        p_user_role,
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
    v_actor_user_id   TEXT;
    v_actor_tenant_id TEXT;
    v_actor_role      TEXT;
    v_actor_status    TEXT;
    v_invoice         RECORD;
    v_payment_id      TEXT;
    v_method          TEXT;
    v_reference       TEXT;
    v_total_paid      NUMERIC(12,2);
    v_new_payment_status "PaymentStatus";
BEGIN
    -- 1. Resolve current actor securely from database session
    SELECT user_id, tenant_id, role, status
    INTO v_actor_user_id, v_actor_tenant_id, v_actor_role, v_actor_status
    FROM public.resolve_current_actor();

    -- 2. Verify actor payment authorization
    IF NOT (v_actor_role IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'ACCOUNTS_TEAM', 'ACCOUNTANT', 'CLIENT_ACCOUNTANT')) THEN
        RAISE EXCEPTION 'Permission denied: payment management is not allowed for role %', v_actor_role;
    END IF;

    -- 3. Validate amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- 4. Load and validate invoice
    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    -- 5. Tenant isolation check
    -- PLATFORM_ADMIN is allowed cross-tenant operation; all other roles must strictly match
    IF v_actor_role != 'PLATFORM_ADMIN' THEN
        IF v_actor_tenant_id IS NULL OR v_actor_tenant_id != v_invoice."tenantId" THEN
            RAISE EXCEPTION 'Permission denied: invoice belongs to another tenant';
        END IF;
    END IF;

    -- 6. Generate payment details
    v_payment_id := concat('pay_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    v_method := COALESCE(NULLIF(TRIM(p_method), ''), 'BANK_TRANSFER');
    v_reference := NULLIF(TRIM(p_reference), '');
    IF v_reference IS NULL THEN
        v_reference := concat('PAY-', right((extract(epoch from clock_timestamp()) * 1000)::bigint::text, 6));
    END IF;

    -- 7. Insert Payment record (proofUrl is set to NULL initially; attached in proof flow)
    INSERT INTO "Payment" (
        "id",
        "tenantId",
        "invoiceId",
        "amount",
        "status",
        "method",
        "reference",
        "proofUrl",
        "paidAt",
        "createdAt"
    )
    VALUES (
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

    -- 9. Determine new payment status & update order workflow if fully paid
    IF v_total_paid >= v_invoice."total" THEN
        v_new_payment_status := 'PAID';
        -- Update related order status to PAID if currently PAYMENT_PENDING or INVOICED
        IF v_invoice."orderId" IS NOT NULL THEN
            UPDATE "Order"
            SET "status" = 'PAID', "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = v_invoice."orderId" AND "status" IN ('INVOICED', 'PAYMENT_PENDING');
        END IF;
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
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_invoice."tenantId",
        v_actor_user_id,
        v_actor_role::"Role",
        'Recorded payment',
        'Payment',
        v_payment_id,
        jsonb_build_object(
            'amount', p_amount,
            'paymentStatus', v_new_payment_status,
            'method', v_method,
            'reference', v_reference
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


ALTER FUNCTION "public"."rpc_record_payment_secure"("p_invoice_id" "text", "p_amount" numeric, "p_method" "text", "p_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_submit_verification"("p_order_id" "text", "p_status" "public"."VerificationStatus", "p_responses" "jsonb", "p_comments" "text" DEFAULT NULL::"text", "p_attachments" "jsonb" DEFAULT NULL::"jsonb", "p_user_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_order RECORD;
    v_user RECORD;
    v_client_user RECORD;
    v_new_order_status "OrderStatus";
    v_item JSONB;
    v_auth_uid TEXT;
BEGIN
    -- Resolve authenticated user
    v_auth_uid := auth.uid()::text;
    IF v_auth_uid IS NOT NULL AND v_auth_uid != '' THEN
        p_user_id := v_auth_uid;
    END IF;

    IF p_user_id IS NULL OR p_user_id = '' THEN
        RAISE EXCEPTION 'Authentication required to submit delivery verification';
    END IF;

    -- Validate user exists
    SELECT * INTO v_user FROM "User" WHERE "id" = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % not found', p_user_id;
    END IF;

    -- Retrieve order
    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Workflow state checks:
    -- Reject ISSUED orders
    IF v_order.status = 'ISSUED' THEN
        RAISE EXCEPTION 'Order % is still in ISSUED status and cannot be verified until dispatched', v_order."orderNumber";
    END IF;

    -- Accept only DISPATCHED orders for active verification
    IF v_order.status != 'DISPATCHED' THEN
        RAISE EXCEPTION 'This order (%) is not ready for client verification. Current status: %', v_order."orderNumber", v_order.status;
    END IF;

    -- Reject RECEIVED or VERIFICATION_PENDING as a target verification status
    IF p_status::text IN ('RECEIVED', 'VERIFICATION_PENDING', 'PENDING') THEN
        RAISE EXCEPTION 'Invalid verification status: %. Only VERIFIED, PARTIALLY_VERIFIED, or REJECTED are permitted', p_status;
    END IF;

    -- Authorization & Client/Tenant Ownership Validation:
    -- Accounting roles cannot perform physical delivery verification
    IF v_user.role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT') THEN
        RAISE EXCEPTION 'Accounting users cannot submit delivery verifications';
    END IF;

    -- Validate tenant ownership
    IF v_user."tenantId" IS NOT NULL AND v_user."tenantId" != v_order."tenantId" THEN
        RAISE EXCEPTION 'Cross-tenant verification access denied';
    END IF;

    -- If the user is a CLIENT, enforce Client Receiver authorization and client ownership
    IF v_user.role = 'CLIENT' THEN
        SELECT * INTO v_client_user
        FROM "Client"
        WHERE "userId" = v_user.id AND "tenantId" = v_order."tenantId"
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Client profile not associated with authenticated user';
        END IF;

        -- Must be a designated RECEIVER
        IF v_client_user."employeeRole" IS NULL OR v_client_user."employeeRole" != 'RECEIVER' THEN
            RAISE EXCEPTION 'Only Client Receivers (employeeRole: RECEIVER) are authorized to verify deliveries';
        END IF;

        -- Must belong to the client company of the order
        IF v_client_user.id != v_order."clientId" THEN
            -- Check if in same company group
            IF v_client_user."companyGroupId" IS NULL OR v_client_user."companyGroupId" != (
                SELECT "companyGroupId" FROM "Client" WHERE "id" = v_order."clientId"
            ) THEN
                RAISE EXCEPTION 'Client Receiver is not authorized for this client order';
            END IF;
        END IF;
    END IF;

    -- Validate Required Checklist Items:
    -- When status is VERIFIED, all 7 inspection checklist items must be checked
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

    -- Determine new order status matching verification status:
    -- DISPATCHED -> VERIFIED (or PARTIALLY_VERIFIED / REJECTED)
    v_new_order_status := p_status::text::"OrderStatus";

    -- 1. Upsert VerificationResponse atomically
    INSERT INTO "VerificationResponse" (
        "id", "tenantId", "orderId", "clientId", "userId", "status", "responses", "comments", "attachments", "createdAt"
    )
    VALUES (
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

    -- 2. Update Order status and verification status atomically
    UPDATE "Order"
    SET "verificationStatus" = p_status,
        "status" = v_new_order_status,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_order."id";

    -- 3. Record Order Status History
    INSERT INTO "OrderStatusHistory" ("id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt")
    VALUES (
        concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."status",
        v_new_order_status,
        p_user_id,
        COALESCE(p_comments, concat('Delivery verification completed with status: ', p_status)),
        CURRENT_TIMESTAMP
    );

    -- 4. Record Audit Log
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_user_id,
        v_user.role,
        'Submitted delivery verification',
        'Order',
        v_order."id",
        jsonb_build_object('status', v_order."status", 'verificationStatus', v_order."verificationStatus"),
        jsonb_build_object('status', v_new_order_status, 'verificationStatus', p_status),
        CURRENT_TIMESTAMP
    );

    -- 5. Notification to warehouse operations team
    INSERT INTO "Notification" ("id", "tenantId", "orderId", "type", "title", "message", "actionUrl", "priority", "read", "createdAt")
    VALUES (
        concat('notif_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        'CLIENT_COMPLETED_VERIFICATION',
        'Delivery Verification Completed',
        concat('Order ', v_order."orderNumber", ' was verified as ', p_status),
        concat('/operations/orders/', v_order."id"),
        'normal',
        false,
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order."id",
        'verificationStatus', p_status,
        'orderStatus', v_new_order_status
    );
END;
$$;


ALTER FUNCTION "public"."rpc_submit_verification"("p_order_id" "text", "p_status" "public"."VerificationStatus", "p_responses" "jsonb", "p_comments" "text", "p_attachments" "jsonb", "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_transition_order"("p_order_id" "text", "p_next_status" "public"."OrderStatus", "p_notes" "text" DEFAULT NULL::"text", "p_user_id" "text" DEFAULT NULL::"text", "p_user_role" "public"."Role" DEFAULT 'WAREHOUSE_STAFF'::"public"."Role") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_order RECORD;
    v_new_verification "VerificationStatus";
    v_valid_transition BOOLEAN := FALSE;
BEGIN
    -- Retrieve order
    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order with ID % not found', p_order_id;
    END IF;

    -- Validate role restrictions
    IF p_user_role = 'CLIENT' THEN
        RAISE EXCEPTION 'Clients must use delivery verification to advance dispatched orders';
    END IF;

    IF p_user_role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT') AND p_next_status NOT IN ('INVOICED', 'PAYMENT_PENDING', 'PAID', 'COMPLETED') THEN
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

    -- Sanitize user_id
    SELECT "id" INTO p_user_id FROM "User" WHERE "id" = p_user_id;

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
        p_user_id,
        p_notes,
        CURRENT_TIMESTAMP
    );

    -- Record Audit Log
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_user_id,
        p_user_role,
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


CREATE OR REPLACE FUNCTION "public"."rpc_update_employee"("p_actor_id" "text", "p_actor_role" "public"."Role", "p_target_id" "text", "p_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_mobile" "text" DEFAULT NULL::"text", "p_new_role" "public"."Role" DEFAULT NULL::"public"."Role", "p_new_status" "public"."UserStatus" DEFAULT NULL::"public"."UserStatus") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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

    -- 9. Capture previous state for audit log
    v_prev_value := to_jsonb(v_target);

    -- 10. Apply updates
    UPDATE "User"
    SET
        "name"      = COALESCE(NULLIF(TRIM(p_name), ''), "name"),
        "email"     = CASE WHEN p_email IS NOT NULL THEN NULLIF(TRIM(p_email), '') ELSE "email" END,
        "mobile"    = CASE WHEN p_mobile IS NOT NULL THEN NULLIF(TRIM(p_mobile), '') ELSE "mobile" END,
        "role"      = COALESCE(p_new_role,   "role"),
        "status"    = COALESCE(p_new_status, "status"),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_id;

    -- 11. Reload updated target record
    SELECT * INTO v_target FROM "User" WHERE "id" = p_target_id;
    v_new_value := to_jsonb(v_target);

    -- 12. Write audit log record
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


ALTER FUNCTION "public"."rpc_update_employee"("p_actor_id" "text", "p_actor_role" "public"."Role", "p_target_id" "text", "p_name" "text", "p_email" "text", "p_mobile" "text", "p_new_role" "public"."Role", "p_new_status" "public"."UserStatus") OWNER TO "postgres";

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
    "userId" "text",
    "companyName" "text" NOT NULL,
    "contactPerson" "text" NOT NULL,
    "mobile" "text" NOT NULL,
    "email" "text",
    "gstNumber" "text",
    "billingAddress" "text" NOT NULL,
    "shippingAddress" "text" NOT NULL,
    "status" "public"."ClientStatus" DEFAULT 'ACTIVE'::"public"."ClientStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "companyGroupId" "text",
    "employeeRole" "public"."ClientEmployeeRole"
);


ALTER TABLE "public"."Client" OWNER TO "postgres";


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
    "updatedAt" timestamp(3) without time zone NOT NULL
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
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL
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
    "invoicePrefix" "text" DEFAULT 'INV'::"text" NOT NULL,
    "gstSettings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notificationPreferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
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



ALTER TABLE ONLY "public"."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."PlatformSetting"
    ADD CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "AuditLog_entity_entityId_idx" ON "public"."AuditLog" USING "btree" ("entity", "entityId");



CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "public"."AuditLog" USING "btree" ("tenantId", "createdAt");



CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "public"."Category" USING "btree" ("tenantId", "name");



CREATE INDEX "Client_companyGroupId_idx" ON "public"."Client" USING "btree" ("companyGroupId");



CREATE INDEX "Client_tenantId_idx" ON "public"."Client" USING "btree" ("tenantId");



CREATE UNIQUE INDEX "Client_tenantId_mobile_key" ON "public"."Client" USING "btree" ("tenantId", "mobile");



CREATE UNIQUE INDEX "Client_userId_key" ON "public"."Client" USING "btree" ("userId");



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



CREATE UNIQUE INDEX "Order_tenantId_orderNumber_key" ON "public"."Order" USING "btree" ("tenantId", "orderNumber");



CREATE INDEX "Order_tenantId_status_idx" ON "public"."Order" USING "btree" ("tenantId", "status");



CREATE INDEX "Payment_tenantId_status_idx" ON "public"."Payment" USING "btree" ("tenantId", "status");



CREATE UNIQUE INDEX "PlatformSetting_tenantId_key" ON "public"."PlatformSetting" USING "btree" ("tenantId");



CREATE INDEX "Product_tenantId_name_idx" ON "public"."Product" USING "btree" ("tenantId", "name");



CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "public"."Product" USING "btree" ("tenantId", "sku");



CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant" USING "btree" ("slug");



CREATE UNIQUE INDEX "User_email_key" ON "public"."User" USING "btree" ("email");



CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "public"."User" USING "btree" ("supabaseUserId");



CREATE INDEX "User_tenantId_role_idx" ON "public"."User" USING "btree" ("tenantId", "role");



CREATE UNIQUE INDEX "VerificationResponse_orderId_key" ON "public"."VerificationResponse" USING "btree" ("orderId");



CREATE INDEX "WarehouseLocation_tenantId_warehouseId_idx" ON "public"."WarehouseLocation" USING "btree" ("tenantId", "warehouseId");



CREATE UNIQUE INDEX "WarehouseSetting_tenantId_key" ON "public"."WarehouseSetting" USING "btree" ("tenantId");



CREATE UNIQUE INDEX "Warehouse_tenantId_code_key" ON "public"."Warehouse" USING "btree" ("tenantId", "code");



CREATE INDEX "Warehouse_tenantId_idx" ON "public"."Warehouse" USING "btree" ("tenantId");



CREATE INDEX "idx_notification_settings_tenant" ON "public"."NotificationSettings" USING "btree" ("tenantId");



CREATE OR REPLACE TRIGGER "create_notification_settings_on_tenant_create" AFTER INSERT ON "public"."Tenant" FOR EACH ROW EXECUTE FUNCTION "public"."create_notification_settings_for_new_tenant"();



ALTER TABLE ONLY "public"."AuditLog"
    ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Client"
    ADD CONSTRAINT "Client_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "public"."CompanyGroup"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Client"
    ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Client"
    ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



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



CREATE POLICY "Allow all for anon and authenticated" ON "public"."AuditLog" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."Category" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."Client" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."CompanyGroup" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."DeliveryVerification" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."DeliveryVerificationItem" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."Document" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."EWayBill" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."ImportedInvoice" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."ImportedInvoiceItem" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."Inventory" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."InventoryMovement" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."InvoiceItem" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."Notification" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."Order" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."OrderItem" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."OrderStatusHistory" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."PlatformSetting" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."Product" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."Tenant" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."User" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."VerificationChecklist" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."VerificationItem" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."VerificationResponse" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."Warehouse" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."WarehouseLocation" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon and authenticated" ON "public"."WarehouseSetting" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow read on Invoice" ON "public"."Invoice" FOR SELECT TO "authenticated" USING ("public"."can_read_invoice"("tenantId", "clientId"));



CREATE POLICY "Allow read on Payment" ON "public"."Payment" FOR SELECT TO "authenticated" USING ("public"."can_read_payment"("tenantId", "invoiceId"));



CREATE POLICY "Allow tenant to read their notification settings" ON "public"."NotificationSettings" FOR SELECT TO "authenticated" USING (("tenantId" = ("auth"."jwt"() ->> 'tenantId'::"text")));



CREATE POLICY "Allow tenant to update their notification settings" ON "public"."NotificationSettings" FOR UPDATE TO "authenticated" USING (("tenantId" = ("auth"."jwt"() ->> 'tenantId'::"text"))) WITH CHECK (("tenantId" = ("auth"."jwt"() ->> 'tenantId'::"text")));



ALTER TABLE "public"."AuditLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Category" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Client" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."PlatformSetting" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Product" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Tenant" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VerificationChecklist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VerificationItem" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."VerificationResponse" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Warehouse" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."WarehouseLocation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."WarehouseSetting" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































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



GRANT ALL ON FUNCTION "public"."create_notification_settings_for_new_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_settings_for_new_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_settings_for_new_tenant"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_current_actor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_current_actor"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_attach_payment_proof"("p_payment_id" "text", "p_invoice_id" "text", "p_proof_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_attach_payment_proof"("p_payment_id" "text", "p_invoice_id" "text", "p_proof_url" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rpc_cancel_payment_record"("p_payment_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_cancel_payment_record"("p_payment_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."rpc_create_order_with_invoice"("p_tenant_id" "text", "p_client_id" "text", "p_created_by_id" "text", "p_selected_contact_ids" "text"[], "p_assigned_staff_id" "text", "p_expected_delivery" timestamp with time zone, "p_notes" "text", "p_status" "public"."OrderStatus", "p_eway_bill" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_create_order_with_invoice"("p_tenant_id" "text", "p_client_id" "text", "p_created_by_id" "text", "p_selected_contact_ids" "text"[], "p_assigned_staff_id" "text", "p_expected_delivery" timestamp with time zone, "p_notes" "text", "p_status" "public"."OrderStatus", "p_eway_bill" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_create_order_with_invoice"("p_tenant_id" "text", "p_client_id" "text", "p_created_by_id" "text", "p_selected_contact_ids" "text"[], "p_assigned_staff_id" "text", "p_expected_delivery" timestamp with time zone, "p_notes" "text", "p_status" "public"."OrderStatus", "p_eway_bill" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_generate_invoice"("p_order_id" "text", "p_is_final" boolean, "p_user_id" "text", "p_user_role" "public"."Role") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_generate_invoice"("p_order_id" "text", "p_is_final" boolean, "p_user_id" "text", "p_user_role" "public"."Role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_generate_invoice"("p_order_id" "text", "p_is_final" boolean, "p_user_id" "text", "p_user_role" "public"."Role") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_receive_or_adjust_stock"("p_inventory_id" "text", "p_quantity" integer, "p_type" "public"."InventoryMovementType", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_receive_or_adjust_stock"("p_inventory_id" "text", "p_quantity" integer, "p_type" "public"."InventoryMovementType", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_receive_or_adjust_stock"("p_inventory_id" "text", "p_quantity" integer, "p_type" "public"."InventoryMovementType", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_record_payment_secure"("p_invoice_id" "text", "p_amount" numeric, "p_method" "text", "p_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_record_payment_secure"("p_invoice_id" "text", "p_amount" numeric, "p_method" "text", "p_reference" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."rpc_submit_verification"("p_order_id" "text", "p_status" "public"."VerificationStatus", "p_responses" "jsonb", "p_comments" "text", "p_attachments" "jsonb", "p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_submit_verification"("p_order_id" "text", "p_status" "public"."VerificationStatus", "p_responses" "jsonb", "p_comments" "text", "p_attachments" "jsonb", "p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_submit_verification"("p_order_id" "text", "p_status" "public"."VerificationStatus", "p_responses" "jsonb", "p_comments" "text", "p_attachments" "jsonb", "p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_transition_order"("p_order_id" "text", "p_next_status" "public"."OrderStatus", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_transition_order"("p_order_id" "text", "p_next_status" "public"."OrderStatus", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_transition_order"("p_order_id" "text", "p_next_status" "public"."OrderStatus", "p_notes" "text", "p_user_id" "text", "p_user_role" "public"."Role") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_update_employee"("p_actor_id" "text", "p_actor_role" "public"."Role", "p_target_id" "text", "p_name" "text", "p_email" "text", "p_mobile" "text", "p_new_role" "public"."Role", "p_new_status" "public"."UserStatus") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_update_employee"("p_actor_id" "text", "p_actor_role" "public"."Role", "p_target_id" "text", "p_name" "text", "p_email" "text", "p_mobile" "text", "p_new_role" "public"."Role", "p_new_status" "public"."UserStatus") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_update_employee"("p_actor_id" "text", "p_actor_role" "public"."Role", "p_target_id" "text", "p_name" "text", "p_email" "text", "p_mobile" "text", "p_new_role" "public"."Role", "p_new_status" "public"."UserStatus") TO "service_role";


















GRANT ALL ON TABLE "public"."AuditLog" TO "anon";
GRANT ALL ON TABLE "public"."AuditLog" TO "authenticated";
GRANT ALL ON TABLE "public"."AuditLog" TO "service_role";



GRANT ALL ON TABLE "public"."Category" TO "anon";
GRANT ALL ON TABLE "public"."Category" TO "authenticated";
GRANT ALL ON TABLE "public"."Category" TO "service_role";



GRANT ALL ON TABLE "public"."Client" TO "anon";
GRANT ALL ON TABLE "public"."Client" TO "authenticated";
GRANT ALL ON TABLE "public"."Client" TO "service_role";



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



GRANT ALL ON TABLE "public"."PlatformSetting" TO "anon";
GRANT ALL ON TABLE "public"."PlatformSetting" TO "authenticated";
GRANT ALL ON TABLE "public"."PlatformSetting" TO "service_role";



GRANT ALL ON TABLE "public"."Product" TO "anon";
GRANT ALL ON TABLE "public"."Product" TO "authenticated";
GRANT ALL ON TABLE "public"."Product" TO "service_role";



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




























