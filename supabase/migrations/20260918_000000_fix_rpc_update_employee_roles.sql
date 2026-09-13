-- ============================================================================
-- Migration: 20260918_000000_fix_rpc_update_employee_roles.sql
-- Description: Update rpc_update_employee to only use valid PostgreSQL "Role" enum values
--              (removes non-existent 'PRODUCT_RECEIVER' which caused 22P02 error)
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_update_employee(
    p_actor_id       TEXT,           -- The user making the change
    p_actor_role     "Role",         -- Stated actor role (validated against DB record)
    p_target_id      TEXT,           -- The employee being updated
    p_name           TEXT DEFAULT NULL,
    p_email          TEXT DEFAULT NULL,
    p_mobile         TEXT DEFAULT NULL,
    p_new_role       "Role" DEFAULT NULL,
    p_new_status     "UserStatus" DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION rpc_update_employee TO anon, authenticated, service_role;
