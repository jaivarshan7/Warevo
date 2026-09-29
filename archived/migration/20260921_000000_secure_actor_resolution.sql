-- Secure resolve_current_actor() helper function
-- Returns the current authenticated user's WMS context based solely on auth.uid()
-- This function is SECURITY DEFINER and must not accept any user-provided identity parameters

CREATE OR REPLACE FUNCTION public.resolve_current_actor()
RETURNS TABLE (
    user_id TEXT,
    tenant_id TEXT,
    role TEXT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Revoke execution from PUBLIC and anon (default access must be removed)
REVOKE ALL ON FUNCTION public.resolve_current_actor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_current_actor() FROM anon;

-- Grant execution only to authenticated users
GRANT EXECUTE ON FUNCTION public.resolve_current_actor() TO authenticated;
