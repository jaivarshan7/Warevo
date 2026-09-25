-- Migration: 20261016_000000_inventory_timestamps_and_stock_rpc.sql
-- Description: Ensure Inventory has createdAt and updatedAt with defaults and triggers,
--              harden rpc_receive_or_adjust_stock and add rpc_init_inventory_item.

-- 1. Ensure Inventory table has createdAt and updatedAt with valid defaults and non-null constraints
ALTER TABLE public."Inventory" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public."Inventory" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public."Inventory" ADD COLUMN IF NOT EXISTS "quantity" INTEGER DEFAULT 0;

-- Backfill any existing NULL values
UPDATE public."Inventory" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE public."Inventory" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
UPDATE public."Inventory" SET "quantity" = "totalQuantity" WHERE "quantity" IS NULL OR "quantity" = 0;

-- 2. Trigger on Inventory to guarantee updatedAt is always updated and timestamps are never null
CREATE OR REPLACE FUNCTION public.trg_set_inventory_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."createdAt" IS NULL THEN
            NEW."createdAt" := CURRENT_TIMESTAMP;
        END IF;
        IF NEW."updatedAt" IS NULL THEN
            NEW."updatedAt" := CURRENT_TIMESTAMP;
        END IF;
        IF NEW."quantity" IS NOT NULL AND NEW."quantity" > 0 AND (NEW."totalQuantity" IS NULL OR NEW."totalQuantity" = 0) THEN
            NEW."totalQuantity" := NEW."quantity";
            NEW."availableQuantity" := NEW."quantity";
        ELSIF NEW."totalQuantity" IS NOT NULL THEN
            NEW."quantity" := NEW."totalQuantity";
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW."updatedAt" := CURRENT_TIMESTAMP;
        IF NEW."totalQuantity" IS NOT NULL THEN
            NEW."quantity" := NEW."totalQuantity";
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_timestamps ON public."Inventory";
CREATE TRIGGER trg_inventory_timestamps
BEFORE INSERT OR UPDATE ON public."Inventory"
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_inventory_timestamps();

