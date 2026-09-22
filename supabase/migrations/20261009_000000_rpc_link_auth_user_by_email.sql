-- ============================================================================
-- Migration: 20261009_000000_rpc_link_auth_user_by_email.sql
-- Description: Phase 7A - Secure OAuth User Account Linkage RPC
--
-- Securely links an authenticated Supabase Auth user (via Google OAuth or Email)
-- to a pre-provisioned WMS User whose supabaseUserId is initially NULL.
--
-- Security Controls:
--   1. SECURITY DEFINER with search_path = public, pg_temp.
--   2. Enforces caller is authenticated (auth.uid() IS NOT NULL).
--   3. Authoritative caller verification: p_auth_user_id must equal auth.uid()::TEXT.
--   4. Browser-supplied email is used solely as a lookup key, never as authorization proof.
--   5. Target WMS User must exist, be ACTIVE, and have an exact case-insensitive email match.
--   6. Rejects if p_auth_user_id is already assigned to a different WMS User.
--   7. Rejects if target WMS User already has a different supabaseUserId linked.
--   8. Updates ONLY supabaseUserId and updatedAt.
--   9. Records an AuditLog entry.
--   10. Revokes execution from PUBLIC and anon; grants EXECUTE to authenticated.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_link_auth_user_by_email(
    p_auth_user_id TEXT,
    p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION public.rpc_link_auth_user_by_email(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_link_auth_user_by_email(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_link_auth_user_by_email(TEXT, TEXT) TO authenticated;
