-- ============================================================================
-- Migration: 20261017_000000_fix_rpc_get_my_permissions_quoting.sql
-- Description: Fix unquoted identifier bug in rpc_get_my_permissions().
--              "systemRole" and "name" must be quoted with double quotes
--              to prevent PostgreSQL lowercase folding error (42703).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_my_permissions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION public.rpc_get_my_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_my_permissions() FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_my_permissions() TO authenticated;
