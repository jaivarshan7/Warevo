-- Migration: 20260919_000000_target_order_workflow_verification.sql
-- Description: Implement Target Order Workflow:
--   ISSUED -> DISPATCHED -> Client Receiver Verification (7 checklist items) -> VERIFIED
--   - Update rpc_transition_order for ISSUED -> DISPATCHED, removing DISPATCHED -> RECEIVED
--   - Update rpc_submit_verification to securely verify DISPATCHED orders with atomic DISPATCHED -> VERIFIED
--   - Update rpc_create_order_with_invoice to create invoices as FINAL with finalizedAt

-- 1. Atomic Order Status Transition Function
CREATE OR REPLACE FUNCTION rpc_transition_order(
    p_order_id TEXT,
    p_next_status "OrderStatus",
    p_notes TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL,
    p_user_role "Role" DEFAULT 'WAREHOUSE_STAFF'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_new_verification "VerificationStatus";
    v_valid_transition BOOLEAN := FALSE;
BEGIN
    -- Retrieve order
    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order with ID % not found', p_order_id;
    END IF;

    -- Validate role restrictions
    IF p_user_role = 'CLIENT' THEN
        RAISE EXCEPTION 'Clients must use delivery verification to advance dispatched orders';
    END IF;

    IF p_user_role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT') AND p_next_status NOT IN ('INVOICED', 'PAYMENT_PENDING', 'PAID', 'COMPLETED') THEN
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

    -- Sanitize user_id
    SELECT "id" INTO p_user_id FROM "User" WHERE "id" = p_user_id;

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
        p_user_id,
        p_notes,
        CURRENT_TIMESTAMP
    );

    -- Record Audit Log
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_user_id,
        p_user_role,
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
$$;


