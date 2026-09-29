-- WarehouseOS Core PostgreSQL Migration & RPC Functions
-- Generated for Supabase migration from Prisma

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
    IF p_user_role = 'CLIENT' AND p_next_status != 'VERIFICATION_PENDING' THEN
        RAISE EXCEPTION 'Clients can only advance orders to VERIFICATION_PENDING';
    END IF;

    IF p_user_role = 'ACCOUNTANT' AND p_next_status NOT IN ('INVOICED', 'PAYMENT_PENDING', 'PAID', 'COMPLETED') THEN
        RAISE EXCEPTION 'Accountants cannot perform this order transition';
    END IF;

    -- Validate state machine
    CASE v_order.status
        WHEN 'DRAFT' THEN
            v_valid_transition := p_next_status IN ('ISSUED', 'CANCELLED');
        WHEN 'ISSUED' THEN
            v_valid_transition := p_next_status IN ('PROCESSING', 'CANCELLED');
        WHEN 'PROCESSING' THEN
            v_valid_transition := p_next_status IN ('READY_FOR_DISPATCH', 'CANCELLED');
        WHEN 'READY_FOR_DISPATCH' THEN
            v_valid_transition := p_next_status IN ('DISPATCHED');
        WHEN 'DISPATCHED' THEN
            v_valid_transition := p_next_status IN ('RECEIVED');
        WHEN 'RECEIVED' THEN
            v_valid_transition := p_next_status IN ('VERIFICATION_PENDING');
        WHEN 'VERIFICATION_PENDING' THEN
            v_valid_transition := p_next_status IN ('VERIFIED', 'PARTIALLY_VERIFIED', 'REJECTED');
        WHEN 'VERIFIED' THEN
            v_valid_transition := p_next_status IN ('INVOICE_PENDING');
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
    ELSIF p_next_status = 'VERIFICATION_PENDING' THEN
        v_new_verification := 'PENDING';
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


-- 2. Atomic Stock Adjustment & Movement Function
CREATE OR REPLACE FUNCTION rpc_receive_or_adjust_stock(
    p_inventory_id TEXT,
    p_quantity INTEGER,
    p_type "InventoryMovementType",
    p_notes TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL,
    p_user_role "Role" DEFAULT 'WAREHOUSE_STAFF'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inv RECORD;
    v_new_available INTEGER;
    v_new_total INTEGER;
    v_new_damaged INTEGER;
    v_movement_id TEXT;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    SELECT * INTO v_inv FROM "Inventory" WHERE "id" = p_inventory_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record % not found', p_inventory_id;
    END IF;

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

    SELECT "id" INTO p_user_id FROM "User" WHERE "id" = p_user_id;

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
        p_user_id,
        CURRENT_TIMESTAMP
    );

    -- Log audit
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_inv."tenantId",
        p_user_id,
        p_user_role,
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


-- 3. Atomic Client Delivery Verification Function
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
    v_client RECORD;
    v_user RECORD;
    v_new_order_status "OrderStatus";
