-- ============================================================================
-- Migration: 20261014_000000_phase9_notification_email_workflow.sql
-- Description: Phase 9 — Production Notification & Email Workflow RPCs
--
-- Features:
--   - Secure, server-side validated RPC for in-app notifications
--   - Actor authentication and tenant boundary enforcement
--   - Active recipient user verification
--   - Deduplication protection for notification events
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_create_notification(
    p_tenant_id TEXT,
    p_order_id TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL,
    p_type TEXT DEFAULT 'NEW_ORDER',
    p_title TEXT DEFAULT 'Notification',
    p_message TEXT DEFAULT '',
    p_action_url TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT 'normal'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Permissions
REVOKE ALL ON FUNCTION public.rpc_create_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_create_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