-- 2. Atomic Secure Client Delivery Verification Function
CREATE OR REPLACE FUNCTION rpc_submit_verification(
    p_order_id TEXT,
    p_status "VerificationStatus",
    p_responses JSONB,
    p_comments TEXT DEFAULT NULL,
    p_attachments JSONB DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_user RECORD;
    v_client_user RECORD;
    v_new_order_status "OrderStatus";
    v_item JSONB;
    v_auth_uid TEXT;
BEGIN
    -- Resolve authenticated user
    v_auth_uid := auth.uid()::text;
    IF v_auth_uid IS NOT NULL AND v_auth_uid != '' THEN
        p_user_id := v_auth_uid;
    END IF;

    IF p_user_id IS NULL OR p_user_id = '' THEN
        RAISE EXCEPTION 'Authentication required to submit delivery verification';
    END IF;

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
    -- Reject ISSUED orders
    IF v_order.status = 'ISSUED' THEN
        RAISE EXCEPTION 'Order % is still in ISSUED status and cannot be verified until dispatched', v_order."orderNumber";
    END IF;

    -- Accept only DISPATCHED orders for active verification
    IF v_order.status != 'DISPATCHED' THEN
        RAISE EXCEPTION 'This order (%) is not ready for client verification. Current status: %', v_order."orderNumber", v_order.status;
    END IF;

    -- Reject RECEIVED or VERIFICATION_PENDING as a target verification status
    IF p_status::text IN ('RECEIVED', 'VERIFICATION_PENDING', 'PENDING') THEN
        RAISE EXCEPTION 'Invalid verification status: %. Only VERIFIED, PARTIALLY_VERIFIED, or REJECTED are permitted', p_status;
    END IF;

    -- Authorization & Client/Tenant Ownership Validation:
    -- Accounting roles cannot perform physical delivery verification
    IF v_user.role IN ('ACCOUNTANT', 'ACCOUNTS_TEAM', 'CLIENT_ACCOUNTANT') THEN
        RAISE EXCEPTION 'Accounting users cannot submit delivery verifications';
    END IF;

    -- Validate tenant ownership
    IF v_user."tenantId" IS NOT NULL AND v_user."tenantId" != v_order."tenantId" THEN
        RAISE EXCEPTION 'Cross-tenant verification access denied';
    END IF;

    -- If the user is a CLIENT, enforce Client Receiver authorization and client ownership
    IF v_user.role = 'CLIENT' THEN
        SELECT * INTO v_client_user
        FROM "Client"
        WHERE "userId" = v_user.id AND "tenantId" = v_order."tenantId"
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Client profile not associated with authenticated user';
        END IF;

        -- Must be a designated RECEIVER
        IF v_client_user."employeeRole" IS NULL OR v_client_user."employeeRole" != 'RECEIVER' THEN
            RAISE EXCEPTION 'Only Client Receivers (employeeRole: RECEIVER) are authorized to verify deliveries';
        END IF;

        -- Must belong to the client company of the order
        IF v_client_user.id != v_order."clientId" THEN
            -- Check if in same company group
            IF v_client_user."companyGroupId" IS NULL OR v_client_user."companyGroupId" != (
                SELECT "companyGroupId" FROM "Client" WHERE "id" = v_order."clientId"
            ) THEN
                RAISE EXCEPTION 'Client Receiver is not authorized for this client order';
            END IF;
        END IF;
    END IF;

    -- Validate Required Checklist Items:
    -- When status is VERIFIED, all 7 inspection checklist items must be checked
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

    -- Determine new order status matching verification status:
    -- DISPATCHED -> VERIFIED (or PARTIALLY_VERIFIED / REJECTED)
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
$$;


-- 3. Atomic Order + Final Invoice Creation Function
-- Invoices are created as FINAL with finalizedAt, while Order remains ISSUED
CREATE OR REPLACE FUNCTION rpc_create_order_with_invoice(
    p_tenant_id TEXT,
    p_client_id TEXT,
    p_created_by_id TEXT,
    p_selected_contact_ids TEXT[],
    p_assigned_staff_id TEXT DEFAULT NULL,
    p_expected_delivery TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_status "OrderStatus" DEFAULT 'ISSUED',
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
    SELECT COALESCE(MAX(SUBSTRING("orderNumber" FROM v_warehouse_setting."orderPrefix" || '-2026-([0-9]+)')::INTEGER), 0)
    INTO v_last_order_num
    FROM "Order"
    WHERE "tenantId" = p_tenant_id AND "orderNumber" LIKE v_warehouse_setting."orderPrefix" || '-2026-%';

    v_next_order_num := v_last_order_num + 1;
    v_order_number := v_warehouse_setting."orderPrefix" || '-2026-' || LPAD(v_next_order_num::TEXT, 6, '0');

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

    -- Serialize invoice number generation per tenant
    PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id, 0));

    SELECT COALESCE(MAX(SUBSTRING("invoiceNumber" FROM 'INV-2026-([0-9]+)')::INTEGER), 0)
    INTO v_latest_invoice_num
    FROM "Invoice"
    WHERE "tenantId" = p_tenant_id AND "invoiceNumber" LIKE 'INV-2026-%';

    v_invoice_number := concat('INV-2026-', LPAD((v_latest_invoice_num + 1)::TEXT, 6, '0'));

    -- 1. Insert Order (status remains ISSUED, not changed by invoice finality)
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

    -- 3. Insert Invoice as FINAL with finalizedAt
    INSERT INTO "Invoice" (
        "id", "tenantId", "orderId", "clientId", "invoiceNumber",
        "status", "paymentStatus", "subtotal", "cgst", "sgst", "igst",
        "discountTotal", "total", "invoiceDate", "finalizedAt", "createdAt", "updatedAt"
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
        v_invoice_item_id := concat('ii_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
        v_item_quantity := (v_item->>'quantity')::INTEGER;
        v_item_unit_price := (v_item->>'unitPrice')::NUMERIC;
        v_item_tax_rate := (v_item->>'taxRate')::NUMERIC;
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

        v_item_subtotal := v_item_quantity * v_item_unit_price - v_item_discount;
        v_item_tax := v_item_subtotal * v_item_tax_rate / 100;
        v_item_total := v_item_subtotal + v_item_tax;

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
    IF p_selected_contact_ids IS NOT NULL AND array_length(p_selected_contact_ids, 1) > 0 THEN
        FOREACH v_contact_id IN ARRAY p_selected_contact_ids
        LOOP
            SELECT "userId" INTO v_user_id
            FROM "Client"
            WHERE "id" = v_contact_id
              AND "tenantId" = p_tenant_id
              AND "id" = p_client_id;

            IF v_user_id IS NOT NULL THEN
                v_notification_id := concat('notif_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
                INSERT INTO "Notification" (
                    "id", "tenantId", "userId", "orderId", "type",
                    "title", "message", "actionUrl", "priority", "read", "createdAt"
                )
                VALUES (
                    v_notification_id,
                    p_tenant_id,
                    v_user_id,
                    v_order_id,
                    'ORDER_CREATED',
                    'New Order Created',
                    concat('Order ', v_order_number, ' has been created with final invoice.'),
                    concat('/operations/orders/', v_order_id),
                    'normal',
                    false,
                    v_order_date
                );
            END IF;
        END LOOP;
    END IF;

    -- 7. Insert Audit Log
    v_audit_log_id := concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));
    INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "userRole", "action",
        "entity", "entityId", "newValue", "createdAt"
    )
    VALUES (
        v_audit_log_id,
        p_tenant_id,
        p_created_by_id,
        'WAREHOUSE_STAFF',
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
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION rpc_transition_order TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rpc_submit_verification TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rpc_create_order_with_invoice TO anon, authenticated, service_role;