-- 3. Replace rpc_receive_or_adjust_stock with authoritative actor, product resolution, and timestamp management
CREATE OR REPLACE FUNCTION public.rpc_receive_or_adjust_stock(
    p_inventory_id TEXT,
    p_quantity INTEGER,
    p_type "InventoryMovementType",
    p_notes TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL,
    p_user_role "Role" DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_effective_user_id TEXT;
    v_effective_user_role "Role";
    v_inv RECORD;
    v_prod RECORD;
    v_new_available INTEGER;
    v_new_total INTEGER;
    v_new_damaged INTEGER;
    v_movement_id TEXT;
    v_default_warehouse_id TEXT;
    v_default_location_id TEXT;
    v_inv_id TEXT;
BEGIN
    -- Resolve authenticated actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- Authorize warehouse management roles
    IF NOT (v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'PLATFORM_ADMIN')) THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot perform stock adjustments', v_actor.role;
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    -- 1. Try to find Inventory record by id
    SELECT * INTO v_inv FROM "Inventory" WHERE "id" = p_inventory_id;
    
    -- 2. If not found by inventory id, check if p_inventory_id is a Product id
    IF NOT FOUND THEN
        SELECT * INTO v_prod FROM "Product" WHERE "id" = p_inventory_id;
        IF FOUND THEN
            -- Tenant isolation check on Product
            IF v_actor.role != 'PLATFORM_ADMIN' AND v_actor.tenant_id != v_prod."tenantId" THEN
                RAISE EXCEPTION 'Tenant authorization failure: product belongs to another tenant';
            END IF;

            -- Check if an Inventory row already exists for this product
            SELECT * INTO v_inv FROM "Inventory" 
            WHERE "productId" = v_prod."id" 
              AND "tenantId" = v_prod."tenantId"
            ORDER BY "createdAt" ASC LIMIT 1;

            -- If still no inventory row, create one
            IF NOT FOUND THEN
                SELECT "id" INTO v_default_warehouse_id 
                FROM "Warehouse" 
                WHERE "tenantId" = v_prod."tenantId" 
                ORDER BY "createdAt" ASC LIMIT 1;

                SELECT "id" INTO v_default_location_id 
                FROM "WarehouseLocation" 
                WHERE "warehouseId" = v_default_warehouse_id 
                LIMIT 1;

                v_inv_id := concat('inv_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
                
                INSERT INTO "Inventory" (
                    "id", "tenantId", "warehouseId", "productId", "locationId",
                    "totalQuantity", "availableQuantity", "reservedQuantity", "damagedQuantity",
                    "quantity", "createdAt", "updatedAt"
                ) VALUES (
                    v_inv_id,
                    v_prod."tenantId",
                    v_default_warehouse_id,
                    v_prod."id",
                    v_default_location_id,
                    0, 0, 0, 0,
                    0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING * INTO v_inv;
            END IF;
        ELSE
            RAISE EXCEPTION 'Inventory record % not found', p_inventory_id;
        END IF;
    END IF;

    -- Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id != v_inv."tenantId" THEN
            RAISE EXCEPTION 'Tenant authorization failure: inventory belongs to another tenant';
        END IF;
    END IF;

    -- Authoritative actor identity
    v_effective_user_id := v_actor.actor_id;
    v_effective_user_role := v_actor.role::"Role";

    IF p_type = 'DAMAGE' THEN
        v_new_available := v_inv."availableQuantity" - p_quantity;
        v_new_total := v_inv."totalQuantity";
        v_new_damaged := v_inv."damagedQuantity" + p_quantity;
    ELSE
        v_new_available := v_inv."availableQuantity" + p_quantity;
        v_new_total := v_inv."totalQuantity" + p_quantity;
        v_new_damaged := v_inv."damagedQuantity";
    END IF;

    IF v_new_available < 0 THEN
        RAISE EXCEPTION 'Insufficient available stock. Cannot reduce stock below 0.';
    END IF;

    -- Update inventory with explicit updatedAt
    UPDATE "Inventory"
    SET "availableQuantity" = v_new_available,
        "totalQuantity" = v_new_total,
        "damagedQuantity" = v_new_damaged,
        "quantity" = v_new_total,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_inv."id";

    -- Create movement record
    v_movement_id := concat('mov_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    INSERT INTO "InventoryMovement" (
        "id", "tenantId", "inventoryId", "productId", "type",
        "quantity", "previousQuantity", "newQuantity", "notes", "createdById", "createdAt"
    )
    VALUES (
        v_movement_id,
        v_inv."tenantId",
        v_inv."id",
        v_inv."productId",
        p_type,
        p_quantity,
        v_inv."availableQuantity",
        v_new_available,
        p_notes,
        v_effective_user_id,
        CURRENT_TIMESTAMP
    );

    -- Log audit
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_inv."tenantId",
        v_effective_user_id,
        v_effective_user_role,
        'Recorded stock movement',
        'Inventory',
        v_inv."id",
        jsonb_build_object('availableQuantity', v_inv."availableQuantity"),
        jsonb_build_object('availableQuantity', v_new_available, 'type', p_type),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'inventoryId', v_inv."id",
        'movementId', v_movement_id,
        'availableQuantity', v_new_available,
        'totalQuantity', v_new_total
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_receive_or_adjust_stock(text,integer,"InventoryMovementType",text,text,"Role") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_receive_or_adjust_stock(text,integer,"InventoryMovementType",text,text,"Role") FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_receive_or_adjust_stock(text,integer,"InventoryMovementType",text,text,"Role") TO authenticated;

-- 4. New secure RPC: rpc_init_inventory_item
CREATE OR REPLACE FUNCTION public.rpc_init_inventory_item(
    p_product_id TEXT,
    p_warehouse_id TEXT,
    p_location_id TEXT DEFAULT NULL,
    p_initial_quantity INTEGER DEFAULT 0,
    p_notes TEXT DEFAULT 'Initial stock intake'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_prod RECORD;
    v_inv_id TEXT;
    v_movement_id TEXT;
    v_qty INTEGER;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    IF NOT (v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'PLATFORM_ADMIN')) THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot initialize inventory', v_actor.role;
    END IF;

    SELECT * INTO v_prod FROM "Product" WHERE "id" = p_product_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found', p_product_id;
    END IF;

    IF v_actor.role != 'PLATFORM_ADMIN' AND v_actor.tenant_id != v_prod."tenantId" THEN
        RAISE EXCEPTION 'Tenant authorization failure: product belongs to another tenant';
    END IF;

    v_qty := GREATEST(0, COALESCE(p_initial_quantity, 0));
    v_inv_id := concat('inv_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

    INSERT INTO "Inventory" (
        "id", "tenantId", "warehouseId", "productId", "locationId",
        "totalQuantity", "availableQuantity", "reservedQuantity", "damagedQuantity",
        "quantity", "createdAt", "updatedAt"
    ) VALUES (
        v_inv_id,
        v_prod."tenantId",
        p_warehouse_id,
        p_product_id,
        p_location_id,
        v_qty,
        v_qty,
        0,
        0,
        v_qty,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

    IF v_qty > 0 THEN
        v_movement_id := concat('mov_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
        INSERT INTO "InventoryMovement" (
            "id", "tenantId", "inventoryId", "productId", "type",
            "quantity", "previousQuantity", "newQuantity", "notes", "createdById", "createdAt"
        ) VALUES (
            v_movement_id,
            v_prod."tenantId",
            v_inv_id,
            p_product_id,
            'RECEIPT',
            v_qty,
            0,
            v_qty,
            p_notes,
            v_actor.actor_id,
            CURRENT_TIMESTAMP
        );

        INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
        VALUES (
            concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            v_prod."tenantId",
            v_actor.actor_id,
            v_actor.role::"Role",
            'Initial stock intake',
            'Inventory',
            v_inv_id,
            jsonb_build_object('availableQuantity', 0),
            jsonb_build_object('availableQuantity', v_qty, 'type', 'RECEIPT'),
            CURRENT_TIMESTAMP
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'inventoryId', v_inv_id,
        'productId', p_product_id,
        'quantity', v_qty
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_init_inventory_item(text,text,text,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_init_inventory_item(text,text,text,integer,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_init_inventory_item(text,text,text,integer,text) TO authenticated;
