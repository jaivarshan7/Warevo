-- ============================================================================
-- Migration: 20261002_000000_enable_rls_notifications_audit.sql
-- Description: Phase 6B - Secure Notification and AuditLog Access
--
-- Features:
--   - Scoped SELECT on Notification and AuditLog
--   - Hardened UPDATE on Notification (only marking read = true)
--   - BEFORE UPDATE trigger on Notification preventing column tampering
--   - Dedicated rpc_mark_notification_read helper
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Notification
-- ----------------------------------------------------------------------------
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;

-- Read notifications: Staff for tenant, or recipient user / client
CREATE POLICY "notification_select_policy"
ON public."Notification"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND (
        public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
        OR "userId" = (SELECT actor_id FROM public.get_current_actor())
        OR EXISTS (
            SELECT 1 FROM public."Order" o
            WHERE o."id" = "Notification"."orderId"
              AND public.can_access_client(o."clientId")
        )
    )
);

-- Update read status: Users can only mark their own notifications as read
CREATE POLICY "notification_update_read_policy"
ON public."Notification"
FOR UPDATE
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND (
        "userId" = (SELECT actor_id FROM public.get_current_actor())
        OR public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
    )
)
WITH CHECK (
    "read" = true
);

-- Trigger: Prevent authenticated callers from modifying arbitrary notification columns
CREATE OR REPLACE FUNCTION public.protect_notification_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

DROP TRIGGER IF EXISTS trg_protect_notification_fields ON public."Notification";
CREATE TRIGGER trg_protect_notification_fields
BEFORE UPDATE ON public."Notification"
FOR EACH ROW
EXECUTE FUNCTION public.protect_notification_fields();

-- Dedicated secure RPC for marking notification as read
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

    IF v_actor.role != 'PLATFORM_ADMIN' AND v_actor.tenant_id != v_notif."tenantId" THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied');
    END IF;

    UPDATE public."Notification"
    SET "read" = true,
        "readAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_notification_id;

    RETURN jsonb_build_object('success', true, 'notificationId', p_notification_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_mark_notification_read(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_mark_notification_read(text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. AuditLog
-- ----------------------------------------------------------------------------
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_policy"
ON public."AuditLog"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'ACCOUNTANT'])
);

-- Allow authenticated insertion within own tenant (for initial catalog product intake)
CREATE POLICY "audit_log_insert_policy"
ON public."AuditLog"
FOR INSERT
TO authenticated
WITH CHECK (
    public.can_access_tenant("tenantId")
);
