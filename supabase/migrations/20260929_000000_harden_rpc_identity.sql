-- ============================================================================
-- Migration: 20260929_000000_harden_rpc_identity.sql
-- Description: Phase 6B - Harden RPC Identity, Tenant Isolation, and Search Path
--
-- Hardens 6 production RPC functions:
--   1. rpc_create_order_with_invoice (10 args, RETURNS jsonb)
--   2. rpc_transition_order (5 args, RETURNS jsonb)
--   3. rpc_receive_or_adjust_stock (6 args, RETURNS jsonb)
--   4. rpc_update_employee (8 args, RETURNS jsonb)
--   5. rpc_submit_verification (6 args, RETURNS jsonb)
--   6. rpc_generate_invoice (4 args, RETURNS jsonb)
--
-- Exact existing argument types, parameter order, return types, and business logic
-- are 100% preserved from the remote PostgreSQL catalog.
--
-- Security changes:
--   - Set search_path = public, pg_temp
--   - Resolve actor through get_current_actor() via auth.uid()
--   - Enforce tenant boundaries server-side
--   - Prevent caller identity/tenant spoofing
--   - Revoke execution from PUBLIC and anon; grant to authenticated
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. rpc_create_order_with_invoice
-- Exact 10-parameter signature from remote catalog:
-- (text, text, text, text[], text, timestamptz, text, "OrderStatus", jsonb, jsonb) -> jsonb
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_create_order_with_invoice(
    p_tenant_id text,
    p_client_id text,
    p_created_by_id text,
    p_selected_contact_ids text[],
    p_assigned_staff_id text DEFAULT NULL::text,
    p_expected_delivery timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_notes text DEFAULT NULL::text,
    p_status "OrderStatus" DEFAULT 'ISSUED'::"OrderStatus",
    p_eway_bill jsonb DEFAULT NULL::jsonb,
    p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_actor RECORD;
    v_created_by_id TEXT;
    v_staff_tenant_id TEXT;
    v_order_id TEXT;
    v_order_number TEXT;
    v_order_date TIMESTAMPTZ := CURRENT_TIMESTAMP;
    v_subtotal NUMERIC(12, 2) := 0;
    v_tax_total NUMERIC(12, 2) := 0;
    v_discount_total NUMERIC(12, 2) := 0;
    v_total_amount NUMERIC(12, 2) := 0;
    v_last_order_num INTEGER := 0;
    v_next_order_num INTEGER := 1;
    v_invoice_id TEXT;
    v_invoice_number TEXT;
    v_latest_invoice_num INTEGER := 0;
    v_status "InvoiceStatus" := 'FINAL';
    v_cgst NUMERIC(12, 2) := 0;
    v_sgst NUMERIC(12, 2) := 0;
    v_item JSONB;
    v_item_subtotal NUMERIC(12, 2);
    v_item_tax NUMERIC(12, 2);
    v_item_discount NUMERIC(12, 2);
    v_item_total NUMERIC(12, 2);
    v_item_order_id TEXT;
    v_invoice_item_id TEXT;
    v_item_quantity INTEGER;
    v_item_unit_price NUMERIC(12, 2);
    v_item_tax_rate NUMERIC(12, 2);
    v_order_history_id TEXT;
    v_audit_log_id TEXT;
    v_warehouse_setting RECORD;
    v_contact_id TEXT;
    v_user_id TEXT;
    v_notification_id TEXT;
BEGIN
    -- 1. Resolve current actor securely from database session
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- 2. Enforce tenant isolation: PLATFORM_ADMIN can operate cross-tenant, others strictly matched
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id != p_tenant_id THEN
            RAISE EXCEPTION 'Tenant authorization failure: actor cannot create order for tenant %', p_tenant_id;
        END IF;
    END IF;

    -- Authoritative creator identity from session
    v_created_by_id := v_actor.actor_id;

    -- Validate tenant exists
    IF NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "id" = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
    END IF;

    -- Validate client exists and actor has access to this client
    IF NOT EXISTS (SELECT 1 FROM "Client" WHERE "id" = p_client_id) THEN
        RAISE EXCEPTION 'Client % not found', p_client_id;
    END IF;

    IF NOT public.can_access_client(p_client_id) THEN
        RAISE EXCEPTION 'Access denied: client % is not authorized for current user', p_client_id;
    END IF;

    -- Validate assigned_staff if provided
    IF p_assigned_staff_id IS NOT NULL AND p_assigned_staff_id != '' THEN
        SELECT "tenantId" INTO v_staff_tenant_id FROM "User" WHERE "id" = p_assigned_staff_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Assigned staff % not found', p_assigned_staff_id;
        END IF;
        IF v_actor.role != 'PLATFORM_ADMIN' AND v_staff_tenant_id != p_tenant_id THEN
            RAISE EXCEPTION 'Assigned staff % does not belong to tenant %', p_assigned_staff_id, p_tenant_id;
        END IF;
    END IF;

    -- Get warehouse settings for order/invoice prefixes
    SELECT * INTO v_warehouse_setting
    FROM "WarehouseSetting"
    WHERE "tenantId" = p_tenant_id
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warehouse settings not found for tenant %', p_tenant_id;
    END IF;

    -- Generate order number
    SELECT COALESCE(
        MAX(
            SUBSTRING(
                "orderNumber"
                FROM v_warehouse_setting."orderPrefix" || '-2026-([0-9]+)'
            )::INTEGER
        ),
        0
    )
    INTO v_last_order_num
    FROM "Order"
    WHERE "tenantId" = p_tenant_id
      AND "orderNumber" LIKE v_warehouse_setting."orderPrefix" || '-2026-%';

    v_next_order_num := v_last_order_num + 1;
    v_order_number :=
        v_warehouse_setting."orderPrefix"
        || '-2026-'
        || LPAD(v_next_order_num::TEXT, 6, '0');

    -- Calculate totals from items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_subtotal :=
            (v_item->>'quantity')::NUMERIC
            * (v_item->>'unitPrice')::NUMERIC
            - COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_item_tax :=
            v_item_subtotal
            * (v_item->>'taxRate')::NUMERIC
            / 100;

        v_item_discount :=
            COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_subtotal := v_subtotal + v_item_subtotal;
        v_tax_total := v_tax_total + v_item_tax;
        v_discount_total := v_discount_total + v_item_discount;
    END LOOP;

    v_total_amount := v_subtotal + v_tax_total;

    -- Generate IDs
    v_order_id :=
        concat(
            'ord_',
            substr(md5(random()::text || clock_timestamp()::text), 1, 16)
        );

    v_invoice_id :=
        concat(
            'inv_',
            substr(md5(random()::text || clock_timestamp()::text), 1, 16)
        );

    -- Calculate invoice CGST/SGST
    v_cgst := ROUND(v_tax_total / 2.0, 2);
    v_sgst := ROUND(v_tax_total / 2.0, 2);

    -- Serialize invoice number generation per tenant
    PERFORM pg_advisory_xact_lock(
        hashtextextended(p_tenant_id, 0)
    );

    SELECT COALESCE(
        MAX(
            SUBSTRING(
                "invoiceNumber"
                FROM 'INV-2026-([0-9]+)'
            )::INTEGER
        ),
        0
    )
    INTO v_latest_invoice_num
    FROM "Invoice"
    WHERE "tenantId" = p_tenant_id
      AND "invoiceNumber" LIKE 'INV-2026-%';

    v_invoice_number :=
        concat(
            'INV-2026-',
            LPAD((v_latest_invoice_num + 1)::TEXT, 6, '0')
        );

    -- 1. Insert Order
    INSERT INTO "Order" (
        "id",
        "tenantId",
        "clientId",
        "orderNumber",
        "orderDate",
        "expectedDelivery",
        "status",
        "verificationStatus",
        "subtotal",
        "taxTotal",
        "discountTotal",
        "totalAmount",
        "notes",
        "createdById",
        "assignedStaffId",
        "createdAt"
    )
    VALUES (
        v_order_id,
        p_tenant_id,
        p_client_id,
        v_order_number,
        v_order_date,
        p_expected_delivery,
        p_status,
        'PENDING',
        v_subtotal,
        v_tax_total,
        v_discount_total,
        v_total_amount,
        p_notes,
        v_created_by_id,
        p_assigned_staff_id,
        v_order_date
    );

    -- 2. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_order_id :=
            concat(
                'oi_',
                substr(md5(random()::text || clock_timestamp()::text), 1, 16)
            );

        v_item_quantity := (v_item->>'quantity')::INTEGER;
        v_item_unit_price := (v_item->>'unitPrice')::NUMERIC;
        v_item_tax_rate := (v_item->>'taxRate')::NUMERIC;
        v_item_discount :=
            COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_item_subtotal :=
            v_item_quantity * v_item_unit_price - v_item_discount;

        v_item_tax :=
            v_item_subtotal * v_item_tax_rate / 100;

        v_item_total := v_item_subtotal + v_item_tax;

        INSERT INTO "OrderItem" (
            "id",
            "orderId",
            "productId",
            "quantity",
            "unitPrice",
            "taxRate",
            "discount",
            "total"
        )
        VALUES (
            v_item_order_id,
            v_order_id,
            v_item->>'productId',
            v_item_quantity,
            v_item_unit_price,
            v_item_tax_rate,
            v_item_discount,
            v_item_total
        );
    END LOOP;

    -- 3. Insert Invoice as FINAL
    INSERT INTO "Invoice" (
        "id",
        "tenantId",
        "orderId",
        "clientId",
        "invoiceNumber",
        "status",
        "paymentStatus",
        "subtotal",
        "cgst",
        "sgst",
        "igst",
        "discountTotal",
        "total",
        "invoiceDate",
        "finalizedAt",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        v_invoice_id,
        p_tenant_id,
        v_order_id,
        p_client_id,
        v_invoice_number,
        v_status,
        'UNPAID',
        v_subtotal,
        v_cgst,
        v_sgst,
        0,
        v_discount_total,
        v_total_amount,
        CURRENT_DATE,
        NOW(),
        v_order_date,
        NOW()
    );

    -- 4. Insert Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_invoice_item_id :=
            concat(
                'ii_',
                substr(md5(random()::text || clock_timestamp()::text), 1, 16)
            );

        v_item_quantity := (v_item->>'quantity')::INTEGER;
        v_item_unit_price := (v_item->>'unitPrice')::NUMERIC;
        v_item_tax_rate := (v_item->>'taxRate')::NUMERIC;
        v_item_discount :=
            COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_item_subtotal :=
            v_item_quantity * v_item_unit_price - v_item_discount;

        v_item_tax :=
            v_item_subtotal * v_item_tax_rate / 100;

        v_item_total := v_item_subtotal + v_item_tax;

        v_cgst := ROUND(v_item_tax / 2.0, 2);
        v_sgst := ROUND(v_item_tax / 2.0, 2);

        INSERT INTO "InvoiceItem" (
            "id",
            "invoiceId",
            "productId",
            "quantity",
            "rate",
            "discount",
            "cgst",
            "sgst",
            "igst",
            "total"
        )
        VALUES (
            v_invoice_item_id,
            v_invoice_id,
            v_item->>'productId',
            v_item_quantity,
            v_item_unit_price,
            v_item_discount,
            v_cgst,
            v_sgst,
            0,
            v_item_total
        );
    END LOOP;

    -- 5. Insert Order Status History
    v_order_history_id :=
        concat(
            'osh_',
            substr(md5(random()::text || clock_timestamp()::text), 1, 16)
        );

    INSERT INTO "OrderStatusHistory" (
        "id",
        "tenantId",
        "orderId",
        "newStatus",
        "changedById",
        "notes",
        "createdAt"
    )
    VALUES (
        v_order_history_id,
        p_tenant_id,
        v_order_id,
        p_status,
        v_created_by_id,
        'Initial order created',
        v_order_date
    );

    -- 6. Insert notifications
    IF p_selected_contact_ids IS NOT NULL
       AND array_length(p_selected_contact_ids, 1) > 0
    THEN
        FOREACH v_contact_id IN ARRAY p_selected_contact_ids
        LOOP
            SELECT "userId"
            INTO v_user_id
            FROM "Client"
            WHERE "id" = v_contact_id
              AND "tenantId" = p_tenant_id
              AND "id" = p_client_id;

            IF v_user_id IS NOT NULL THEN
                v_notification_id :=
                    concat(
                        'notif_',
                        substr(
                            md5(random()::text || clock_timestamp()::text),
                            1,
                            16
                        )
                    );

                INSERT INTO "Notification" (
                    "id",
                    "tenantId",
                    "userId",
                    "orderId",
                    "type",
                    "title",
                    "message",
                    "actionUrl",
                    "priority",
                    "read",
                    "createdAt"
                )
                VALUES (
                    v_notification_id,
                    p_tenant_id,
                    v_user_id,
                    v_order_id,
                    'NEW_ORDER',
                    'New Order Created',
                    concat(
                        'Order ',
                        v_order_number,
                        ' has been created with final invoice.'
                    ),
                    concat(
                        '/operations/orders/',
                        v_order_id
                    ),
                    'normal',
                    false,
                    v_order_date
                );
            END IF;
        END LOOP;
    END IF;

    -- 7. Insert Audit Log
    v_audit_log_id :=
        concat(
            'aud_',
            substr(md5(random()::text || clock_timestamp()::text), 1, 16)
        );

    INSERT INTO "AuditLog" (
        "id",
        "tenantId",
        "userId",
        "userRole",
        "action",
        "entity",
        "entityId",
        "newValue",
        "createdAt"
    )
    VALUES (
        v_audit_log_id,
        p_tenant_id,
        v_created_by_id,
        v_actor.role::"Role",
        'Created order with final invoice',
        'Order',
        v_order_id,
        jsonb_build_object(
            'orderNumber', v_order_number,
            'status', p_status,
            'invoiceNumber', v_invoice_number,
            'invoiceStatus', v_status,
            'totalAmount', v_total_amount
        ),
        v_order_date
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order_id,
        'orderNumber', v_order_number,
        'invoiceId', v_invoice_id,
        'invoiceNumber', v_invoice_number,
        'invoiceStatus', v_status,
        'orderStatus', p_status,
        'totalAmount', v_total_amount
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_create_order_with_invoice(text,text,text,text[],text,timestamp with time zone,text,"OrderStatus",jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_create_order_with_invoice(text,text,text,text[],text,timestamp with time zone,text,"OrderStatus",jsonb,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_order_with_invoice(text,text,text,text[],text,timestamp with time zone,text,"OrderStatus",jsonb,jsonb) TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. rpc_transition_order
-- Exact 5-parameter signature from remote catalog:
-- (text, "OrderStatus", text, text, "Role") -> jsonb
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_transition_order(
    p_order_id text,
    p_next_status "OrderStatus",
    p_notes text DEFAULT NULL::text,
    p_user_id text DEFAULT NULL::text,
    p_user_role "Role" DEFAULT 'WAREHOUSE_STAFF'::"Role"
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_actor RECORD;
    v_effective_user_id TEXT;
    v_effective_user_role "Role";
    v_order RECORD;
    v_new_verification "VerificationStatus";
    v_valid_transition BOOLEAN := FALSE;
BEGIN
    -- Resolve authenticated actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- Retrieve order
    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order with ID % not found', p_order_id;
    END IF;

    -- Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id != v_order."tenantId" THEN
            RAISE EXCEPTION 'Tenant authorization failure: order belongs to another tenant';
        END IF;
    END IF;

    -- Authoritative actor identity and role
    v_effective_user_id := v_actor.actor_id;
    v_effective_user_role := v_actor.role::"Role";

    -- Validate role restrictions
    IF v_effective_user_role = 'CLIENT' THEN
        RAISE EXCEPTION 'Clients must use delivery verification to advance dispatched orders';
    END IF;

    IF v_effective_user_role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT')
       AND p_next_status NOT IN ('INVOICED', 'PAYMENT_PENDING', 'PAID', 'COMPLETED') THEN
        RAISE EXCEPTION 'Accountants cannot perform this order transition';
    END IF;

    -- Validate state machine:
    -- Target workflow: ISSUED -> DISPATCHED -> (Verification RPC) -> VERIFIED
    -- Prohibit DISPATCHED -> RECEIVED and RECEIVED -> VERIFICATION_PENDING
    -- Do not add generic DISPATCHED -> VERIFIED transition (verification RPC is the controlled path)
    CASE v_order.status
        WHEN 'DRAFT' THEN
            v_valid_transition := p_next_status IN ('ISSUED', 'CANCELLED');
        WHEN 'ISSUED' THEN
            v_valid_transition := p_next_status IN ('DISPATCHED', 'PROCESSING', 'CANCELLED');
        WHEN 'PROCESSING' THEN
            v_valid_transition := p_next_status IN ('READY_FOR_DISPATCH', 'CANCELLED');
        WHEN 'READY_FOR_DISPATCH' THEN
            v_valid_transition := p_next_status IN ('DISPATCHED', 'CANCELLED');
        WHEN 'DISPATCHED' THEN
            -- Generic transition cannot bypass verification RPC to reach VERIFIED.
            -- Only emergency cancellation is permitted directly.
            v_valid_transition := p_next_status IN ('CANCELLED');
        WHEN 'RECEIVED' THEN
            -- Historical state: no new active transitions
            v_valid_transition := FALSE;
        WHEN 'VERIFICATION_PENDING' THEN
            -- Historical state: no new active transitions
            v_valid_transition := FALSE;
        WHEN 'VERIFIED' THEN
            v_valid_transition := p_next_status IN ('INVOICE_PENDING', 'INVOICED');
        WHEN 'PARTIALLY_VERIFIED' THEN
            v_valid_transition := p_next_status IN ('PROCESSING', 'CANCELLED');
        WHEN 'REJECTED' THEN
            v_valid_transition := p_next_status IN ('PROCESSING', 'CANCELLED');
        WHEN 'INVOICE_PENDING' THEN
            v_valid_transition := p_next_status IN ('INVOICED');
        WHEN 'INVOICED' THEN
            v_valid_transition := p_next_status IN ('PAYMENT_PENDING');
        WHEN 'PAYMENT_PENDING' THEN
            v_valid_transition := p_next_status IN ('PAID');
        WHEN 'PAID' THEN
            v_valid_transition := p_next_status IN ('COMPLETED');
        ELSE
            v_valid_transition := FALSE;
    END CASE;

    IF NOT v_valid_transition THEN
        RAISE EXCEPTION 'Invalid order status transition from % to %', v_order.status, p_next_status;
    END IF;

    -- Compute verification status if applicable
    IF p_next_status = 'VERIFIED' THEN
        v_new_verification := 'VERIFIED';
    ELSIF p_next_status = 'PARTIALLY_VERIFIED' THEN
        v_new_verification := 'PARTIALLY_VERIFIED';
    ELSIF p_next_status = 'REJECTED' THEN
        v_new_verification := 'REJECTED';
    ELSE
        v_new_verification := v_order."verificationStatus";
    END IF;

    -- Update Order
    UPDATE "Order"
    SET "status" = p_next_status,
        "verificationStatus" = v_new_verification,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_order_id;

    -- Record Order Status History
    INSERT INTO "OrderStatusHistory" ("id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt")
    VALUES (
        concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_order_id,
        v_order.status,
        p_next_status,
        v_effective_user_id,
        p_notes,
        CURRENT_TIMESTAMP
    );

    -- Record Audit Log
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_effective_user_id,
        v_effective_user_role,
        'Changed order status',
        'Order',
        p_order_id,
        jsonb_build_object('status', v_order.status),
        jsonb_build_object('status', p_next_status),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', p_order_id,
        'previousStatus', v_order.status,
        'newStatus', p_next_status,
        'verificationStatus', v_new_verification
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_transition_order(text,"OrderStatus",text,text,"Role") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_transition_order(text,"OrderStatus",text,text,"Role") FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_transition_order(text,"OrderStatus",text,text,"Role") TO authenticated;


-- ----------------------------------------------------------------------------
-- 3. rpc_receive_or_adjust_stock
-- Exact 6-parameter signature from remote catalog:
-- (text, integer, "InventoryMovementType", text, text, "Role") -> jsonb
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_receive_or_adjust_stock(
    p_inventory_id text,
    p_quantity integer,
    p_type "InventoryMovementType",
    p_notes text DEFAULT NULL::text,
    p_user_id text DEFAULT NULL::text,
    p_user_role "Role" DEFAULT 'WAREHOUSE_STAFF'::"Role"
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_actor RECORD;
    v_effective_user_id TEXT;
    v_effective_user_role "Role";
    v_inv RECORD;
    v_new_available INTEGER;
    v_new_total INTEGER;
    v_new_damaged INTEGER;
    v_movement_id TEXT;
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

    SELECT * INTO v_inv FROM "Inventory" WHERE "id" = p_inventory_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record % not found', p_inventory_id;
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

    -- Update inventory
    UPDATE "Inventory"
    SET "availableQuantity" = v_new_available,
        "totalQuantity" = v_new_total,
        "damagedQuantity" = v_new_damaged,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_inventory_id;

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
$function$;

REVOKE ALL ON FUNCTION public.rpc_receive_or_adjust_stock(text,integer,"InventoryMovementType",text,text,"Role") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_receive_or_adjust_stock(text,integer,"InventoryMovementType",text,text,"Role") FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_receive_or_adjust_stock(text,integer,"InventoryMovementType",text,text,"Role") TO authenticated;


-- ----------------------------------------------------------------------------
-- 4. rpc_update_employee
-- Exact 8-parameter signature from remote catalog:
-- (text, "Role", text, text, text, text, "Role", "UserStatus") -> jsonb
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_update_employee(
    p_actor_id text,
    p_actor_role "Role",
    p_target_id text,
    p_name text DEFAULT NULL::text,
    p_email text DEFAULT NULL::text,
    p_mobile text DEFAULT NULL::text,
    p_new_role "Role" DEFAULT NULL::"Role",
    p_new_status "UserStatus" DEFAULT NULL::"UserStatus"
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_session_actor RECORD;
    v_actor_id TEXT;
    v_actor_role "Role";
    v_target RECORD;
    v_prev_value JSONB;
    v_new_value JSONB;

    -- Single source of truth: employee roles allowed for targeting & assigning
    v_allowed_employee_roles "Role"[] := ARRAY[
        'WAREHOUSE_STAFF',
        'ACCOUNTS_TEAM',
        'ACCOUNTANT',
        'WAREHOUSE_MODERATOR'
    ]::"Role"[];

    -- Roles authorized to manage employees: WAREHOUSE_OWNER and PLATFORM_ADMIN
    v_authorized_actor_roles "Role"[] := ARRAY[
        'WAREHOUSE_OWNER',
        'PLATFORM_ADMIN'
    ]::"Role"[];
BEGIN
    -- 1. Resolve session actor
    SELECT * INTO v_session_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_session_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    -- 2. Authorize actor role
    IF NOT (v_session_actor.role = ANY(v_authorized_actor_roles::TEXT[])) THEN
        RAISE EXCEPTION 'Unauthorized: role % cannot manage employees', v_session_actor.role;
    END IF;

    v_actor_id := v_session_actor.actor_id;
    v_actor_role := v_session_actor.role::"Role";

    -- 3. Resolve target employee
    SELECT * INTO v_target FROM "User" WHERE "id" = p_target_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user % not found', p_target_id;
    END IF;

    -- 4. Enforce tenant isolation
    IF v_session_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_session_actor.tenant_id IS NULL OR v_session_actor.tenant_id != v_target."tenantId" THEN
            RAISE EXCEPTION 'Tenant isolation violation: actor tenant % does not match target tenant %',
                v_session_actor.tenant_id, v_target."tenantId";
        END IF;
    END IF;

    -- 5. Prevent acting on self
    IF v_actor_id = v_target.id THEN
        RAISE EXCEPTION 'Cannot modify your own account via this function';
    END IF;

    -- 6. Target must currently be an employee role
    IF NOT (v_target.role = ANY(v_allowed_employee_roles)) THEN
        RAISE EXCEPTION 'Target user role % is not editable via employee management', v_target.role;
    END IF;

    -- 7. Assignable role check
    IF p_new_role IS NOT NULL THEN
        IF NOT (p_new_role = ANY(v_allowed_employee_roles)) THEN
            RAISE EXCEPTION 'Role % is not assignable via employee management', p_new_role;
        END IF;
    END IF;

    -- 8. Capture previous state for audit log
    v_prev_value := to_jsonb(v_target);

    -- 9. Apply updates
    UPDATE "User"
    SET
        "name"      = COALESCE(NULLIF(TRIM(p_name), ''), "name"),
        "email"     = CASE WHEN p_email IS NOT NULL THEN NULLIF(TRIM(p_email), '') ELSE "email" END,
        "mobile"    = CASE WHEN p_mobile IS NOT NULL THEN NULLIF(TRIM(p_mobile), '') ELSE "mobile" END,
        "role"      = COALESCE(p_new_role,   "role"),
        "status"    = COALESCE(p_new_status, "status"),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_id;

    -- 10. Reload updated target record
    SELECT * INTO v_target FROM "User" WHERE "id" = p_target_id;
    v_new_value := to_jsonb(v_target);

    -- 11. Write audit log record
    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole",
        "action", "entity", "entityId",
        "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_target."tenantId",
        v_actor_id,
        v_actor_role,
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
$function$;

REVOKE ALL ON FUNCTION public.rpc_update_employee(text,"Role",text,text,text,text,"Role","UserStatus") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_update_employee(text,"Role",text,text,text,text,"Role","UserStatus") FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_employee(text,"Role",text,text,text,text,"Role","UserStatus") TO authenticated;


-- ----------------------------------------------------------------------------
-- 5. rpc_submit_verification
-- Exact 6-parameter signature from remote catalog:
-- (text, "VerificationStatus", jsonb, text, jsonb, text) -> jsonb
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_submit_verification(
    p_order_id text,
    p_status "VerificationStatus",
    p_responses jsonb,
    p_comments text DEFAULT NULL::text,
    p_attachments jsonb DEFAULT NULL::jsonb,
    p_user_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_actor RECORD;
    v_order RECORD;
    v_user RECORD;
    v_client_user RECORD;
    v_new_order_status "OrderStatus";
    v_item JSONB;
BEGIN
    -- Resolve authenticated actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit delivery verification';
    END IF;

    -- Authoritative user ID from session
    p_user_id := v_actor.actor_id;

    -- Validate user exists
    SELECT * INTO v_user FROM "User" WHERE "id" = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % not found', p_user_id;
    END IF;

    -- Retrieve order
    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Workflow state checks:
    IF v_order.status = 'ISSUED' THEN
        RAISE EXCEPTION 'Order % is still in ISSUED status and cannot be verified until dispatched', v_order."orderNumber";
    END IF;

    IF v_order.status != 'DISPATCHED' THEN
        RAISE EXCEPTION 'This order (%) is not ready for client verification. Current status: %', v_order."orderNumber", v_order.status;
    END IF;

    IF p_status::text IN ('RECEIVED', 'VERIFICATION_PENDING', 'PENDING') THEN
        RAISE EXCEPTION 'Invalid verification status: %. Only VERIFIED, PARTIALLY_VERIFIED, or REJECTED are permitted', p_status;
    END IF;

    -- Authorization & Client/Tenant Ownership Validation:
    IF v_user.role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT') THEN
        RAISE EXCEPTION 'Accounting users cannot submit delivery verifications';
    END IF;

    IF v_user."tenantId" IS NOT NULL AND v_user."tenantId" != v_order."tenantId" THEN
        RAISE EXCEPTION 'Cross-tenant verification access denied';
    END IF;

    -- Enforce Client Receiver authorization and client ownership
    IF v_user.role = 'CLIENT' THEN
        SELECT * INTO v_client_user
        FROM "Client"
        WHERE "userId" = v_user.id AND "tenantId" = v_order."tenantId"
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Client profile not associated with authenticated user';
        END IF;

        IF v_client_user."employeeRole" IS NULL OR v_client_user."employeeRole" != 'RECEIVER' THEN
            RAISE EXCEPTION 'Only Client Receivers (employeeRole: RECEIVER) are authorized to verify deliveries';
        END IF;

        IF v_client_user.id != v_order."clientId" THEN
            IF v_client_user."companyGroupId" IS NULL OR v_client_user."companyGroupId" != (
                SELECT "companyGroupId" FROM "Client" WHERE "id" = v_order."clientId"
            ) THEN
                RAISE EXCEPTION 'Client Receiver is not authorized for this client order';
            END IF;
        END IF;
    END IF;

    -- Validate Required Checklist Items
    IF p_status = 'VERIFIED' THEN
        IF p_responses IS NULL OR jsonb_typeof(p_responses) != 'array' OR jsonb_array_length(p_responses) < 7 THEN
            RAISE EXCEPTION 'All 7 delivery inspection checklist items must be provided for verification';
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_responses)
        LOOP
            IF COALESCE((v_item->>'checked')::BOOLEAN, FALSE) IS NOT TRUE THEN
                RAISE EXCEPTION 'All inspection checklist items must be checked to confirm verification';
            END IF;
        END LOOP;
    END IF;

    v_new_order_status := p_status::text::"OrderStatus";

    -- 1. Upsert VerificationResponse atomically
    INSERT INTO "VerificationResponse" (
        "id", "tenantId", "orderId", "clientId", "userId", "status", "responses", "comments", "attachments", "createdAt"
    )
    VALUES (
        concat('vr_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."clientId",
        p_user_id,
        p_status,
        p_responses,
        p_comments,
        p_attachments,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ("orderId") DO UPDATE
    SET "status" = p_status,
        "responses" = p_responses,
        "comments" = p_comments,
        "attachments" = p_attachments,
        "userId" = p_user_id;

    -- 2. Update Order status and verification status atomically
    UPDATE "Order"
    SET "verificationStatus" = p_status,
        "status" = v_new_order_status,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_order."id";

    -- 3. Record Order Status History
    INSERT INTO "OrderStatusHistory" ("id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt")
    VALUES (
        concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."status",
        v_new_order_status,
        p_user_id,
        COALESCE(p_comments, concat('Delivery verification completed with status: ', p_status)),
        CURRENT_TIMESTAMP
    );

    -- 4. Record Audit Log
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_user_id,
        v_user.role,
        'Submitted delivery verification',
        'Order',
        v_order."id",
        jsonb_build_object('status', v_order."status", 'verificationStatus', v_order."verificationStatus"),
        jsonb_build_object('status', v_new_order_status, 'verificationStatus', p_status),
        CURRENT_TIMESTAMP
    );

    -- 5. Notification to warehouse operations team
    INSERT INTO "Notification" ("id", "tenantId", "orderId", "type", "title", "message", "actionUrl", "priority", "read", "createdAt")
    VALUES (
        concat('notif_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        'CLIENT_COMPLETED_VERIFICATION',
        'Delivery Verification Completed',
        concat('Order ', v_order."orderNumber", ' was verified as ', p_status),
        concat('/operations/orders/', v_order."id"),
        'normal',
        false,
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order."id",
        'verificationStatus', p_status,
        'orderStatus', v_new_order_status
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_verification(text,"VerificationStatus",jsonb,text,jsonb,text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 6. rpc_generate_invoice
-- Exact 4-parameter signature from remote catalog:
-- (text, boolean, text, "Role") -> jsonb
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_generate_invoice(
    p_order_id text,
    p_is_final boolean DEFAULT false,
    p_user_id text DEFAULT NULL::text,
    p_user_role "Role" DEFAULT 'WAREHOUSE_OWNER'::"Role"
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_actor RECORD;
    v_effective_user_id TEXT;
    v_effective_user_role "Role";
    v_order RECORD;
    v_latest_number INTEGER := 0;
    v_new_invoice_id TEXT;
    v_invoice_number TEXT;
    v_status "InvoiceStatus";
    v_cgst NUMERIC(12,2);
    v_sgst NUMERIC(12,2);
    v_item RECORD;
    v_split_tax NUMERIC(12,2);
    v_divisor NUMERIC;
BEGIN
    -- Resolve authenticated actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: active user session not found';
    END IF;

    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id != v_order."tenantId" THEN
            RAISE EXCEPTION 'Tenant authorization failure: order belongs to another tenant';
        END IF;
    END IF;

    v_effective_user_id := v_actor.actor_id;
    v_effective_user_role := v_actor.role::"Role";

    -- CRITICAL BUSINESS RULE: Final invoice blocked until verified!
    IF p_is_final AND v_order."verificationStatus" != 'VERIFIED' THEN
        INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
        VALUES (
            concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            v_order."tenantId",
            v_effective_user_id,
            v_effective_user_role,
            'Blocked final invoice before verification',
            'Order',
            v_order."id",
            jsonb_build_object('verificationStatus', v_order."verificationStatus"),
            jsonb_build_object('requestedFinal', true),
            CURRENT_TIMESTAMP
        );
        RAISE EXCEPTION 'Final invoice generation is blocked until client verification is VERIFIED. Current status: %', v_order."verificationStatus";
    END IF;

    -- Calculate next invoice number
    SELECT COALESCE(MAX(SUBSTRING("invoiceNumber" FROM 'INV-2026-([0-9]+)')::INTEGER), 0)
    INTO v_latest_number
    FROM "Invoice"
    WHERE "tenantId" = v_order."tenantId" AND "invoiceNumber" LIKE 'INV-2026-%';

    v_invoice_number := concat('INV-2026-', LPAD((v_latest_number + 1)::TEXT, 6, '0'));
    v_status := CASE WHEN p_is_final THEN 'FINAL'::"InvoiceStatus" ELSE 'DRAFT'::"InvoiceStatus" END;
    v_new_invoice_id := concat('inv_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

    v_cgst := ROUND(v_order."taxTotal" / 2.0, 2);
    v_sgst := ROUND(v_order."taxTotal" / 2.0, 2);

    -- Insert Invoice
    INSERT INTO "Invoice" (
        "id", "tenantId", "orderId", "clientId", "invoiceNumber",
        "status", "paymentStatus", "subtotal", "cgst", "sgst", "igst",
        "discountTotal", "total", "finalizedAt", "createdAt", "updatedAt"
    )
    VALUES (
        v_new_invoice_id,
        v_order."tenantId",
        v_order."id",
        v_order."clientId",
        v_invoice_number,
        v_status,
        'UNPAID',
        v_order."subtotal",
        v_cgst,
        v_sgst,
        0,
        v_order."discountTotal",
        v_order."totalAmount",
        CASE WHEN p_is_final THEN CURRENT_TIMESTAMP ELSE NULL END,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

    -- Insert Invoice Items
    FOR v_item IN SELECT * FROM "OrderItem" WHERE "orderId" = v_order."id" LOOP
        v_divisor := 200.0 + (v_item."taxRate" * 2.0);
        v_split_tax := ROUND((v_item."total" * v_item."taxRate") / v_divisor, 2);

        INSERT INTO "InvoiceItem" (
            "id", "invoiceId", "productId", "quantity", "rate",
            "discount", "cgst", "sgst", "igst", "total"
        )
        VALUES (
            concat('ii_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            v_new_invoice_id,
            v_item."productId",
            v_item."quantity",
            v_item."unitPrice",
            v_item."discount",
            v_split_tax,
            v_split_tax,
            0,
            v_item."total"
        );
    END LOOP;

    -- If final invoice, advance order status to INVOICED
    IF p_is_final THEN
        UPDATE "Order" SET "status" = 'INVOICED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = v_order."id";
    END IF;

    -- Audit log
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_effective_user_id,
        v_effective_user_role,
        CASE WHEN p_is_final THEN 'Generated final invoice' ELSE 'Generated draft invoice' END,
        'Invoice',
        v_new_invoice_id,
        jsonb_build_object('invoiceNumber', v_invoice_number, 'status', v_status),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoiceId', v_new_invoice_id,
        'invoiceNumber', v_invoice_number,
        'status', v_status,
        'total', v_order."totalAmount"
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_generate_invoice(text,boolean,text,"Role") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_generate_invoice(text,boolean,text,"Role") FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_generate_invoice(text,boolean,text,"Role") TO authenticated;
