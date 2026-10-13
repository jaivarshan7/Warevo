-- ============================================================================
-- Migration: 20260928_000000_create_auth_helpers.sql
-- Description: Phase 6B-A - Authorization Helper Functions
--
-- Creates SECURITY DEFINER helper functions for centralized authorization:
--   - is_active_user(): Check if current auth.uid() maps to active WMS user
--   - get_current_actor(): Safe wrapper returning actor context or NULL
--   - can_access_tenant(): Verify tenant access (owner or PLATFORM_ADMIN)
--   - can_access_client(): Verify client access (ownership, companyGroup, admin)
--   - has_role(): Check if actor has one of the allowed roles
--
-- All helpers use SET search_path = public, pg_temp for security.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. is_active_user() - Check if current user is active
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Privileges: authenticated only
REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. get_current_actor() - Safe actor resolution returning NULL if inactive
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_actor()
RETURNS TABLE (
    actor_id TEXT,
    tenant_id TEXT,
    role TEXT,
    status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Privileges: authenticated only
REVOKE ALL ON FUNCTION public.get_current_actor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_actor() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_actor() TO authenticated;


-- ----------------------------------------------------------------------------
-- 3. can_access_tenant() - Verify tenant boundary access
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_tenant(p_target_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Privileges: authenticated only
REVOKE ALL ON FUNCTION public.can_access_tenant(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_tenant(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_tenant(TEXT) TO authenticated;


-- ----------------------------------------------------------------------------
-- 4. can_access_client() - Verify client/companyGroup access
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_client(p_target_client_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_client_tenant_id TEXT;
    v_client_company_group_id TEXT;
    v_actor_client_id TEXT;
    v_actor_company_group_id TEXT;
    v_group_match BOOLEAN;
BEGIN
    -- Get current actor
    SELECT * INTO v_actor FROM public.get_current_actor();

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- PLATFORM_ADMIN → full access
    IF v_actor.role = 'PLATFORM_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- Fetch target client details
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

    -- Staff roles → full tenant client access
    IF v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'ACCOUNTANT', 'ACCOUNTS_TEAM', 'WAREHOUSE_STAFF') THEN
        RETURN TRUE;
    END IF;

    -- Client roles → scoped access
    IF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT', 'PRODUCT_RECEIVER', 'MANAGER', 'GM', 'MD') THEN
        -- Find actor's linked client
        SELECT c."id", c."companyGroupId"
        INTO v_actor_client_id, v_actor_company_group_id
        FROM public."Client" c
        WHERE c."userId" = v_actor.actor_id;

        IF NOT FOUND THEN
            RETURN FALSE;
        END IF;

        -- Direct client match
        IF p_target_client_id = v_actor_client_id THEN
            RETURN TRUE;
        END IF;

        -- Company group match
        IF v_actor_company_group_id IS NOT NULL AND v_client_company_group_id = v_actor_company_group_id THEN
            RETURN TRUE;
        END IF;

        -- No match → denied
        RETURN FALSE;
    END IF;

    -- Other roles → denied
    RETURN FALSE;
END;
$$;

-- Privileges: authenticated only
REVOKE ALL ON FUNCTION public.can_access_client(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_client(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_client(TEXT) TO authenticated;


-- ----------------------------------------------------------------------------
-- 5. has_role() - Check if actor has one of the allowed roles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(p_allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Privileges: authenticated only
REVOKE ALL ON FUNCTION public.has_role(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(TEXT[]) TO authenticated;
