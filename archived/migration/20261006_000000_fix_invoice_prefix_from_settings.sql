-- ============================================================================
-- Migration: 20261006_000000_fix_invoice_prefix_from_settings.sql
-- Description: Fix invoice number generation to use WarehouseSetting config
--
-- Root cause: Both rpc_create_order_with_invoice and rpc_generate_invoice
-- hard-code 'INV-2026-' for invoice numbers instead of reading
-- WarehouseSetting.invoicePrefix. This migration:
--
--   1. Adds "nextInvoiceNumber" INTEGER column to WarehouseSetting
--   2. Seeds nextInvoiceNumber from existing invoice counts
--   3. Normalizes invoicePrefix='0' to '' and changes column DEFAULT to ''
--   4. Replaces rpc_create_order_with_invoice to use configured prefix + sequence
--   5. Replaces rpc_generate_invoice to use configured prefix + sequence
--
-- Exact RPC signatures, return types, SECURITY DEFINER, search_path,
-- and all business logic are preserved. Only the invoice-number generation
-- section is changed.
--
-- Existing invoices (INV-2026-000024 etc.) are NOT renamed.
-- ============================================================================

-- ============================================================================
-- STEP 1: Add nextInvoiceNumber column to WarehouseSetting
-- ============================================================================

ALTER TABLE "public"."WarehouseSetting"
    ADD COLUMN IF NOT EXISTS "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1;

-- ============================================================================
-- STEP 2: Seed nextInvoiceNumber from existing invoice data
-- For each tenant, set nextInvoiceNumber = max trailing digits + 1
-- ============================================================================

UPDATE "public"."WarehouseSetting" ws
SET "nextInvoiceNumber" = sub.next_num
FROM (
    SELECT
        i."tenantId",
        COALESCE(MAX(substring(i."invoiceNumber" FROM '([0-9]+)$')::INTEGER), 0) + 1 AS next_num
    FROM "public"."Invoice" i
    GROUP BY i."tenantId"
) sub
WHERE ws."tenantId" = sub."tenantId";

-- ============================================================================
-- STEP 3: Normalize invoicePrefix column
-- Change DEFAULT from 'INV' to '' (empty string)
-- Convert existing '0' values to '' (the user intended empty)
-- ============================================================================

ALTER TABLE "public"."WarehouseSetting"
    ALTER COLUMN "invoicePrefix" SET DEFAULT '';

UPDATE "public"."WarehouseSetting"
    SET "invoicePrefix" = ''
    WHERE "invoicePrefix" = '0';


-- ============================================================================
-- STEP 4: Replace rpc_create_order_with_invoice
-- Exact 10-parameter signature preserved:
-- (text, text, text, text[], text, timestamptz, text, "OrderStatus", jsonb, jsonb) -> jsonb
-- ============================================================================

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
    v_configured_prefix TEXT;
    v_next_invoice_seq INTEGER;
    v_max_existing INTEGER := 0;
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

    -- Generate order number (unchanged — uses orderPrefix correctly)
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

    -- ====================================================================
    -- INVOICE NUMBER GENERATION — uses WarehouseSetting configuration
    -- ====================================================================

    -- Serialize invoice number generation per tenant (advisory lock preserved)
    PERFORM pg_advisory_xact_lock(
        hashtextextended(p_tenant_id, 0)
    );

    -- Read configured prefix (empty string if NULL)
    v_configured_prefix := COALESCE(v_warehouse_setting."invoicePrefix", '');

    -- Read authoritative next sequence number from WarehouseSetting
    v_next_invoice_seq := COALESCE(v_warehouse_setting."nextInvoiceNumber", 1);

    -- Safety: cross-check against existing invoices to avoid duplicates
    -- Extract trailing digits from the latest invoice for this tenant
    SELECT COALESCE(
        MAX(
            substring("invoiceNumber" FROM '([0-9]+)$')::INTEGER
        ),
        0
    )
    INTO v_max_existing
    FROM "Invoice"
    WHERE "tenantId" = p_tenant_id;

    -- Use the greater of the configured sequence or existing max + 1
    IF v_max_existing >= v_next_invoice_seq THEN
        v_next_invoice_seq := v_max_existing + 1;
    END IF;

    -- Format: prefix + six-digit zero-padded sequence
    v_invoice_number := v_configured_prefix || LPAD(v_next_invoice_seq::TEXT, 6, '0');

    -- Increment the sequence in WarehouseSetting for the next invoice
    UPDATE "WarehouseSetting"
    SET "nextInvoiceNumber" = v_next_invoice_seq + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = p_tenant_id;

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


-- ============================================================================
-- STEP 5: Replace rpc_generate_invoice
-- Exact 4-parameter signature preserved:
-- (text, boolean, text, "Role") -> jsonb
-- ============================================================================

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
    v_new_invoice_id TEXT;
    v_invoice_number TEXT;
    v_configured_prefix TEXT;
    v_next_invoice_seq INTEGER;
    v_max_existing INTEGER := 0;
    v_status "InvoiceStatus";
    v_cgst NUMERIC(12,2);
    v_sgst NUMERIC(12,2);
    v_item RECORD;
    v_split_tax NUMERIC(12,2);
    v_divisor NUMERIC;
    v_warehouse_setting RECORD;
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

    -- Load warehouse settings for invoice prefix and sequence
    SELECT * INTO v_warehouse_setting
    FROM "WarehouseSetting"
    WHERE "tenantId" = v_order."tenantId"
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warehouse settings not found for tenant %', v_order."tenantId";
    END IF;

    -- ====================================================================
    -- INVOICE NUMBER GENERATION — uses WarehouseSetting configuration
    -- ====================================================================

    -- Serialize invoice number generation per tenant (advisory lock)
    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_order."tenantId", 0)
    );

    -- Read configured prefix (empty string if NULL)
    v_configured_prefix := COALESCE(v_warehouse_setting."invoicePrefix", '');

    -- Read authoritative next sequence number from WarehouseSetting
    v_next_invoice_seq := COALESCE(v_warehouse_setting."nextInvoiceNumber", 1);

    -- Safety: cross-check against existing invoices to avoid duplicates
    -- Extract trailing digits from the latest invoice for this tenant
    SELECT COALESCE(
        MAX(
            substring("invoiceNumber" FROM '([0-9]+)$')::INTEGER
        ),
        0
    )
    INTO v_max_existing
    FROM "Invoice"
    WHERE "tenantId" = v_order."tenantId";

    -- Use the greater of the configured sequence or existing max + 1
    IF v_max_existing >= v_next_invoice_seq THEN
        v_next_invoice_seq := v_max_existing + 1;
    END IF;

    -- Format: prefix + six-digit zero-padded sequence
    v_invoice_number := v_configured_prefix || LPAD(v_next_invoice_seq::TEXT, 6, '0');

    -- Increment the sequence in WarehouseSetting for the next invoice
    UPDATE "WarehouseSetting"
    SET "nextInvoiceNumber" = v_next_invoice_seq + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = v_order."tenantId";

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
