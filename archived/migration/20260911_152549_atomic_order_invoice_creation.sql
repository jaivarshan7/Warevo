-- Atomic Order + Invoice Creation Function
-- Ensures Order, OrderItems, Invoice, InvoiceItems, OrderStatusHistory, and Notifications
-- are created atomically. If any step fails, the entire transaction is rolled back.

CREATE OR REPLACE FUNCTION rpc_create_order_with_invoice(
    p_tenant_id TEXT,
    p_client_id TEXT,
    p_created_by_id TEXT,
    p_selected_contact_ids TEXT[],
    p_assigned_staff_id TEXT DEFAULT NULL,
    p_expected_delivery TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_status "OrderStatus" DEFAULT 'DRAFT',
    p_eway_bill JSONB DEFAULT NULL,
    p_items JSONB DEFAULT '[]'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
    v_status "InvoiceStatus" := 'DRAFT';
    v_cgst NUMERIC(12, 2) := 0;
    v_sgst NUMERIC(12, 2) := 0;
    v_item JSONB;
    v_item_subtotal NUMERIC(12, 2);
    v_item_tax NUMERIC(12, 2);
    v_item_discount NUMERIC(12, 2);
    v_item_total NUMERIC(12, 2);
    v_order_item_id TEXT;
    v_invoice_item_id TEXT;
    v_item_quantity INTEGER;
    v_item_unit_price NUMERIC(12, 2);
    v_item_tax_rate NUMERIC(12, 2);
    v_item_order_id TEXT;
    v_notification_id TEXT;
    v_contact_id TEXT;
    v_order_history_id TEXT;
    v_audit_log_id TEXT;
    v_warehouse_setting RECORD;
BEGIN
    -- Validate tenant exists
    IF NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "id" = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
    END IF;

    -- Validate client exists
    IF NOT EXISTS (SELECT 1 FROM "Client" WHERE "id" = p_client_id) THEN
        RAISE EXCEPTION 'Client % not found', p_client_id;
    END IF;

    -- Validate created_by exists
    IF p_created_by_id IS NOT NULL AND p_created_by_id != '' THEN
        IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = p_created_by_id) THEN
            RAISE EXCEPTION 'User % not found', p_created_by_id;
        END IF;
    END IF;

    -- Validate assigned_staff if provided
    IF p_assigned_staff_id IS NOT NULL AND p_assigned_staff_id != '' THEN
        IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = p_assigned_staff_id) THEN
            RAISE EXCEPTION 'Assigned staff % not found', p_assigned_staff_id;
        END IF;
    END IF;

    -- Get warehouse settings for order/invoice prefixes
    SELECT * INTO v_warehouse_setting FROM "WarehouseSetting" WHERE "tenantId" = p_tenant_id LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warehouse settings not found for tenant %', p_tenant_id;
    END IF;

    -- Generate order number
    SELECT COALESCE(MAX(SUBSTRING("orderNumber" FROM v_warehouse_setting.orderPrefix || '-2026-([0-9]+)')::INTEGER), 0)
    INTO v_last_order_num
    FROM "Order"
    WHERE "tenantId" = p_tenant_id AND "orderNumber" LIKE v_warehouse_setting.orderPrefix || '-2026-%';

    v_next_order_num := v_last_order_num + 1;
    v_order_number := v_warehouse_setting.orderPrefix || '-2026-' || LPAD(v_next_order_num::TEXT, 6, '0');

    -- Calculate totals from items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_subtotal := (v_item->>'quantity')::NUMERIC * (v_item->>'unitPrice')::NUMERIC - COALESCE((v_item->>'discount')::NUMERIC, 0);
        v_item_tax := v_item_subtotal * (v_item->>'taxRate')::NUMERIC / 100;
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_subtotal := v_subtotal + v_item_subtotal;
        v_tax_total := v_tax_total + v_item_tax;
        v_discount_total := v_discount_total + v_item_discount;
    END LOOP;

    v_total_amount := v_subtotal + v_tax_total;

    -- Generate IDs
    v_order_id := concat('ord_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    v_invoice_id := concat('inv_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

    -- Calculate invoice CGST/SGST
    v_cgst := ROUND(v_tax_total / 2.0, 2);
    v_sgst := ROUND(v_tax_total / 2.0, 2);

    -- ACQUIRE TRANSACTION LEVEL ADVISORY LOCK PER TENANT TO SERIALIZE INVOICE NUMBER GENERATION
    -- This ensures only one concurrent transaction per tenant can generate invoice numbers
    -- hashtextextended produces a deterministic bigint hash from the tenant UUID string
    -- Lock is automatically released when transaction commits or rolls back
    PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id, 0));

    -- Generate invoice number using the same logic as rpc_generate_invoice
    SELECT COALESCE(MAX(SUBSTRING("invoiceNumber" FROM 'INV-2026-([0-9]+)')::INTEGER), 0)
    INTO v_latest_invoice_num
    FROM "Invoice"
    WHERE "tenantId" = p_tenant_id AND "invoiceNumber" LIKE 'INV-2026-%';

    v_invoice_number := concat('INV-2026-', LPAD((v_latest_invoice_num + 1)::TEXT, 6, '0'));

    -- ATOMIC INSERTS - All or nothing happens
    -- 1. Insert Order
    INSERT INTO "Order" (
        "id", "tenantId", "clientId", "orderNumber", "orderDate",
        "expectedDelivery", "status", "verificationStatus",
        "subtotal", "taxTotal", "discountTotal", "totalAmount",
        "notes", "createdById", "assignedStaffId", "createdAt"
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
        p_created_by_id,
        p_assigned_staff_id,
        v_order_date
    );

    -- 2. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_order_id := concat('oi_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
        v_item_quantity := (v_item->>'quantity')::INTEGER;
        v_item_unit_price := (v_item->>'unitPrice')::NUMERIC;
        v_item_tax_rate := (v_item->>'taxRate')::NUMERIC;
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_item_subtotal := v_item_quantity * v_item_unit_price - v_item_discount;
        v_item_tax := v_item_subtotal * v_item_tax_rate / 100;
        v_item_total := v_item_subtotal + v_item_tax;

        INSERT INTO "OrderItem" (
            "id", "orderId", "productId", "quantity",
            "unitPrice", "taxRate", "discount", "total"
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

    -- 3. Insert Invoice
    INSERT INTO "Invoice" (
        "id", "tenantId", "orderId", "clientId", "invoiceNumber",
        "status", "paymentStatus", "subtotal", "cgst", "sgst", "igst",
        "discountTotal", "total", "invoiceDate", "createdAt"
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
        v_order_date
    );

    -- 4. Insert Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_invoice_item_id := concat('ii_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
        v_item_quantity := (v_item->>'quantity')::INTEGER;
        v_item_unit_price := (v_item->>'unitPrice')::NUMERIC;
        v_item_tax_rate := (v_item->>'taxRate')::NUMERIC;
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_item_subtotal := v_item_quantity * v_item_unit_price - v_item_discount;
        v_item_tax := v_item_subtotal * v_item_tax_rate / 100;
        v_item_total := v_item_subtotal + v_item_tax;

        -- CGST/SGST calculation: tax rate is applied to net amount
        -- Total tax = v_item_tax, split equally between CGST and SGST
        v_cgst := ROUND(v_item_tax / 2.0, 2);
        v_sgst := ROUND(v_item_tax / 2.0, 2);

        INSERT INTO "InvoiceItem" (
            "id", "invoiceId", "productId", "quantity", "rate",
            "discount", "cgst", "sgst", "igst", "total"
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
    v_order_history_id := concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    INSERT INTO "OrderStatusHistory" (
        "id", "tenantId", "orderId", "newStatus", "changedById", "notes", "createdAt"
    )
    VALUES (
        v_order_history_id,
        p_tenant_id,
        v_order_id,
        p_status,
        p_created_by_id,
        'Initial order created',
        v_order_date
    );

    -- 6. Insert notifications to selected contacts
    -- If no contacts selected, do NOT create notifications (all authorized client employees can still see the order in-app, no email sent)
    -- If contacts selected, create notifications WITH userId set so the system knows who should receive email
    IF p_selected_contact_ids IS NULL OR array_length(p_selected_contact_ids, 1) = 0 THEN
        -- No notifications created when no specific employees selected;
        -- authorized client employees will see the order via clientId filtering in fetchUserNotifications
    ELSE
        FOREACH v_contact_id IN ARRAY p_selected_contact_ids
        LOOP
            INSERT INTO "Notification" (
                "id", "tenantId", "userId", "orderId", "type", "title", "message", "actionUrl", "priority", "read", "createdAt"
            )
            VALUES (
                concat('notif_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
                p_tenant_id,
                v_contact_id,  -- Set userId to the selected contact
                v_order_id,
                'ORDER_ISSUED',
                concat('New Order Issued: ', v_order_number),
                concat('Commercial order ', v_order_number, ' has been issued and assigned for fulfillment.'),
                concat('/operations/orders/', v_order_id),
                'NORMAL',
                false,
                v_order_date
            );
        END LOOP;
    END IF;

    -- 7. Audit log
    v_audit_log_id := concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "newValue", "createdAt"
    )
    VALUES (
        v_audit_log_id,
        p_tenant_id,
        p_created_by_id,
        'WAREHOUSE_OWNER',
        'Created order with invoice',
        'Order',
        v_order_id,
        jsonb_build_object('orderNumber', v_order_number, 'invoiceNumber', v_invoice_number, 'status', p_status),
        v_order_date
    );

    -- Return success with order and invoice details
    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order_id,
        'orderNumber', v_order_number,
        'invoiceId', v_invoice_id,
        'invoiceNumber', v_invoice_number,
        'status', p_status,
        'totalAmount', v_total_amount
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION rpc_create_order_with_invoice TO anon, authenticated, service_role;
