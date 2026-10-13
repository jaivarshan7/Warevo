-- ============================================================================
-- Migration: 20261020_000000_get_email_sent_count_rpc.sql
-- Description:
--   Secure database aggregate RPC rpc_get_email_sent_count to return
--   successfully sent email counts without client-side row exfiltration.
--   - PLATFORM_ADMIN: platform-wide count (p_tenant_id is NULL) or tenant count.
--   - WAREHOUSE users: scoped strictly to authenticated tenant. Rejects cross-tenant.
--   - Counts only EmailLog.status = 'SENT'. Ignores PENDING, SKIPPED, FAILED.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_email_sent_count(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_user RECORD;
    v_caller_role text;
    v_caller_tenant text;
    v_target_tenant text;
    v_count bigint;
BEGIN
    -- 1. Validate auth.uid()
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    -- 2. Resolve the authenticated WMS User
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF v_actor.actor_id IS NOT NULL THEN
        v_caller_role := v_actor.role;
        v_caller_tenant := v_actor.tenant_id;
    ELSE
        SELECT * INTO v_user FROM public."User" WHERE "supabaseUserId" = auth.uid()::text;
        IF v_user.id IS NOT NULL AND v_user.status = 'ACTIVE' THEN
            v_caller_role := v_user.role::text;
            v_caller_tenant := v_user."tenantId";
        ELSE
            RAISE EXCEPTION 'Authenticated user not found or inactive' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 3. Validate role and enforce tenant boundary
    IF v_caller_role = 'PLATFORM_ADMIN' THEN
        -- PLATFORM_ADMIN: can request platform-wide (p_tenant_id IS NULL) or specific tenant
        IF p_tenant_id IS NOT NULL THEN
            v_target_tenant := p_tenant_id::text;
        ELSE
            v_target_tenant := NULL;
        END IF;
    ELSIF v_caller_role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'ACCOUNTANT', 'ACCOUNTS_TEAM') THEN
        -- Warehouse users: must only be able to request their own tenant
        IF p_tenant_id IS NOT NULL AND p_tenant_id::text <> v_caller_tenant THEN
            RAISE EXCEPTION 'Unauthorized: cross-tenant access denied' USING ERRCODE = '42501';
        END IF;
        v_target_tenant := v_caller_tenant;
    ELSE
        -- CLIENT and unauthorized roles are denied
        RAISE EXCEPTION 'Unauthorized: insufficient permissions to view email metrics' USING ERRCODE = '42501';
    END IF;

    -- 4. Count only EmailLog.status = 'SENT'
    IF v_target_tenant IS NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM public."EmailLog"
        WHERE "status" = 'SENT';
    ELSE
        SELECT COUNT(*) INTO v_count
        FROM public."EmailLog"
        WHERE "status" = 'SENT'
          AND "tenantId" = v_target_tenant;
    END IF;

    RETURN COALESCE(v_count, 0);
END;
$$;

-- Privileges: authenticated only
ALTER FUNCTION public.rpc_get_email_sent_count(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_email_sent_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_email_sent_count(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_email_sent_count(UUID) TO authenticated;
