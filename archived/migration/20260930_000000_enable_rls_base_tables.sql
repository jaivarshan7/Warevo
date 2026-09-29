-- ============================================================================
-- Migration: 20260930_000000_enable_rls_base_tables.sql
-- Description: Phase 6B - Base Tables RLS and Protected User Linking
--
-- Tables secured:
--   - Tenant
--   - CompanyGroup
--   - Client
--   - User (with strict AuthCallback linking trigger & policy)
--   - Warehouse, WarehouseLocation, WarehouseSetting
--   - PlatformSetting
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tenant
-- ----------------------------------------------------------------------------
ALTER TABLE public."Tenant" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_policy"
ON public."Tenant"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("id")
);

CREATE POLICY "tenant_admin_mutation_policy"
ON public."Tenant"
FOR ALL
TO authenticated
USING (
    public.has_role(ARRAY['PLATFORM_ADMIN'])
)
WITH CHECK (
    public.has_role(ARRAY['PLATFORM_ADMIN'])
);


-- ----------------------------------------------------------------------------
-- 2. CompanyGroup
-- ----------------------------------------------------------------------------
ALTER TABLE public."CompanyGroup" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_group_select_policy"
ON public."CompanyGroup"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "company_group_staff_mutation_policy"
ON public."CompanyGroup"
FOR ALL
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR'])
)
WITH CHECK (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR'])
);


-- ----------------------------------------------------------------------------
-- 3. Client
-- ----------------------------------------------------------------------------
ALTER TABLE public."Client" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_select_policy"
ON public."Client"
FOR SELECT
TO authenticated
USING (
    public.can_access_client("id")
);

CREATE POLICY "client_staff_mutation_policy"
ON public."Client"
FOR ALL
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
)
WITH CHECK (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
);


-- ----------------------------------------------------------------------------
-- 4. User
-- ----------------------------------------------------------------------------
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

-- Read: own profile or tenant users for staff
CREATE POLICY "user_select_policy"
ON public."User"
FOR SELECT
TO authenticated
USING (
    "supabaseUserId" = auth.uid()::TEXT
    OR public.can_access_tenant("tenantId")
);

-- Narrow update for AuthCallback initial account linkage ONLY:
-- Allows authenticated user to link their own supabaseUserId when currently NULL
CREATE POLICY "user_auth_callback_link_policy"
ON public."User"
FOR UPDATE
TO authenticated
USING (
    "email" = (auth.jwt() ->> 'email')
    AND "supabaseUserId" IS NULL
)
WITH CHECK (
    "supabaseUserId" = auth.uid()::TEXT
);

-- Trigger: Strictly protect User authorization columns from direct frontend tampering
CREATE OR REPLACE FUNCTION public.protect_user_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Only enforce restrictions for direct calls from authenticated role
    IF current_user != 'authenticated' THEN
        RETURN NEW;
    END IF;

    -- Allow ONLY initial linkage of supabaseUserId where OLD was NULL and NEW matches auth.uid()
    IF OLD."supabaseUserId" IS NULL AND NEW."supabaseUserId" = auth.uid()::TEXT THEN
        -- Strictly verify that NO authorization or profile fields are modified
        IF NEW."id" != OLD."id" OR
           NEW."tenantId" IS DISTINCT FROM OLD."tenantId" OR
           NEW."email" != OLD."email" OR
           NEW."role" != OLD."role" OR
           NEW."status" != OLD."status" OR
           NEW."name" != OLD."name" OR
           NEW."mobile" IS DISTINCT FROM OLD."mobile" THEN
            RAISE EXCEPTION 'Direct user update may only set supabaseUserId';
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Direct modification of User is forbidden. Use appropriate RPCs.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_fields ON public."User";
CREATE TRIGGER trg_protect_user_fields
BEFORE UPDATE ON public."User"
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_fields();


-- ----------------------------------------------------------------------------
-- 5. Warehouse, WarehouseLocation, WarehouseSetting
-- ----------------------------------------------------------------------------
ALTER TABLE public."Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WarehouseLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WarehouseSetting" ENABLE ROW LEVEL SECURITY;

-- Warehouse
CREATE POLICY "warehouse_select_policy"
ON public."Warehouse"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "warehouse_staff_mutation_policy"
ON public."Warehouse"
FOR ALL
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR'])
)
WITH CHECK (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR'])
);

-- WarehouseLocation
CREATE POLICY "warehouse_location_select_policy"
ON public."WarehouseLocation"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "warehouse_location_staff_mutation_policy"
ON public."WarehouseLocation"
FOR ALL
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
)
WITH CHECK (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF'])
);

-- WarehouseSetting
CREATE POLICY "warehouse_setting_select_policy"
ON public."WarehouseSetting"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
);

CREATE POLICY "warehouse_setting_staff_mutation_policy"
ON public."WarehouseSetting"
FOR ALL
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR'])
)
WITH CHECK (
    public.can_access_tenant("tenantId")
    AND public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR'])
);


-- ----------------------------------------------------------------------------
-- 6. PlatformSetting
-- ----------------------------------------------------------------------------
ALTER TABLE public."PlatformSetting" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_setting_select_policy"
ON public."PlatformSetting"
FOR SELECT
TO authenticated
USING (
    public.is_active_user()
);

CREATE POLICY "platform_setting_admin_mutation_policy"
ON public."PlatformSetting"
FOR ALL
TO authenticated
USING (
    public.has_role(ARRAY['PLATFORM_ADMIN'])
)
WITH CHECK (
    public.has_role(ARRAY['PLATFORM_ADMIN'])
);
