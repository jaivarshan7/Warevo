-- ============================================================================
-- Migration: 20261008_000000_admin_role_management_and_group_scope.sql
-- Description: Admin Role Management RPC, Corporate Group Assignment RPC,
--              and Role-Differentiated Scope (MD/GM group-wide, Manager company-only).
--
-- Preserves:
--   1. Strict User RLS & trg_protect_user_fields (NO direct mutations allowed).
--   2. Phase 6B/6C invoice sequencing, order verification, and storage isolation.
--   3. Tenant boundaries and actor-resolution security.
-- ============================================================================

-- ============================================================================
-- PART 1: rpc_admin_update_user_role
-- Dedicated SECURITY DEFINER RPC for PLATFORM_ADMIN to modify User.role
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_update_user_role(
    p_target_user_id TEXT,
    p_new_role "public"."Role"
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION public.rpc_admin_update_user_role(TEXT, "public"."Role") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_admin_update_user_role(TEXT, "public"."Role") FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_update_user_role(TEXT, "public"."Role") TO authenticated;


-- ============================================================================
-- PART 2: rpc_assign_client_company_group
-- Securely attach, move, or detach a Client Company to/from a Corporate Group
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_assign_client_company_group(
    p_client_id TEXT,
    p_company_group_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION public.rpc_assign_client_company_group(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_assign_client_company_group(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_assign_client_company_group(TEXT, TEXT) TO authenticated;


-- ============================================================================
-- PART 3: Update can_access_client Authorization Helper
-- Enforce: MD/GM -> Group-wide, Manager/Receiver/Store/Account -> Company-only
-- ============================================================================

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

REVOKE ALL ON FUNCTION public.can_access_client(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_client(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_client(TEXT) TO authenticated;


-- ============================================================================
-- PART 4: Update can_read_invoice Authorization Helper
-- Enforce: MD/GM -> Group-wide, Manager/Receiver/Store/Account -> Company-only
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_read_invoice(
    p_invoice_tenant_id TEXT,
    p_invoice_client_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION public.can_read_invoice(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_invoice(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_invoice(TEXT, TEXT) TO authenticated;
