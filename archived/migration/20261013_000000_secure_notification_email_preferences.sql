-- ============================================================================
-- Migration: 20261013_000000_secure_notification_email_preferences.sql
-- Description: Audit and Harden Notifications, Email Preferences (Default OFF),
--              EmailLog Audit Table, and Secure RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NotificationSettings: Default Email Preferences to OFF
-- ----------------------------------------------------------------------------

-- Function to automatically create notification settings with email OFF by default
CREATE OR REPLACE FUNCTION public.create_notification_settings_for_new_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Ensure trigger is active
DROP TRIGGER IF EXISTS "create_notification_settings_on_tenant_create" ON public."Tenant";
CREATE TRIGGER "create_notification_settings_on_tenant_create"
  AFTER INSERT ON public."Tenant"
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_settings_for_new_tenant();

-- Add UNIQUE constraint on NotificationSettings(tenantId) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_settings_tenant_id_unique'
  ) THEN
    ALTER TABLE public."NotificationSettings"
    ADD CONSTRAINT notification_settings_tenant_id_unique UNIQUE ("tenantId");
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Audit & Harden NotificationSettings RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public."NotificationSettings" ENABLE ROW LEVEL SECURITY;

-- Drop legacy insecure policies
DROP POLICY IF EXISTS "Allow tenant to read their notification settings" ON public."NotificationSettings";
DROP POLICY IF EXISTS "Allow tenant to update their notification settings" ON public."NotificationSettings";
DROP POLICY IF EXISTS "notification_settings_select_policy" ON public."NotificationSettings";
DROP POLICY IF EXISTS "notification_settings_update_policy" ON public."NotificationSettings";
DROP POLICY IF EXISTS "notification_settings_insert_policy" ON public."NotificationSettings";
DROP POLICY IF EXISTS "deny_anon_notification_settings" ON public."NotificationSettings";

-- Restrictive policy: deny anon completely
CREATE POLICY "deny_anon_notification_settings"
ON public."NotificationSettings"
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- SELECT Policy: Users can read their tenant's notification settings via can_access_tenant
CREATE POLICY "notification_settings_select_policy"
ON public."NotificationSettings"
FOR SELECT
TO authenticated
USING (
  public.can_access_tenant("tenantId")
);

-- UPDATE Policy: Only PLATFORM_ADMIN, WAREHOUSE_OWNER, and WAREHOUSE_MODERATOR can update
CREATE POLICY "notification_settings_update_policy"
ON public."NotificationSettings"
FOR UPDATE
TO authenticated
USING (
  public.can_access_tenant("tenantId")
  AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR'])
)
WITH CHECK (
  public.can_access_tenant("tenantId")
);

-- INSERT Policy: Only PLATFORM_ADMIN and WAREHOUSE_OWNER
CREATE POLICY "notification_settings_insert_policy"
ON public."NotificationSettings"
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_tenant("tenantId")
  AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER'])
);

-- ----------------------------------------------------------------------------
-- 3. Dedicated Secure RPC: rpc_update_notification_settings
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_update_notification_settings(
    p_tenant_id text,
    p_enabled boolean,
    p_event_config jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION public.rpc_update_notification_settings(text, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_notification_settings(text, boolean, jsonb) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Harden rpc_mark_notification_read with Client Scoping
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_mark_notification_read(p_notification_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- ----------------------------------------------------------------------------
-- 5. EmailLog Table with RLS and Idempotency
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public."EmailLog" (
    "id" TEXT PRIMARY KEY DEFAULT concat('elog_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    "tenantId" TEXT NOT NULL REFERENCES public."Tenant"("id") ON DELETE CASCADE,
    "notificationId" TEXT REFERENCES public."Notification"("id") ON DELETE SET NULL,
    "orderId" TEXT REFERENCES public."Order"("id") ON DELETE SET NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientUserId" TEXT REFERENCES public."User"("id") ON DELETE SET NULL,
    "eventType" public."NotificationType" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED')),
    "resendId" TEXT,
    "idempotencyKey" TEXT UNIQUE,
    "reason" TEXT,
    "error" TEXT,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_email_log_tenant" ON public."EmailLog"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_email_log_recipient" ON public."EmailLog"("recipientEmail");
CREATE INDEX IF NOT EXISTS "idx_email_log_idempotency" ON public."EmailLog"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "idx_email_log_created_at" ON public."EmailLog"("createdAt" DESC);

ALTER TABLE public."EmailLog" ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "email_log_select_policy" ON public."EmailLog";
DROP POLICY IF EXISTS "deny_direct_insert_email_log" ON public."EmailLog";
DROP POLICY IF EXISTS "deny_direct_update_email_log" ON public."EmailLog";
DROP POLICY IF EXISTS "deny_direct_delete_email_log" ON public."EmailLog";

-- SELECT: Staff of tenant or PLATFORM_ADMIN
CREATE POLICY "email_log_select_policy"
ON public."EmailLog" FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'ACCOUNTANT'])
);

-- Deny direct modifications from clients and anon
CREATE POLICY "deny_direct_insert_email_log"
ON public."EmailLog" AS RESTRICTIVE FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny_direct_update_email_log"
ON public."EmailLog" AS RESTRICTIVE FOR UPDATE
TO anon, authenticated
USING (false);

CREATE POLICY "deny_direct_delete_email_log"
ON public."EmailLog" AS RESTRICTIVE FOR DELETE
TO anon, authenticated
USING (false);

-- ----------------------------------------------------------------------------
-- 6. Dedicated RPC for Email Delivery Logging (Idempotent)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_log_email_delivery(
    p_tenant_id text,
    p_event_type "NotificationType",
    p_recipient_email text,
    p_subject text,
    p_status text,
    p_idempotency_key text,
    p_notification_id text DEFAULT NULL,
    p_order_id text DEFAULT NULL,
    p_recipient_user_id text DEFAULT NULL,
    p_resend_id text DEFAULT NULL,
    p_reason text DEFAULT NULL,
    p_error text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION public.rpc_log_email_delivery FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_log_email_delivery TO authenticated, service_role;