BEGIN
    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    IF v_order.status NOT IN ('RECEIVED', 'VERIFICATION_PENDING') THEN
        RAISE EXCEPTION 'This order (%) is not ready for client verification. Current status: %', v_order."orderNumber", v_order.status;
    END IF;

    -- Find client
    SELECT * INTO v_client FROM "Client" WHERE "id" = v_order."clientId";

    -- Determine new order status matching verification status
    v_new_order_status := p_status::text::"OrderStatus";

    -- Upsert VerificationResponse
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
        "attachments" = p_attachments;

    -- Update order status and verification status
    UPDATE "Order"
    SET "verificationStatus" = p_status,
        "status" = v_new_order_status,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_order."id";

    -- History
    INSERT INTO "OrderStatusHistory" ("id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt")
    VALUES (
        concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        v_order."status",
        v_new_order_status,
        p_user_id,
        p_comments,
        CURRENT_TIMESTAMP
    );

    -- Audit
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_user_id,
        'CLIENT',
        'Submitted verification',
        'Order',
        v_order."id",
        jsonb_build_object('verificationStatus', v_order."verificationStatus"),
        jsonb_build_object('verificationStatus', p_status),
        CURRENT_TIMESTAMP
    );

    -- Notification to warehouse team
    INSERT INTO "Notification" ("id", "tenantId", "orderId", "type", "title", "message", "actionUrl", "priority", "read", "createdAt")
    VALUES (
        concat('notif_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_order."id",
        'CLIENT_COMPLETED_VERIFICATION',
        'Client verification completed',
        concat('Order ', v_order."orderNumber", ' was marked ', p_status),
        concat('/dashboard/orders/', v_order."id"),
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


-- 4. Atomic Invoice Generation Function (Preserving Final Invoice rule: verificationStatus = 'VERIFIED')
CREATE OR REPLACE FUNCTION rpc_generate_invoice(
    p_order_id TEXT,
    p_is_final BOOLEAN DEFAULT false,
    p_user_id TEXT DEFAULT NULL,
    p_user_role "Role" DEFAULT 'WAREHOUSE_OWNER'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
    SELECT * INTO v_order FROM "Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Sanitize user
    SELECT "id" INTO p_user_id FROM "User" WHERE "id" = p_user_id;

    -- CRITICAL BUSINESS RULE: Final invoice blocked until verified!
    IF p_is_final AND v_order."verificationStatus" != 'VERIFIED' THEN
        INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt")
        VALUES (
            concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
            v_order."tenantId",
            p_user_id,
            p_user_role,
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
        p_user_id,
        p_user_role,
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
$$;


-- 5. Atomic Payment Recording Function
CREATE OR REPLACE FUNCTION rpc_record_payment(
    p_invoice_id TEXT,
    p_amount NUMERIC(12,2),
    p_method TEXT,
    p_reference TEXT DEFAULT NULL,
    p_proof_url TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL,
    p_user_role "Role" DEFAULT 'ACCOUNTS_TEAM'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice RECORD;
    v_total_paid NUMERIC(12,2);
    v_new_payment_status "PaymentStatus";
    v_payment_id TEXT;
BEGIN
    SELECT * INTO v_invoice FROM "Invoice" WHERE "id" = p_invoice_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
    END IF;

    SELECT "id" INTO p_user_id FROM "User" WHERE "id" = p_user_id;

    v_payment_id := concat('pay_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

    -- Insert Payment
    INSERT INTO "Payment" (
        "id", "tenantId", "invoiceId", "amount", "status",
        "method", "reference", "proofUrl", "paidAt", "createdAt"
    )
    VALUES (
        v_payment_id,
        v_invoice."tenantId",
        v_invoice."id",
        p_amount,
        'PAID',
        p_method,
        p_reference,
        p_proof_url,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

    -- Calculate total paid
    SELECT COALESCE(SUM("amount"), 0) INTO v_total_paid
    FROM "Payment"
    WHERE "invoiceId" = v_invoice."id" AND "status" = 'PAID';

    IF v_total_paid >= v_invoice."total" THEN
        v_new_payment_status := 'PAID';
        -- Update related order status to PAID if currently PAYMENT_PENDING or INVOICED
        UPDATE "Order"
        SET "status" = 'PAID', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = v_invoice."orderId" AND "status" IN ('INVOICED', 'PAYMENT_PENDING');
    ELSIF v_total_paid > 0 THEN
        v_new_payment_status := 'PARTIALLY_PAID';
    ELSE
        v_new_payment_status := 'UNPAID';
    END IF;

    UPDATE "Invoice"
    SET "paymentStatus" = v_new_payment_status,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_invoice."id";

    -- Audit log
    INSERT INTO "AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "newValue", "createdAt")
    VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_invoice."tenantId",
        p_user_id,
        p_user_role,
        'Recorded payment',
        'Payment',
        v_payment_id,
        jsonb_build_object('amount', p_amount, 'paymentStatus', v_new_payment_status),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment_id,
        'invoiceId', v_invoice."id",
        'paymentStatus', v_new_payment_status,
        'totalPaid', v_total_paid
    );
END;
$$;

-- Grant execute permissions to public/anon/authenticated/service_role
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
