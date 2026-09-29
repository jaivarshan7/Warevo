-- ============================================================================
-- Migration: 20261018_000000_order_lifecycle_verification_evidence.sql
-- Description:
--   1. Create OrderComment table, indexes, and RLS policies for shared operational comments
--   2. Implement rpc_add_order_comment and rpc_update_order_comment
--   3. Implement rpc_update_order_before_dispatched (edit order & items before dispatch)
--   4. Implement rpc_delete_order_before_dispatched (safely delete order & invoice before dispatch)
--   5. Implement rpc_update_receiver_notes (allow receiver to edit notes before store verification)
--   6. Create private Supabase Storage bucket 'delivery-evidence' and storage policies
--   7. Update verification_response_select_policy for complete role parity
-- ============================================================================

-- ============================================================================
-- PART 1: OrderComment Table & Indexes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."OrderComment" (
    "id" TEXT PRIMARY KEY DEFAULT concat('oc_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"("id") ON DELETE CASCADE,
    CONSTRAINT "OrderComment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"("id") ON DELETE CASCADE,
    CONSTRAINT "OrderComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrderComment_tenantId_idx" ON public."OrderComment"("tenantId");
CREATE INDEX IF NOT EXISTS "OrderComment_orderId_idx" ON public."OrderComment"("orderId");
CREATE INDEX IF NOT EXISTS "OrderComment_userId_idx" ON public."OrderComment"("userId");
CREATE INDEX IF NOT EXISTS "OrderComment_createdAt_idx" ON public."OrderComment"("createdAt");

-- RLS on OrderComment
ALTER TABLE public."OrderComment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_comment_select_policy" ON public."OrderComment";
CREATE POLICY "order_comment_select_policy"
ON public."OrderComment"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND EXISTS (
        SELECT 1 FROM public."Order" o
        WHERE o."id" = "OrderComment"."orderId"
          AND (
              public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
              OR public.can_access_client(o."clientId")
          )
    )
);

-- Deny direct table mutations (mutations must go through secure RPCs)
DROP POLICY IF EXISTS "deny_direct_insert_order_comment" ON public."OrderComment";
CREATE POLICY "deny_direct_insert_order_comment"
ON public."OrderComment"
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "deny_direct_update_order_comment" ON public."OrderComment";
CREATE POLICY "deny_direct_update_order_comment"
ON public."OrderComment"
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "deny_direct_delete_order_comment" ON public."OrderComment";
CREATE POLICY "deny_direct_delete_order_comment"
ON public."OrderComment"
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);

GRANT SELECT ON TABLE public."OrderComment" TO authenticated;


