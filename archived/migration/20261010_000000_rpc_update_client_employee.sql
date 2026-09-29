-- ============================================================================
-- Migration: 20261010_000000_rpc_update_client_employee.sql
-- Description: Phase 8A - Dedicated SECURITY DEFINER RPC for Client Employee Management
--
-- Features:
--   1. Reuses authoritative get_current_actor() for caller resolution.
--   2. Restricts management authority to PLATFORM_ADMIN and WAREHOUSE_OWNER.
--   3. Enforces tenant isolation.
--   4. Validates company reassignment: target company must exist in SAME tenant.
--      Cross-tenant reassignment is strictly rejected.
--   5. Atomically synchronizes linked User status, name, mobile, email
--      while strictly preserving User.id and User.supabaseUserId.
--   6. Explicit update semantics for optional fields.
--   7. Writes complete AuditLog entry.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_update_client_employee(
    p_client_employee_id TEXT,
    p_contact_person TEXT DEFAULT NULL,
    p_mobile TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_new_client_id TEXT DEFAULT NULL,
    p_new_employee_role "public"."ClientEmployeeRole" DEFAULT NULL,
    p_new_status "public"."UserStatus" DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session_actor RECORD;
    v_target_ce RECORD;
    v_target_client RECORD;
    v_prev_value JSONB;
    v_new_value JSONB;
    v_new_contact_person TEXT;
    v_new_mobile TEXT;
    v_new_email TEXT;
    v_new_client_id TEXT;
    v_new_employee_role "public"."ClientEmployeeRole";
    v_new_status "public"."UserStatus";
BEGIN
    -- 1. Resolve session actor via existing authoritative get_current_actor()
    SELECT * INTO v_session_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_session_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- 2. Enforce narrowest employee management authority: PLATFORM_ADMIN or WAREHOUSE_OWNER only
    IF v_session_actor.role NOT IN ('PLATFORM_ADMIN', 'WAREHOUSE_OWNER') THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot manage employees', v_session_actor.role;
    END IF;

    -- 3. Resolve target ClientEmployee
    SELECT * INTO v_target_ce FROM public."ClientEmployee" WHERE "id" = p_client_employee_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client employee % not found', p_client_employee_id;
    END IF;

    -- 4. Enforce tenant isolation for non-PLATFORM_ADMIN
    IF v_session_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_session_actor.tenant_id IS NULL OR v_session_actor.tenant_id != v_target_ce."tenantId" THEN
            RAISE EXCEPTION 'Tenant isolation violation: actor tenant % does not match employee tenant %',
                v_session_actor.tenant_id, v_target_ce."tenantId";
        END IF;
    END IF;

    -- 5. Calculate new field values with explicit update semantics
    -- Contact Person: if provided, must be non-empty
    IF p_contact_person IS NOT NULL THEN
        IF LENGTH(TRIM(p_contact_person)) = 0 THEN
            RAISE EXCEPTION 'Contact person name cannot be empty';
        END IF;
        v_new_contact_person := TRIM(p_contact_person);
    ELSE
        v_new_contact_person := v_target_ce."contactPerson";
    END IF;

    -- Mobile: if provided, must be non-empty
    IF p_mobile IS NOT NULL THEN
        IF LENGTH(TRIM(p_mobile)) = 0 THEN
            RAISE EXCEPTION 'Mobile number cannot be empty';
        END IF;
        v_new_mobile := TRIM(p_mobile);
    ELSE
        v_new_mobile := v_target_ce."mobile";
    END IF;

    -- Email: empty string clears it, non-empty sets normalized email
    IF p_email IS NOT NULL THEN
        v_new_email := NULLIF(LOWER(TRIM(p_email)), '');
    ELSE
        v_new_email := v_target_ce."email";
    END IF;

    -- Client Company: if provided and different, validate target company exists in SAME tenant
    IF p_new_client_id IS NOT NULL AND p_new_client_id != v_target_ce."clientId" THEN
        SELECT * INTO v_target_client FROM public."Client" WHERE "id" = p_new_client_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target client company % not found', p_new_client_id;
        END IF;

        IF v_target_client."tenantId" != v_target_ce."tenantId" THEN
            RAISE EXCEPTION 'Cross-tenant company reassignment is strictly prohibited: target client tenant % does not match employee tenant %',
                v_target_client."tenantId", v_target_ce."tenantId";
        END IF;

        v_new_client_id := p_new_client_id;
    ELSE
        v_new_client_id := v_target_ce."clientId";
    END IF;

    -- Employee Role: if provided, update
    IF p_new_employee_role IS NOT NULL THEN
        v_new_employee_role := p_new_employee_role;
    ELSE
        v_new_employee_role := v_target_ce."employeeRole";
    END IF;

    -- Status: if provided, update
    IF p_new_status IS NOT NULL THEN
        v_new_status := p_new_status;
    ELSE
        v_new_status := v_target_ce."status";
    END IF;

    -- 6. Capture previous state for AuditLog
    v_prev_value := to_jsonb(v_target_ce);

    -- 7. Update ClientEmployee record
    UPDATE public."ClientEmployee"
    SET
        "contactPerson" = v_new_contact_person,
        "mobile"        = v_new_mobile,
        "email"         = v_new_email,
        "clientId"      = v_new_client_id,
        "employeeRole"  = v_new_employee_role,
        "status"        = v_new_status,
        "updatedAt"     = CURRENT_TIMESTAMP
    WHERE "id" = p_client_employee_id;

    -- 8. Synchronize linked WMS User record if present
    -- User.id, User.supabaseUserId, User.role, and User.tenantId are PRESERVED and NEVER modified!
    IF v_target_ce."userId" IS NOT NULL THEN
        UPDATE public."User"
        SET
            "name"      = v_new_contact_person,
            "mobile"    = v_new_mobile,
            "email"     = COALESCE(v_new_email, "email"),
            "status"    = v_new_status,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = v_target_ce."userId";
    END IF;

    -- 9. Reload updated ClientEmployee record for AuditLog and return payload
    SELECT * INTO v_target_ce FROM public."ClientEmployee" WHERE "id" = p_client_employee_id;
    v_new_value := to_jsonb(v_target_ce);

    -- 10. Record in AuditLog
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId",
        "previousValue", "newValue", "createdAt"
    ) VALUES (
        'audit_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
        v_target_ce."tenantId",
        v_session_actor.actor_id,
        v_session_actor.role::"Role",
        'UPDATE_CLIENT_EMPLOYEE',
        'ClientEmployee',
        p_client_employee_id,
        v_prev_value,
        v_new_value,
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'clientEmployeeId', p_client_employee_id,
        'userId', v_target_ce."userId",
        'clientId', v_target_ce."clientId",
        'employeeRole', v_target_ce."employeeRole",
        'status', v_target_ce."status"
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_client_employee(TEXT, TEXT, TEXT, TEXT, TEXT, "public"."ClientEmployeeRole", "public"."UserStatus") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_update_client_employee(TEXT, TEXT, TEXT, TEXT, TEXT, "public"."ClientEmployeeRole", "public"."UserStatus") FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_client_employee(TEXT, TEXT, TEXT, TEXT, TEXT, "public"."ClientEmployeeRole", "public"."UserStatus") TO authenticated;