-- ============================================================================
-- PART 2: Order Comments RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_add_order_comment(
    p_order_id TEXT,
    p_comment TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_order RECORD;
    v_clean_comment TEXT;
    v_comment_id TEXT;
    v_client_employee RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to post order comment';
    END IF;

    v_clean_comment := TRIM(COALESCE(p_comment, ''));
    IF LENGTH(v_clean_comment) = 0 THEN
        RAISE EXCEPTION 'Comment cannot be empty';
    END IF;

    SELECT * INTO v_order FROM public."Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id IS NULL OR v_actor.tenant_id != v_order."tenantId" THEN
            RAISE EXCEPTION 'Cross-tenant comment access denied';
        END IF;
    END IF;

    -- Role and permission check
    IF v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'PLATFORM_ADMIN') THEN
        -- Warehouse staff authorized
        NULL;
    ELSIF v_actor.role IN ('CLIENT', 'CLIENT_ACCOUNTANT') THEN
        IF NOT public.can_access_client(v_order."clientId") THEN
            RAISE EXCEPTION 'Access denied: not authorized for this client order';
        END IF;

        -- Verify client employee is active
        SELECT ce.* INTO v_client_employee
        FROM public."ClientEmployee" ce
        WHERE ce."userId" = v_actor.actor_id AND ce."status" = 'ACTIVE'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Active client employee profile required to comment';
        END IF;
    ELSE
        RAISE EXCEPTION 'User role % is not authorized to add comments', v_actor.role;
    END IF;

    v_comment_id := concat('oc_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

    INSERT INTO public."OrderComment" (
        "id", "tenantId", "orderId", "userId", "comment", "createdAt", "updatedAt"
    ) VALUES (
        v_comment_id,
        v_order."tenantId",
        p_order_id,
        v_actor.actor_id,
        v_clean_comment,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

    -- Record Audit Log
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'ADD_ORDER_COMMENT',
        'OrderComment',
        v_comment_id,
        NULL,
        jsonb_build_object('orderId', p_order_id, 'comment', v_clean_comment),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'commentId', v_comment_id,
        'orderId', p_order_id,
        'userId', v_actor.actor_id,
        'comment', v_clean_comment,
        'createdAt', CURRENT_TIMESTAMP
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_add_order_comment(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_add_order_comment(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_add_order_comment(TEXT, TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION public.rpc_update_order_comment(
    p_comment_id TEXT,
    p_comment TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_comment RECORD;
    v_clean_comment TEXT;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to update order comment';
    END IF;

    v_clean_comment := TRIM(COALESCE(p_comment, ''));
    IF LENGTH(v_clean_comment) = 0 THEN
        RAISE EXCEPTION 'Comment cannot be empty';
    END IF;

    SELECT * INTO v_comment FROM public."OrderComment" WHERE "id" = p_comment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comment % not found', p_comment_id;
    END IF;

    -- Strict ownership: Users may only edit their own comments
    IF v_comment."userId" != v_actor.actor_id THEN
        RAISE EXCEPTION 'You can only edit your own comments';
    END IF;

    IF v_actor.role != 'PLATFORM_ADMIN' AND v_actor.tenant_id != v_comment."tenantId" THEN
        RAISE EXCEPTION 'Cross-tenant access denied';
    END IF;

    UPDATE public."OrderComment"
    SET "comment" = v_clean_comment,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_comment_id;

    -- Record Audit Log
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_comment."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'UPDATE_ORDER_COMMENT',
        'OrderComment',
        p_comment_id,
        jsonb_build_object('comment', v_comment."comment"),
        jsonb_build_object('comment', v_clean_comment),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'commentId', p_comment_id,
        'comment', v_clean_comment,
        'updatedAt', CURRENT_TIMESTAMP
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_order_comment(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_update_order_comment(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_order_comment(TEXT, TEXT) TO authenticated;


-- ============================================================================
-- PART 3: Feature 1 - Edit Order Before Dispatch
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_update_order_before_dispatched(
    p_order_id TEXT,
    p_expected_delivery TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_assigned_staff_id TEXT DEFAULT NULL,
    p_items JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_order RECORD;
    v_invoice RECORD;
    v_staff_tenant_id TEXT;
    v_item JSONB;
    v_item_subtotal NUMERIC(12, 2);
    v_item_tax NUMERIC(12, 2);
    v_item_discount NUMERIC(12, 2);
    v_item_total NUMERIC(12, 2);
    v_subtotal NUMERIC(12, 2) := 0;
    v_tax_total NUMERIC(12, 2) := 0;
    v_discount_total NUMERIC(12, 2) := 0;
    v_total_amount NUMERIC(12, 2) := 0;
    v_cgst NUMERIC(12, 2) := 0;
    v_sgst NUMERIC(12, 2) := 0;
    v_item_quantity INTEGER;
    v_item_unit_price NUMERIC(12, 2);
    v_item_tax_rate NUMERIC(12, 2);
    v_order_item_id TEXT;
    v_invoice_item_id TEXT;
    v_prev_order_data JSONB;
BEGIN
    -- 1. Authenticate actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to update order';
    END IF;

    -- 2. Staff authorization: Only warehouse operations roles can edit orders
    IF NOT (v_actor.role = ANY(ARRAY[
        'WAREHOUSE_OWNER',
        'WAREHOUSE_MODERATOR',
        'WAREHOUSE_STAFF',
        'PLATFORM_ADMIN'
    ])) THEN
        RAISE EXCEPTION 'Unauthorized: Role % cannot modify orders', v_actor.role;
    END IF;

    -- 3. Lock Order row for update
    SELECT * INTO v_order FROM public."Order" WHERE "id" = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- 4. Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id IS NULL OR v_actor.tenant_id != v_order."tenantId" THEN
            RAISE EXCEPTION 'Cross-tenant order modification denied';
        END IF;
    END IF;

    -- 5. Status gate: Allowed strictly before DISPATCHED
    IF v_order.status NOT IN ('DRAFT', 'ISSUED', 'PROCESSING', 'READY_FOR_DISPATCH') THEN
        RAISE EXCEPTION 'Orders can only be modified before dispatch. Current status: %', v_order.status;
    END IF;

    IF v_order."deliveryVerifiedAt" IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot modify order: Delivery verification has already been recorded';
    END IF;

    -- 6. Validate assigned staff if provided
    IF p_assigned_staff_id IS NOT NULL AND p_assigned_staff_id != '' THEN
        SELECT "tenantId" INTO v_staff_tenant_id FROM public."User" WHERE "id" = p_assigned_staff_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Assigned staff user % not found', p_assigned_staff_id;
        END IF;
        IF v_staff_tenant_id IS NOT NULL AND v_staff_tenant_id != v_order."tenantId" THEN
            RAISE EXCEPTION 'Assigned staff belongs to a different tenant';
        END IF;
    END IF;

    -- Snapshot previous order data for audit log
    v_prev_order_data := jsonb_build_object(
        'subtotal', v_order."subtotal",
        'taxTotal', v_order."taxTotal",
        'discountTotal', v_order."discountTotal",
        'totalAmount', v_order."totalAmount",
        'notes', v_order."notes",
        'expectedDelivery', v_order."expectedDelivery",
        'assignedStaffId', v_order."assignedStaffId"
    );

    -- 7. Process line items if provided
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_item_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);
            v_item_unit_price := COALESCE((v_item->>'unitPrice')::NUMERIC, 0);
            v_item_tax_rate := COALESCE((v_item->>'taxRate')::NUMERIC, 0);
            v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

            IF v_item_quantity <= 0 THEN
                RAISE EXCEPTION 'Item quantity must be greater than zero';
            END IF;

            v_item_subtotal := v_item_quantity * v_item_unit_price;
            v_item_tax := ROUND(v_item_subtotal * (v_item_tax_rate / 100.0), 2);
            v_item_total := v_item_subtotal + v_item_tax - v_item_discount;

            v_subtotal := v_subtotal + v_item_subtotal;
            v_tax_total := v_tax_total + v_item_tax;
            v_discount_total := v_discount_total + v_item_discount;
            v_total_amount := v_total_amount + v_item_total;
        END LOOP;

        v_cgst := ROUND(v_tax_total / 2.0, 2);
        v_sgst := v_tax_total - v_cgst;

        -- Replace OrderItem rows atomically
        DELETE FROM public."OrderItem" WHERE "orderId" = p_order_id;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_item_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);
            v_item_unit_price := COALESCE((v_item->>'unitPrice')::NUMERIC, 0);
            v_item_tax_rate := COALESCE((v_item->>'taxRate')::NUMERIC, 0);
            v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

            v_item_subtotal := v_item_quantity * v_item_unit_price;
            v_item_tax := ROUND(v_item_subtotal * (v_item_tax_rate / 100.0), 2);
            v_item_total := v_item_subtotal + v_item_tax - v_item_discount;

            v_order_item_id := concat('oi_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

            INSERT INTO public."OrderItem" (
                "id", "orderId", "productId", "quantity", "unitPrice", "taxRate", "discount", "total"
            ) VALUES (
                v_order_item_id,
                p_order_id,
                v_item->>'productId',
                v_item_quantity,
                v_item_unit_price,
                v_item_tax_rate,
                v_item_discount,
                v_item_total
            );
        END LOOP;

        -- Synchronize linked Invoice and InvoiceItem records
        SELECT * INTO v_invoice FROM public."Invoice" WHERE "orderId" = p_order_id;
        IF FOUND THEN
            IF v_invoice."paymentStatus" != 'UNPAID' THEN
                RAISE EXCEPTION 'Cannot modify line items: Associated invoice has payment status %', v_invoice."paymentStatus";
            END IF;

            UPDATE public."Invoice"
            SET "subtotal" = v_subtotal,
                "cgst" = v_cgst,
                "sgst" = v_sgst,
                "discountTotal" = v_discount_total,
                "total" = v_total_amount,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = v_invoice."id";

            DELETE FROM public."InvoiceItem" WHERE "invoiceId" = v_invoice."id";

            FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
            LOOP
                v_item_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);
                v_item_unit_price := COALESCE((v_item->>'unitPrice')::NUMERIC, 0);
                v_item_tax_rate := COALESCE((v_item->>'taxRate')::NUMERIC, 0);
                v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

                v_item_subtotal := v_item_quantity * v_item_unit_price;
                v_item_tax := ROUND(v_item_subtotal * (v_item_tax_rate / 100.0), 2);
                v_item_total := v_item_subtotal + v_item_tax - v_item_discount;

                v_invoice_item_id := concat('ii_', substr(md5(random()::text || clock_timestamp()::text), 1, 16));

                INSERT INTO public."InvoiceItem" (
                    "id", "invoiceId", "productId", "quantity", "rate", "discount", "cgst", "sgst", "igst", "total"
                ) VALUES (
                    v_invoice_item_id,
                    v_invoice."id",
                    v_item->>'productId',
                    v_item_quantity,
                    v_item_unit_price,
                    v_item_discount,
                    ROUND(v_item_tax / 2.0, 2),
                    v_item_tax - ROUND(v_item_tax / 2.0, 2),
                    0,
                    v_item_total
                );
            END LOOP;
        END IF;

        -- Update Order with new financial totals
        UPDATE public."Order"
        SET "subtotal" = v_subtotal,
            "taxTotal" = v_tax_total,
            "discountTotal" = v_discount_total,
            "totalAmount" = v_total_amount,
            "notes" = COALESCE(p_notes, "notes"),
            "expectedDelivery" = COALESCE(p_expected_delivery, "expectedDelivery"),
            "assignedStaffId" = CASE WHEN p_assigned_staff_id IS NOT NULL THEN NULLIF(p_assigned_staff_id, '') ELSE "assignedStaffId" END,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = p_order_id;
    ELSE
        -- Update non-item fields only
        UPDATE public."Order"
        SET "notes" = COALESCE(p_notes, "notes"),
            "expectedDelivery" = COALESCE(p_expected_delivery, "expectedDelivery"),
            "assignedStaffId" = CASE WHEN p_assigned_staff_id IS NOT NULL THEN NULLIF(p_assigned_staff_id, '') ELSE "assignedStaffId" END,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = p_order_id;
    END IF;

    -- 8. Record OrderStatusHistory event
    INSERT INTO public."OrderStatusHistory" (
        "id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt"
    ) VALUES (
        concat('osh_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        p_order_id,
        v_order.status,
        v_order.status,
        v_actor.actor_id,
        'Order details updated before dispatch',
        CURRENT_TIMESTAMP
    );

    -- 9. Record AuditLog
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'UPDATE_ORDER_BEFORE_DISPATCHED',
        'Order',
        p_order_id,
        v_prev_order_data,
        jsonb_build_object(
            'subtotal', COALESCE(v_subtotal, v_order."subtotal"),
            'totalAmount', COALESCE(v_total_amount, v_order."totalAmount"),
            'notes', COALESCE(p_notes, v_order."notes"),
            'expectedDelivery', COALESCE(p_expected_delivery, v_order."expectedDelivery"),
            'assignedStaffId', p_assigned_staff_id
        ),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', p_order_id,
        'orderNumber', v_order."orderNumber",
        'totalAmount', COALESCE(v_total_amount, v_order."totalAmount"),
        'updatedAt', CURRENT_TIMESTAMP
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_order_before_dispatched(TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_update_order_before_dispatched(TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_order_before_dispatched(TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB) TO authenticated;


-- ============================================================================
-- PART 4: Feature 2 - Delete Order Before Dispatch
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_delete_order_before_dispatched(
    p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_order RECORD;
    v_invoice RECORD;
    v_payment_count INTEGER;
BEGIN
    -- 1. Authenticate actor
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to delete order';
    END IF;

    -- 2. Staff authorization: Only warehouse owners/moderators/platform admin
    IF NOT (v_actor.role = ANY(ARRAY[
        'WAREHOUSE_OWNER',
        'WAREHOUSE_MODERATOR',
        'PLATFORM_ADMIN'
    ])) THEN
        RAISE EXCEPTION 'Unauthorized: Only warehouse management can delete orders';
    END IF;

    -- 3. Lock Order row
    SELECT * INTO v_order FROM public."Order" WHERE "id" = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- 4. Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id IS NULL OR v_actor.tenant_id != v_order."tenantId" THEN
            RAISE EXCEPTION 'Cross-tenant order deletion denied';
        END IF;
    END IF;

    -- 5. Status check: Pre-dispatch only
    IF v_order.status NOT IN ('DRAFT', 'ISSUED', 'PROCESSING', 'READY_FOR_DISPATCH') THEN
        RAISE EXCEPTION 'Orders can only be deleted before dispatch. Current status: %', v_order.status;
    END IF;

    IF v_order."deliveryVerifiedAt" IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot delete order: Delivery verification has already been recorded';
    END IF;

    -- 6. Safely handle dependent Invoice records
    SELECT * INTO v_invoice FROM public."Invoice" WHERE "orderId" = p_order_id;
    IF FOUND THEN
        -- Check for any payments
        SELECT COUNT(*) INTO v_payment_count FROM public."Payment" WHERE "invoiceId" = v_invoice."id";
        IF v_payment_count > 0 THEN
            RAISE EXCEPTION 'Cannot delete order: Linked invoice has recorded payments';
        END IF;

        -- Delete InvoiceItems then Invoice to resolve ON DELETE RESTRICT
        DELETE FROM public."InvoiceItem" WHERE "invoiceId" = v_invoice."id";
        DELETE FROM public."Invoice" WHERE "id" = v_invoice."id";
    END IF;

    -- 7. Clean up Notification references
    UPDATE public."Notification" SET "orderId" = NULL WHERE "orderId" = p_order_id;

    -- 8. Record deletion in AuditLog BEFORE deleting Order row
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'DELETE_ORDER_BEFORE_DISPATCHED',
        'Order',
        p_order_id,
        jsonb_build_object(
            'orderNumber', v_order."orderNumber",
            'clientId', v_order."clientId",
            'status', v_order.status,
            'totalAmount', v_order."totalAmount",
            'invoiceNumber', CASE WHEN v_invoice."id" IS NOT NULL THEN v_invoice."invoiceNumber" ELSE NULL END
        ),
        NULL,
        CURRENT_TIMESTAMP
    );

    -- 9. Delete Order row (Native CASCADE will delete OrderItem, OrderStatusHistory, OrderComment, VerificationResponse)
    DELETE FROM public."Order" WHERE "id" = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'orderId', p_order_id,
        'orderNumber', v_order."orderNumber",
        'deletedAt', CURRENT_TIMESTAMP
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_delete_order_before_dispatched(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_delete_order_before_dispatched(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_delete_order_before_dispatched(TEXT) TO authenticated;


-- ============================================================================
-- PART 5: Feature 3 - Receiver Notes Editing
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_update_receiver_notes(
    p_order_id TEXT,
    p_comments TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_order RECORD;
    v_vr RECORD;
    v_clean_comments TEXT;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to update receiver notes';
    END IF;

    SELECT * INTO v_order FROM public."Order" WHERE "id" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    SELECT * INTO v_vr FROM public."VerificationResponse" WHERE "orderId" = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Verification record for order % not found', p_order_id;
    END IF;

    -- Lifecycle check: Editable strictly while order is DISPATCHED and before store verification
    IF v_order.status != 'DISPATCHED' THEN
        RAISE EXCEPTION 'Receiver notes can only be updated while order is DISPATCHED. Current status: %', v_order.status;
    END IF;

    IF v_order."storeVerifiedAt" IS NOT NULL OR v_order.status = 'VERIFIED' THEN
        RAISE EXCEPTION 'Verification is finalized and receiver notes can no longer be edited';
    END IF;

    -- Ownership check: Either original verifier OR authorized client manager/staff
    IF v_actor.role != 'PLATFORM_ADMIN' THEN
        IF v_actor.tenant_id IS NULL OR v_actor.tenant_id != v_order."tenantId" THEN
            RAISE EXCEPTION 'Cross-tenant access denied';
        END IF;

        IF v_vr."userId" IS NOT NULL AND v_vr."userId" != v_actor.actor_id THEN
            IF NOT (v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR') OR (v_actor.role = 'CLIENT' AND public.has_permission('DELIVERY_VERIFY') AND public.can_access_client(v_order."clientId"))) THEN
                RAISE EXCEPTION 'You can only edit your own verification notes';
            END IF;
        END IF;
    END IF;

    v_clean_comments := TRIM(COALESCE(p_comments, ''));

    UPDATE public."VerificationResponse"
    SET "comments" = v_clean_comments
    WHERE "id" = v_vr."id";

    -- Record Audit Log
    INSERT INTO public."AuditLog" (
        "id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "createdAt"
    ) VALUES (
        concat('aud_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
        v_order."tenantId",
        v_actor.actor_id,
        v_actor.role::"Role",
        'UPDATE_RECEIVER_NOTES',
        'VerificationResponse',
        v_vr."id",
        jsonb_build_object('comments', v_vr."comments"),
        jsonb_build_object('comments', v_clean_comments),
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', p_order_id,
        'comments', v_clean_comments,
        'updatedAt', CURRENT_TIMESTAMP
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_receiver_notes(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_update_receiver_notes(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_receiver_notes(TEXT, TEXT) TO authenticated;


-- ============================================================================
-- PART 6: Storage Bucket 'delivery-evidence' & Storage Policies
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-evidence', 'delivery-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE OR REPLACE FUNCTION public.can_read_delivery_evidence_storage(
    p_object_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_path_tenant_id TEXT;
    v_path_order_id  TEXT;
    v_order_tenant_id TEXT;
    v_order_client_id TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    v_path_tenant_id := split_part(p_object_name, '/', 1);
    v_path_order_id  := split_part(p_object_name, '/', 2);

    IF v_path_tenant_id = '' OR v_path_order_id = '' THEN
        RETURN FALSE;
    END IF;

    SELECT o."tenantId", o."clientId"
    INTO v_order_tenant_id, v_order_client_id
    FROM public."Order" o
    WHERE o."id" = v_path_order_id;

    IF NOT FOUND OR v_order_tenant_id != v_path_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- Authorize reading matching order_select_policy
    RETURN public.can_access_tenant(v_order_tenant_id)
       AND (
           public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
           OR public.can_access_client(v_order_client_id)
       );
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_delivery_evidence_storage(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_delivery_evidence_storage(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_delivery_evidence_storage(TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION public.can_upload_delivery_evidence_storage(
    p_object_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor RECORD;
    v_path_tenant_id TEXT;
    v_path_order_id  TEXT;
    v_order RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.get_current_actor();
    IF NOT FOUND OR v_actor.actor_id IS NULL THEN
        RETURN FALSE;
    END IF;

    v_path_tenant_id := split_part(p_object_name, '/', 1);
    v_path_order_id  := split_part(p_object_name, '/', 2);

    IF v_path_tenant_id = '' OR v_path_order_id = '' THEN
        RETURN FALSE;
    END IF;

    SELECT * INTO v_order FROM public."Order" WHERE "id" = v_path_order_id;
    IF NOT FOUND OR v_order."tenantId" != v_path_tenant_id THEN
        RETURN FALSE;
    END IF;

    -- Tenant isolation check
    IF v_actor.role != 'PLATFORM_ADMIN' AND v_actor.tenant_id != v_order."tenantId" THEN
        RETURN FALSE;
    END IF;

    -- Order must be in DISPATCHED status
    IF v_order.status != 'DISPATCHED' THEN
        RETURN FALSE;
    END IF;

    -- Verification must not be finalized by store keeper
    IF v_order."storeVerifiedAt" IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    -- Staff can upload or Client with DELIVERY_VERIFY permission
    IF v_actor.role IN ('WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'PLATFORM_ADMIN') THEN
        RETURN TRUE;
    ELSIF v_actor.role = 'CLIENT' THEN
        IF public.has_permission('DELIVERY_VERIFY') AND public.can_access_client(v_order."clientId") THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_upload_delivery_evidence_storage(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_upload_delivery_evidence_storage(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_upload_delivery_evidence_storage(TEXT) TO authenticated;


DROP POLICY IF EXISTS "Allow authenticated select from delivery-evidence" ON storage.objects;
CREATE POLICY "Allow authenticated select from delivery-evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-evidence'
    AND public.can_read_delivery_evidence_storage(name)
  );

DROP POLICY IF EXISTS "Allow authenticated upload to delivery-evidence" ON storage.objects;
CREATE POLICY "Allow authenticated upload to delivery-evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-evidence'
    AND auth.role() = 'authenticated'
    AND public.can_upload_delivery_evidence_storage(name)
  );

DROP POLICY IF EXISTS "Allow authenticated delete from delivery-evidence" ON storage.objects;
CREATE POLICY "Allow authenticated delete from delivery-evidence"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'delivery-evidence'
    AND public.can_upload_delivery_evidence_storage(name)
  );


-- ============================================================================
-- PART 7: Parity Update on VerificationResponse Select Policy
-- ============================================================================

DROP POLICY IF EXISTS "verification_response_select_policy" ON public."VerificationResponse";
CREATE POLICY "verification_response_select_policy"
ON public."VerificationResponse"
FOR SELECT
TO authenticated
USING (
    public.can_access_tenant("tenantId")
    AND (
        public.has_role(ARRAY['PLATFORM_ADMIN', 'WAREHOUSE_OWNER', 'WAREHOUSE_MODERATOR', 'WAREHOUSE_STAFF', 'ACCOUNTANT', 'ACCOUNTS_TEAM'])
        OR public.can_access_client("clientId")
    )
);
