import { supabase } from "./supabase";
import { createEmployeeWithAuth } from "./employeeService";
import {
  Order,
  Inventory,
  Client,
  Invoice,
  Notification,
  NotificationSettings,
  NotificationType,
  AuditLog,
  OrderStatus,
  InventoryMovementType,
  VerificationStatus,
  Role,
  User,
  UserStatus,
  TenantSettings,
  ClientEmployeeRole,
  ALLOWED_EMPLOYEE_ROLES
} from "@/types";

export function isClientRole(role?: Role | null): boolean {
  return role === "CLIENT" || role === "CLIENT_ACCOUNTANT";
}

/**
 * Shared helper: resolves the full set of Client IDs that a user should have access to.
 * If the user's Client record has a companyGroupId, returns ALL Client IDs in that
 * company group (within the same tenant). Otherwise returns just the single clientId.
 *
 * This is the SINGLE SOURCE OF TRUTH for company-level access resolution.
 * Used by fetchOrders, fetchOrderById, fetchInvoices, fetchInvoiceById, fetchDashboardSummary.
 */
async function resolveCompanyClientIds(
  userId?: string | null,
  fallbackClientId?: string | null
): Promise<string[]> {
  if (!userId) return fallbackClientId ? [fallbackClientId] : [];

  const { data: userClient } = await supabase
    .from("Client")
    .select("id, companyGroupId, tenantId")
    .eq("userId", userId)
    .single();

  if (userClient?.companyGroupId) {
    // Find all Client records in the same company group and tenant
    const { data: companyClients } = await supabase
      .from("Client")
      .select("id")
      .eq("companyGroupId", userClient.companyGroupId)
      .eq("tenantId", userClient.tenantId);

    const ids = companyClients?.map(c => c.id) || [];
    if (ids.length > 0) return ids;
  }

  // Fallback: no companyGroup or no members found — use single clientId
  return fallbackClientId ? [fallbackClientId] : (userClient ? [userClient.id] : []);
}

/**
 * Shared helper: verifies that a given record's clientId belongs to the user's company group.
 * Used as defense-in-depth post-fetch ownership check in fetchOrderById, fetchInvoiceById.
 */
async function verifyCompanyOwnership(
  recordClientId: string,
  userId?: string | null,
  fallbackClientId?: string | null
): Promise<boolean> {
  if (!userId) return recordClientId === fallbackClientId;

  const { data: userClient } = await supabase
    .from("Client")
    .select("companyGroupId")
    .eq("userId", userId)
    .single();

  if (userClient?.companyGroupId) {
    // Verify the record's client belongs to the same company group
    const { data: recordClient } = await supabase
      .from("Client")
      .select("companyGroupId")
      .eq("id", recordClientId)
      .single();

    return recordClient?.companyGroupId === userClient.companyGroupId;
  }

  // No companyGroupId — strict clientId match required
  return recordClientId === fallbackClientId;
}

export async function fetchDashboardSummary(
  tenantId?: string | null,
  role?: Role,
  userId?: string | null,
  clientId?: string | null
) {
  try {
    let orderQuery = supabase
      .from("Order")
      .select("*, client:Client(*), createdBy:User!createdById(*), assignedStaff:User!assignedStaffId(*)")
      .order("createdAt", { ascending: false });

    let invoiceQuery = supabase
      .from("Invoice")
      .select("*, client:Client(*)")
      .order("createdAt", { ascending: false });

    let inventoryQuery = supabase
      .from("Inventory")
      .select("*, product:Product(*), warehouse:Warehouse(*)");

    let clientQuery = supabase
      .from("Client")
      .select("*", { count: "exact", head: true });

    if (role !== "PLATFORM_ADMIN" && tenantId) {
      orderQuery = orderQuery.eq("tenantId", tenantId);
      invoiceQuery = invoiceQuery.eq("tenantId", tenantId);
      inventoryQuery = inventoryQuery.eq("tenantId", tenantId);
      clientQuery = clientQuery.eq("tenantId", tenantId);
    }

    if (isClientRole(role)) {
      if (!clientId) {
        orderQuery = orderQuery.eq("id", "none");
        invoiceQuery = invoiceQuery.eq("id", "none");
      } else {
        // Resolve company-wide client IDs for proper company group visibility
        const companyClientIds = await resolveCompanyClientIds(userId, clientId);
        if (companyClientIds.length > 0) {
          orderQuery = orderQuery.in("clientId", companyClientIds);
          invoiceQuery = invoiceQuery.in("clientId", companyClientIds);
        } else {
          orderQuery = orderQuery.eq("clientId", clientId);
          invoiceQuery = invoiceQuery.eq("clientId", clientId);
        }
      }
    }

    if (role === "WAREHOUSE_STAFF" && userId) {
      // Show orders assigned to staff or in active fulfillment states
      orderQuery = orderQuery.or(`assignedStaffId.eq.${userId},status.in.(ISSUED,PROCESSING,READY_FOR_DISPATCH)`);
    }

    const [ordersRes, invoicesRes, inventoryRes, clientCountRes] = await Promise.all([
      orderQuery.limit(10),
      invoiceQuery.limit(10),
      inventoryQuery.limit(10),
      clientQuery
    ]);

    return {
      orders: (ordersRes.data as Order[]) || [],
      invoices: (invoicesRes.data as Invoice[]) || [],
      inventory: (inventoryRes.data as Inventory[]) || [],
      totalClients: clientCountRes.count || 0
    };
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return { orders: [], invoices: [], inventory: [], totalClients: 0 };
  }
}

// ======================== ORDERS ========================

export async function fetchOrders(
  tenantId?: string | null,
  role?: Role,
  clientId?: string | null,
  userId?: string | null
): Promise<Order[]> {
  let query = supabase
    .from("Order")
    .select("*, client:Client(*), createdBy:User!createdById(*), assignedStaff:User!assignedStaffId(*), items:OrderItem(*, product:Product(*))")
    .order("createdAt", { ascending: false });
  
  if (role !== "PLATFORM_ADMIN" && tenantId) {
    query = query.eq("tenantId", tenantId);
  }
  if (isClientRole(role)) {
    if (!clientId) {
      // Client users must never see all orders if clientId is absent
      return [];
    }
    
    // Resolve company-wide client IDs using shared helper
    const companyClientIds = await resolveCompanyClientIds(userId, clientId);
    if (companyClientIds.length > 0) {
      query = query.in("clientId", companyClientIds);
    } else {
      query = query.eq("clientId", clientId);
    }
  } else if (clientId) {
    query = query.eq("clientId", clientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Order[]) || [];
}

export async function fetchOrderById(
  orderId: string,
  tenantId?: string | null,
  clientId?: string | null,
  userRole?: Role,
  userId?: string | null
): Promise<Order | null> {
  // If client user doesn't have a valid clientId, immediately reject
  if (isClientRole(userRole) && !clientId) {
    return null;
  }

  let query = supabase
    .from("Order")
    .select(`
      *,
      client:Client(*),
      createdBy:User!createdById(*),
      assignedStaff:User!assignedStaffId(*),
      items:OrderItem(*, product:Product(*))
    `)
    .eq("id", orderId);

  // SECURITY: Filter by tenantId for non-PLATFORM_ADMIN
  // This prevents cross-tenant access
  if (userRole && userRole !== "PLATFORM_ADMIN" && tenantId) {
    query = query.eq("tenantId", tenantId);
  }

  // SECURITY: Client users can ONLY see their own company orders
  // This prevents Client A from seeing Client B orders in the same tenant
  if (isClientRole(userRole) && clientId) {
    // Resolve company-wide client IDs using shared helper
    const companyClientIds = await resolveCompanyClientIds(userId, clientId);
    if (companyClientIds.length > 0) {
      query = query.in("clientId", companyClientIds);
    } else {
      query = query.eq("clientId", clientId);
    }
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Error fetching order by ID:", error);
    return null;
  }
  if (!data) return null;

  // Post-fetch ownership verification as defense-in-depth
  // For company-group users, verify order belongs to their company
  if (isClientRole(userRole) && clientId) {
    const isOwner = await verifyCompanyOwnership(data.clientId, userId, clientId);
    if (!isOwner) return null;
  }
  
  if (userRole && userRole !== "PLATFORM_ADMIN" && tenantId && data.tenantId !== tenantId) {
    return null;
  }

  const [historyResult, verificationResult] = await Promise.all([
    supabase
      .from("OrderStatusHistory")
      .select("*, changedBy:User!changedById(*)")
      .eq("orderId", orderId)
      .order("createdAt", { ascending: true }),
    supabase
      .from("VerificationResponse")
      .select("*")
      .eq("orderId", orderId)
      .maybeSingle()
  ]);

  return {
    ...(data as Order),
    statusHistory: (historyResult.data || []) as Order["statusHistory"],
    verification: (verificationResult.data || null) as Order["verification"]
  };
}
export async function transitionOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  notes?: string,
  userId?: string | null,
  userRole?: Role
) {
  const { data, error } = await supabase.rpc("rpc_transition_order", {
    p_order_id: orderId,
    p_next_status: nextStatus,
    p_notes: notes || null,
    p_user_id: userId || null,
    p_user_role: userRole || "WAREHOUSE_STAFF"
  });

  if (error) throw error;
  return data;
}

export async function createOrder(payload: {
  tenantId: string;
  clientId: string;
  createdById: string;
  assignedStaffId?: string;
  expectedDelivery?: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
}) {
  const latestRes = await supabase
    .from("Order")
    .select("orderNumber")
    .eq("tenantId", payload.tenantId)
    .order("createdAt", { ascending: false })
    .limit(1);

  const lastNum = latestRes.data?.[0]?.orderNumber
    ? parseInt(latestRes.data[0].orderNumber.replace(/[^0-9]/g, "").slice(-6), 10) || 0
    : 0;

  const orderNumber = `ORD-2026-${String(lastNum + 1).padStart(6, "0")}`;
  const subtotal = payload.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxTotal = payload.items.reduce(
    (sum, item) => sum + (item.quantity * item.unitPrice * item.taxRate) / 100,
    0
  );
  const totalAmount = subtotal + taxTotal;

  const orderId = `ord_${Math.random().toString(36).substring(2, 11)}`;

  // Calculate CGST/SGST (assuming intra-state GST)
  const cgst = taxTotal / 2;
  const sgst = taxTotal / 2;

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from("Order")
    .insert({
      id: orderId,
      tenantId: payload.tenantId,
      clientId: payload.clientId,
      orderNumber,
      status: "ISSUED",
      verificationStatus: "PENDING",
      subtotal,
      taxTotal,
      discountTotal: 0,
      totalAmount,
      notes: payload.notes || null,
      createdById: payload.createdById,
      assignedStaffId: payload.assignedStaffId || null,
      expectedDelivery: payload.expectedDelivery || null
    })
    .select()
    .single();

  if (orderErr) throw orderErr;

  // Insert items
  const itemsToInsert = payload.items.map((item) => ({
    id: `oi_${Math.random().toString(36).substring(2, 11)}`,
    orderId,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate,
    discount: 0,
    total: item.quantity * item.unitPrice * (1 + item.taxRate / 100)
  }));

  const { error: itemErr } = await supabase.from("OrderItem").insert(itemsToInsert);
  if (itemErr) throw itemErr;

  // 4. Create invoice automatically (new feature)
  try {
    await createInvoiceForOrder(orderId, payload.tenantId, payload.clientId, taxTotal);
  } catch (err) {
    console.error(
      `Invoice creation failed for order ${orderId}:`,
      err
    );
    // Re-throw as a user-friendly error rather than silently ignoring
    throw new Error(
      `Order created successfully, but invoice generation failed. Order ID: ${orderId}. Please contact support if this issue persists.`
    );
  }

  return order;
}

// createInvoiceForOrder function removed - invoice creation now happens
// atomically within rpc_create_order_with_invoice to ensure transactional integrity

export async function createEnhancedOrder(payload: {
  tenantId: string;
  clientId: string;
  selectedContactIds?: string[];
  createdById: string;
  assignedStaffId?: string;
  expectedDelivery?: string;
  notes?: string;
  status?: OrderStatus;
  eWayBill?: {
    transporterName?: string;
    vehicleNumber?: string;
    distanceKm?: number;
    transportMode?: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discount?: number;
  }>;
}) {
  const initialStatus: OrderStatus = payload.status || "ISSUED";

  // Use atomic RPC to create order + invoice in a single database transaction
  // This ensures that either both are created or neither is created
  const { data, error } = await supabase.rpc("rpc_create_order_with_invoice", {
    p_tenant_id: payload.tenantId,
    p_client_id: payload.clientId,
    p_created_by_id: payload.createdById,
    p_selected_contact_ids: payload.selectedContactIds || null,
    p_assigned_staff_id: payload.assignedStaffId || null,
    p_expected_delivery: payload.expectedDelivery || null,
    p_notes: payload.notes || null,
    p_status: initialStatus,
    p_eway_bill: payload.eWayBill || null,
    p_items: payload.items
  });

  if (error) {
    console.error("Atomic order creation failed:", error);
    throw new Error(
      `Failed to create order with invoice: ${error.message}. The operation was rolled back and no records were created.`
    );
  }

  if (!data || !data.success) {
    throw new Error("Order creation failed: RPC returned unsuccessful result");
  }

  // Fetch the created order to return in the same format as before
  const { data: order, error: fetchErr } = await supabase
    .from("Order")
    .select("*")
    .eq("id", data.orderId)
    .single();

  if (fetchErr) {
    console.error("Failed to fetch created order:", fetchErr);
    // Order was created successfully, but we can't fetch it
    // Return a minimal object with the data from RPC
    return {
      id: data.orderId,
      orderNumber: data.orderNumber,
      tenantId: payload.tenantId,
      clientId: payload.clientId,
      status: initialStatus
    };
  }

  return order;
}

export async function submitDetailedOrderVerification(payload: {
  orderId: string;
  tenantId: string;
  clientId: string;
  status: VerificationStatus;
  responses: Array<{ text: string; checked: boolean }>;
  comments?: string;
  itemReceivedMap?: Record<string, { received: number; damaged: number }>;
  userId?: string | null;
  userRole?: Role;
}) {
  const nextOrderStatus: OrderStatus =
    payload.status === "VERIFIED"
      ? "VERIFIED"
      : payload.status === "PARTIALLY_VERIFIED"
      ? "PARTIALLY_VERIFIED"
      : "REJECTED";

  // 1. Upsert VerificationResponse
  const respId = `vr_${Math.random().toString(36).substring(2, 10)}`;
  await supabase.from("VerificationResponse").upsert({
    id: respId,
    tenantId: payload.tenantId,
    orderId: payload.orderId,
    clientId: payload.clientId,
    userId: payload.userId || null,
    status: payload.status,
    responses: payload.responses,
    comments: payload.comments || null
  }, { onConflict: "orderId" });

  // 2. Update Order status
  const { data: updatedOrder, error: orderErr } = await supabase
    .from("Order")
    .update({
      verificationStatus: payload.status,
      status: nextOrderStatus,
      updatedAt: new Date().toISOString()
    })
    .eq("id", payload.orderId)
    .select()
    .single();

  if (orderErr) throw orderErr;

  // 3. Status History
  await supabase.from("OrderStatusHistory").insert({
    id: `osh_${Math.random().toString(36).substring(2, 10)}`,
    tenantId: payload.tenantId,
    orderId: payload.orderId,
    newStatus: nextOrderStatus,
    changedById: payload.userId || null,
    notes: payload.comments || `Delivery marked as ${payload.status}`
  });

  // 4. Audit Log
  if (payload.userId) {
    await supabase.from("AuditLog").insert({
      id: `al_${Math.random().toString(36).substring(2, 10)}`,
      tenantId: payload.tenantId,
      userId: payload.userId,
      userRole: payload.userRole || "PRODUCT_RECEIVER",
      action: "Submitted delivery verification checklist",
      entity: "Order",
      entityId: payload.orderId,
      newValue: { verificationStatus: payload.status, status: nextOrderStatus }
    });
  }

  // 5. Notification
  await supabase.from("Notification").insert({
    id: `notif_${Math.random().toString(36).substring(2, 10)}`,
    tenantId: payload.tenantId,
    orderId: payload.orderId,
    type: "CLIENT_COMPLETED_VERIFICATION",
    title: "Delivery Inspection Submitted",
    message: `Order delivery verification completed with status: ${payload.status}`,
    priority: "HIGH",
    actionUrl: `/operations/orders/${payload.orderId}`,
    read: false
  });

  return updatedOrder;
}

// ======================== INVENTORY ========================

export async function fetchInventory(tenantId?: string | null): Promise<Inventory[]> {
  let query = supabase
    .from("Inventory")
    .select("*, product:Product(*, category:Category(*)), warehouse:Warehouse(*), location:WarehouseLocation(*)")
    .order("updatedAt", { ascending: false });

  if (tenantId) {
    query = query.eq("tenantId", tenantId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Inventory[]) || [];
}

export async function adjustInventoryStock(
  inventoryId: string,
  quantity: number,
  type: InventoryMovementType,
  notes?: string,
  userId?: string | null,
  userRole?: Role
) {
  const { data, error } = await supabase.rpc("rpc_receive_or_adjust_stock", {
    p_inventory_id: inventoryId,
    p_quantity: quantity,
    p_type: type,
    p_notes: notes || null,
    p_user_id: userId || null,
    p_user_role: userRole || "WAREHOUSE_STAFF"
  });

  if (error) throw error;
  return data;
}

export async function fetchInventoryMovements(tenantId?: string | null) {
  let query = supabase
    .from("InventoryMovement")
    .select("*, product:Product(*)")
    .order("createdAt", { ascending: false })
    .limit(50);

  if (tenantId) {
    query = query.eq("tenantId", tenantId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchWarehouses(tenantId?: string | null) {
  let query = supabase.from("Warehouse").select("*").order("name", { ascending: true });
  if (tenantId) query = query.eq("tenantId", tenantId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchCategories(tenantId?: string | null) {
  let query = supabase.from("Category").select("*").order("name", { ascending: true });
  if (tenantId) query = query.eq("tenantId", tenantId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createProductWithInitialStock(payload: {
  tenantId: string;
  name: string;
  sku: string;
  brand?: string;
  categoryName?: string;
  unit?: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  gstRate: number;
  minimumStock: number;
  reorderLevel: number;
  warehouseId: string;
  zone?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  initialQuantity: number;
  userId?: string | null;
  userRole?: Role;
}) {
  // 1. Resolve category
  let categoryId: string | null = null;
  if (payload.categoryName?.trim()) {
    const catName = payload.categoryName.trim();
    const existingCat = await supabase
      .from("Category")
      .select("id")
      .eq("tenantId", payload.tenantId)
      .eq("name", catName)
      .maybeSingle();

    if (existingCat.data?.id) {
      categoryId = existingCat.data.id;
    } else {
      const newCatId = `cat_${Math.random().toString(36).substring(2, 10)}`;
      const { data: catData } = await supabase
        .from("Category")
        .insert({
          id: newCatId,
          tenantId: payload.tenantId,
          name: catName
        })
        .select("id")
        .single();
      categoryId = catData?.id || newCatId;
    }
  }

  // 2. Create Product
  const productId = `prod_${Math.random().toString(36).substring(2, 11)}`;
  const { data: product, error: prodErr } = await supabase
    .from("Product")
    .insert({
      id: productId,
      tenantId: payload.tenantId,
      categoryId,
      sku: payload.sku.toUpperCase().trim(),
      name: payload.name.trim(),
      brand: payload.brand?.trim() || null,
      description: payload.description?.trim() || null,
      unit: payload.unit || "pcs",
      purchasePrice: payload.purchasePrice || 0,
      sellingPrice: payload.sellingPrice || 0,
      gstRate: payload.gstRate || 18,
      minimumStock: payload.minimumStock || 10,
      reorderLevel: payload.reorderLevel || 20,
      status: "ACTIVE"
    })
    .select()
    .single();

  if (prodErr) throw prodErr;

  // 3. Location
  const zone = (payload.zone || "A").toUpperCase().trim();
  const rack = (payload.rack || "R1").toUpperCase().trim();
  const shelf = (payload.shelf || "S1").toUpperCase().trim();
  const bin = (payload.bin || "B1").toUpperCase().trim();

  let locationId: string | null = null;
  const existingLoc = await supabase
    .from("WarehouseLocation")
    .select("id")
    .eq("tenantId", payload.tenantId)
    .eq("warehouseId", payload.warehouseId)
    .eq("zone", zone)
    .eq("rack", rack)
    .eq("shelf", shelf)
    .eq("bin", bin)
    .maybeSingle();

  if (existingLoc.data?.id) {
    locationId = existingLoc.data.id;
  } else {
    locationId = `loc_${Math.random().toString(36).substring(2, 10)}`;
    await supabase.from("WarehouseLocation").insert({
      id: locationId,
      tenantId: payload.tenantId,
      warehouseId: payload.warehouseId,
      zone,
      rack,
      shelf,
      bin
    });
  }

  // 4. Create Inventory record
  const inventoryId = `inv_${Math.random().toString(36).substring(2, 11)}`;
  const initialQty = Math.max(0, payload.initialQuantity || 0);
  const { data: inventory, error: invErr } = await supabase
    .from("Inventory")
    .insert({
      id: inventoryId,
      tenantId: payload.tenantId,
      warehouseId: payload.warehouseId,
      locationId,
      productId,
      totalQuantity: initialQty,
      availableQuantity: initialQty,
      reservedQuantity: 0,
      damagedQuantity: 0
    })
    .select()
    .single();

  if (invErr) throw invErr;

  // 5. Initial stock movement
  if (initialQty > 0) {
    await supabase.from("InventoryMovement").insert({
      id: `im_${Math.random().toString(36).substring(2, 10)}`,
      tenantId: payload.tenantId,
      inventoryId,
      productId,
      type: "RECEIPT",
      quantity: initialQty,
      previousQuantity: 0,
      newQuantity: initialQty,
      notes: "Initial stock intake on product creation",
      createdById: payload.userId || null
    });
  }

  // 6. Audit log
  if (payload.userId) {
    await supabase.from("AuditLog").insert({
      id: `al_${Math.random().toString(36).substring(2, 10)}`,
      tenantId: payload.tenantId,
      userId: payload.userId,
      userRole: payload.userRole || "WAREHOUSE_STAFF",
      action: "Created new catalog product & stock intake",
      entity: "Product",
      entityId: productId,
      newValue: { sku: payload.sku, name: payload.name, initialQuantity: initialQty }
    });
  }

  return { product, inventory };
}

// ======================== CLIENTS ========================

export async function fetchClients(tenantId?: string | null): Promise<Client[]> {
  let query = supabase
    .from("Client")
    .select("*, user:User(*)")
    .order("companyName", { ascending: true });

  if (tenantId) {
    query = query.eq("tenantId", tenantId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Client[]) || [];
}

export async function createClientRecord(payload: {
  tenantId: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email?: string;
  gstNumber?: string;
  billingAddress: string;
  shippingAddress: string;
}) {
  const id = `cl_${Math.random().toString(36).substring(2, 11)}`;
  const { data, error } = await supabase
    .from("Client")
    .insert({
      id,
      ...payload,
      status: "ACTIVE"
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClientRecord(
  id: string,
  payload: Partial<{
    companyName: string;
    contactPerson: string;
    mobile: string;
    email: string;
    gstNumber: string;
    billingAddress: string;
    shippingAddress: string;
    status: string;
    employeeRole: string;
  }>
) {
  const { data, error } = await supabase
    .from("Client")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ======================== VERIFICATION ========================

export async function submitOrderVerification(
  orderId: string,
  status: VerificationStatus,
  responses: Array<{ text: string; checked: boolean }>,
  comments?: string,
  attachments?: unknown,
  userId?: string | null
) {
  const { data, error } = await supabase.rpc("rpc_submit_verification", {
    p_order_id: orderId,
    p_status: status,
    p_responses: responses,
    p_comments: comments || null,
    p_attachments: attachments || null,
    p_user_id: userId || null
  });

  if (error) throw error;
  return data;
}

// ======================== INVOICE NUMBER GENERATION ========================

// Generate the next invoice number for a tenant
// Uses same formatting as the database RPCs: prefix + 6-digit zero-padded sequence
async function generateNextInvoiceNumber(tenantId: string, settings?: TenantSettings | null): Promise<string> {
  // Get prefix from settings (defaults to empty string)
  const prefix = settings?.invoicePrefix?.trim() ?? "";

  // Read authoritative next sequence from settings
  let nextNum = settings?.nextInvoiceNumber ?? 1;

  // Cross-check: also look at existing invoices for safety
  const latestRes = await supabase
    .from("Invoice")
    .select("invoiceNumber")
    .eq("tenantId", tenantId)
    .order("createdAt", { ascending: false })
    .limit(1);

  const latestInvoice = latestRes.data?.[0];
  if (latestInvoice?.invoiceNumber) {
    // Extract trailing digits from any format (e.g. INV-2026-000024 → 24)
    const trailingMatch = latestInvoice.invoiceNumber.match(/([0-9]+)$/);
    if (trailingMatch) {
      const existingMax = parseInt(trailingMatch[1], 10);
      if (!isNaN(existingMax) && existingMax >= nextNum) {
        nextNum = existingMax + 1;
      }
    }
  }

  // Format: prefix + 6-digit zero-padded sequence (matches DB RPCs)
  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}

// ======================== CLIENT RECEIVER VERIFICATION ========================

export async function submitClientReceiverVerification(payload: {
  orderId: string;
  tenantId?: string;
  clientId?: string;
  status: VerificationStatus;
  responses: Array<{ text?: string; orderItemId?: string; checked: boolean }>;
  comments?: string;
  attachments?: any;
  userId?: string | null;
  userRole?: Role;
}): Promise<{ updatedOrder?: any; responseId?: string; success?: boolean; [key: string]: any }> {
  // Validate all items are checked when status is VERIFIED
  if (payload.status === "VERIFIED") {
    const allChecked =
      payload.responses &&
      payload.responses.length >= 7 &&
      payload.responses.every((r) => r.checked);
    if (!allChecked) {
      throw new Error("All inspection checklist items must be checked to verify delivery as VERIFIED.");
    }
  }

  // Use secure RPC for server-side verification and status transition
  const { data, error } = await supabase.rpc("rpc_submit_verification", {
    p_order_id: payload.orderId,
    p_status: payload.status,
    p_responses: payload.responses,
    p_comments: payload.comments || null,
    p_attachments: payload.attachments || null,
    p_user_id: payload.userId || null
  });

  if (error) throw error;
  return data;
}

export async function fetchPendingVerificationOrders(
  clientId?: string | null,
  tenantId?: string | null,
  role?: Role
): Promise<Order[]> {
  if (isClientRole(role) && !clientId) {
    return [];
  }

  let query = supabase
    .from("Order")
    .select("*, client:Client(*), createdBy:User!createdById(*), assignedStaff:User!assignedStaffId(*), items:OrderItem(*, product:Product(*)), verification:VerificationResponse(*)")
    .eq("status", "DISPATCHED")
    .eq("verificationStatus", "PENDING")
    .order("createdAt", { ascending: false });

  if (tenantId) {
    query = query.eq("tenantId", tenantId);
  }
  if (clientId) {
    query = query.eq("clientId", clientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Order[]) || [];
}

// ======================== ACCOUNTING & INVOICES ========================

export async function fetchInvoices(
  tenantId?: string | null,
  clientId?: string | null,
  role?: Role,
  userId?: string | null
): Promise<Invoice[]> {
  let query = supabase
    .from("Invoice")
    .select("*, client:Client(*), order:Order(*), items:InvoiceItem(*, product:Product(*)), payments:Payment(*)")
    .order("createdAt", { ascending: false });

  if (role !== "PLATFORM_ADMIN" && tenantId) {
    query = query.eq("tenantId", tenantId);
  }

  if (isClientRole(role)) {
    if (!clientId) {
      // Client users must never see all invoices if clientId is absent
      return [];
    }
    // Resolve company-wide client IDs using shared helper
    const companyClientIds = await resolveCompanyClientIds(userId, clientId);
    if (companyClientIds.length > 0) {
      query = query.in("clientId", companyClientIds);
    } else {
      query = query.eq("clientId", clientId);
    }
  } else if (clientId) {
    query = query.eq("clientId", clientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Invoice[]) || [];
}

export async function fetchInvoiceById(
  invoiceId: string,
  tenantId?: string | null,
  clientId?: string | null,
  userRole?: Role,
  userId?: string | null
): Promise<Invoice | null> {
  // If client user doesn't have a valid clientId, immediately reject
  if (isClientRole(userRole) && !clientId) {
    return null;
  }

  let query = supabase
    .from("Invoice")
    .select(`
      *,
      client:Client(*),
      tenant:Tenant(*),
      order:Order(*, verification:VerificationResponse(*), assignedStaff:User!assignedStaffId(*)),
      items:InvoiceItem(*, product:Product(*)),
      payments:Payment(*)
    `)
    .eq("id", invoiceId);

  // SECURITY: Filter by tenantId for non-PLATFORM_ADMIN
  if (userRole && userRole !== "PLATFORM_ADMIN" && tenantId) {
    query = query.eq("tenantId", tenantId);
  }

  // SECURITY: Client users can ONLY see their own company invoices
  // Uses company group resolution so Employee B in Company A can see Company A invoices
  if (isClientRole(userRole) && clientId) {
    const companyClientIds = await resolveCompanyClientIds(userId, clientId);
    if (companyClientIds.length > 0) {
      query = query.in("clientId", companyClientIds);
    } else {
      query = query.eq("clientId", clientId);
    }
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Error fetching invoice:", error);
    return null;
  }
  if (!data) return null;

  // Post-fetch ownership verification as defense-in-depth
  if (isClientRole(userRole) && clientId) {
    const isOwner = await verifyCompanyOwnership(data.clientId, userId, clientId);
    if (!isOwner) return null;
  }
  if (userRole && userRole !== "PLATFORM_ADMIN" && tenantId && data.tenantId !== tenantId) {
    return null;
  }

  return data as Invoice;
}

export async function generateInvoiceRecord(
  orderId: string,
  isFinal: boolean,
  userId?: string | null,
  userRole?: Role
) {
  const { data, error } = await supabase.rpc("rpc_generate_invoice", {
    p_order_id: orderId,
    p_is_final: isFinal,
    p_user_id: userId || null,
    p_user_role: userRole || "WAREHOUSE_OWNER"
  });

  if (error) throw error;
  return data;
}

export async function recordInvoicePayment(
  invoiceId: string,
  amount: number,
  method: string,
  reference?: string,
  proofUrl?: string,
  userId?: string | null,
  userRole?: Role
) {
  const { data, error } = await supabase.rpc("rpc_record_payment_secure", {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: method,
    p_reference: reference || null
  });

  if (error) throw error;

  if (proofUrl && (data as any)?.paymentId) {
    const { data: inv } = await supabase
      .from("Invoice")
      .select("tenantId")
      .eq("id", invoiceId)
      .single();
    if (inv?.tenantId) {
      await attachPaymentProof((data as any).paymentId, invoiceId, inv.tenantId, proofUrl);
    }
  }

  return data;
}

// Supported file types for payment proofs
const ALLOWED_PAYMENT_PROOF_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf"
];

// Maximum file size: 10MB
const MAX_PAYMENT_PROOF_SIZE = 10 * 1024 * 1024;

/**
 * Validates a payment proof file before upload
 * @param file - File to validate
 * @returns true if valid, throws Error with message if invalid
 */
function validatePaymentProofFile(file: File): void {
  // Check MIME type
  if (!ALLOWED_PAYMENT_PROOF_MIME_TYPES.includes(file.type)) {
    throw new Error("Please upload a JPG, PNG, or PDF payment proof.");
  }

  // Check file size
  if (file.size > MAX_PAYMENT_PROOF_SIZE) {
    throw new Error("File size exceeds 10MB limit. Please upload a smaller file.");
  }
}

/**
 * Uploads a payment proof file to Supabase Storage with tenant-scoped path
 * Path format: payment-proofs/{tenantId}/{invoiceId}/{paymentId}/{unique-id}-{original-name}
 *
 * @param file - The payment proof file to upload
 * @param tenantId - The tenant ID (for tenant isolation)
 * @param invoiceId - The invoice ID (for organization)
 * @param paymentId - The payment ID (for unique identification per payment)
 * @returns The public URL of the uploaded file
 */
export async function uploadPaymentProofFile(
  file: File,
  tenantId: string,
  invoiceId: string,
  paymentId: string
): Promise<string> {
  // Validate file first
  validatePaymentProofFile(file);

  // Get the authenticated user and their authoritative tenantId from the User table
  const { data: authData, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authData?.user) {
    throw new Error("Authentication required. Please log in to upload payment proofs.");
  }
  
  const authUserId = authData.user.id;
  
  // Fetch the authoritative tenantId from the User table
  // This is the source of truth for tenant isolation in Storage RLS
  const { data: dbUser, error: userError } = await supabase
    .from("User")
    .select("supabaseUserId, tenantId")
    .eq("supabaseUserId", authUserId)
    .single();

  if (userError || !dbUser?.tenantId) {
    console.error("Failed to fetch user tenant context:", userError);
    throw new Error("User tenant context not found. Please contact support.");
  }

  // Use the authoritative tenantId from User table for storage path
  // This ensures the storage path matches what the RLS policy expects
  const authoritativeTenantId = dbUser.tenantId;

  // Generate unique storage path with tenant isolation
  const fileExt = file.name.split(".").pop();
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const safeFileName = `${uniqueId}.${fileExt}`;
  const storagePath = `${authoritativeTenantId}/${invoiceId}/${paymentId}/${safeFileName}`;

  // PAYMENT PROOF RLS DIAGNOSTIC - log values before upload attempt
  console.group("PAYMENT PROOF RLS DIAGNOSTIC");
  console.log("1. authenticated user ID:", authUserId);
  console.log("2. tenantId (from caller):", tenantId);
  console.log("3. authoritative tenantId (from User table):", authoritativeTenantId);
  console.log("4. storagePath:", storagePath);
  console.log("5. storagePath.split('/')[0]:", storagePath.split('/')[0]);
  console.log("6. dbUser record:", dbUser);
  console.log("   comparisons:");
  console.log("   - authUserId === dbUser.supabaseUserId:", authUserId === dbUser.supabaseUserId);
  console.log("   - caller tenantId === authoritative tenantId:", tenantId === authoritativeTenantId);
  console.log("   - storagePath.split('/')[0] === authoritativeTenantId:", storagePath.split('/')[0] === authoritativeTenantId);
  console.log("   - storagePath.split('/')[0] === dbUser.tenantId:", storagePath.split('/')[0] === dbUser.tenantId);
  console.groupEnd();

  // Verify tenant consistency - if the invoice's tenantId differs from user's tenantId,
  // this indicates a potential security issue or data inconsistency
  if (tenantId !== authoritativeTenantId) {
    console.warn(
      `Tenant mismatch detected: invoice tenantId (${tenantId}) differs from user tenantId (${authoritativeTenantId}). ` +
      `Using authoritative tenantId for storage path.`
    );
  }

  const { error } = await supabase.storage
    .from("payment-proofs")
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type
    });

  if (error) {
    console.error("PAYMENT PROOF RLS UPLOAD FAILURE:");
    console.error("  error.message:", error.message);
    console.error("  error.status:", error.status);
    console.error("  error.name:", error.name);
    console.error("  error.details:", error.details);
    console.error("  error.cause:", error.cause ?? "not available");
    console.groupEnd();
    throw new Error(`Failed to upload payment proof: ${error.message}`);
  }

  // Return the relative storage path for private storage
  return storagePath;
}

/**
 * Uploads a payment proof file to Supabase Storage with invoiceId, paymentId, file
 *
 * @param invoiceId - The invoice ID
 * @param paymentId - The payment ID
 * @param file - The payment proof file
 * @param tenantId - Optional tenant ID (looked up from invoice if omitted)
 * @returns The relative storage path of the uploaded file
 */
export async function uploadPaymentProof(
  invoiceId: string,
  paymentId: string,
  file: File,
  tenantId?: string
): Promise<string> {
  let tid = tenantId;
  if (!tid) {
    const { data: inv } = await supabase
      .from("Invoice")
      .select("tenantId")
      .eq("id", invoiceId)
      .single();
    tid = inv?.tenantId || "";
  }
  return uploadPaymentProofFile(file, tid, invoiceId, paymentId);
}

/**
 * Attaches a payment proof storage path to an existing payment record
 * Strictly scoped to tenant and invoice for security.
 */
export async function attachPaymentProof(
  paymentId: string,
  invoiceId: string,
  tenantId: string,
  proofUrl: string
): Promise<void> {
  const { error } = await supabase.rpc("rpc_attach_payment_proof", {
    p_payment_id: paymentId,
    p_invoice_id: invoiceId,
    p_proof_url: proofUrl
  });

  if (error) {
    throw new Error(`Failed to attach payment proof: ${error.message}`);
  }
}

/**
 * Securely cancels / voids a payment record and recalculates invoice payment status
 *
 * @param paymentId - The payment record ID to cancel
 */
export async function cancelPaymentRecord(
  paymentId: string
): Promise<{
  success: boolean;
  paymentId: string;
  invoiceId: string;
  status: PaymentStatus;
  newPaymentStatus: PaymentStatus;
  totalPaid: number;
}> {
  const { data, error } = await supabase.rpc("rpc_cancel_payment_record", {
    p_payment_id: paymentId
  });

  if (error) throw error;
  return data;
}

export async function markInvoiceAsPaid(
  invoiceId: string,
  proofUrl: string,
  tenantId: string,
  totalAmount: number,
  userId?: string | null
) {
  const { data, error } = await supabase.rpc("rpc_record_payment_secure", {
    p_invoice_id: invoiceId,
    p_amount: totalAmount,
    p_method: "BANK_TRANSFER",
    p_reference: `PAY-${Date.now().toString().slice(-6)}`
  });

  if (error) throw error;

  if (proofUrl && (data as any)?.paymentId) {
    try {
      await attachPaymentProof((data as any).paymentId, invoiceId, tenantId, proofUrl);
    } catch (attachError) {
      console.warn("Payment recorded, but attaching proofUrl failed:", attachError);
    }
  }

  return data;
}

/**
 * Records a payment and uploads a payment proof file
 * Creates payment record via secure RPC first, then uploads file, then updates proofUrl
 *
 * @param invoiceId - The invoice to record payment for
 * @param file - The payment proof file
 * @param tenantId - The tenant ID (for storage path isolation)
 * @param totalAmount - The payment amount
 * @param userId - The user recording the payment
 */
export async function recordPaymentWithProof(
  invoiceId: string,
  file: File,
  tenantId: string,
  totalAmount: number,
  userId?: string | null
): Promise<{ paymentId: string; proofUrl: string }> {
  // 1. Create payment record via secure RPC
  const { data, error: rpcError } = await supabase.rpc("rpc_record_payment_secure", {
    p_invoice_id: invoiceId,
    p_amount: totalAmount,
    p_method: "BANK_TRANSFER",
    p_reference: `PAY-${Date.now().toString().slice(-6)}`
  });

  if (rpcError) throw rpcError;
  const paymentId = (data as any)?.paymentId;
  if (!paymentId) {
    throw new Error("Failed to record payment: no payment ID returned from database");
  }

  try {
    // 2. Upload the payment proof file using the authoritative payment ID
    const proofUrl = await uploadPaymentProofFile(file, tenantId, invoiceId, paymentId);

    // 3. Attach proofUrl to Payment record via secure RPC
    await attachPaymentProof(paymentId, invoiceId, tenantId, proofUrl);

    return { paymentId, proofUrl };
  } catch (uploadError) {
    // If upload or attach fails, safely cancel the unproven payment record
    try {
      await cancelPaymentRecord(paymentId);
    } catch (cancelErr) {
      console.warn("Failed to automatically cancel payment after proof failure:", cancelErr);
    }
    throw uploadError;
  }
}

/**
 * Records a partial payment with proof
 * Payment status calculation and Invoice/Order updates are executed atomically in Postgres
 *
 * @param invoiceId - The invoice to record payment for
 * @param file - The payment proof file
 * @param tenantId - The tenant ID (for storage path isolation)
 * @param amount - The payment amount
 * @param method - Payment method (e.g., "BANK_TRANSFER", "CASH", "UPI")
 * @param reference - Payment reference/UTR number
 * @param userId - The user recording the payment
 */
export async function recordPartialPaymentWithProof(
  invoiceId: string,
  file: File,
  tenantId: string,
  amount: number,
  method: string,
  reference?: string,
  userId?: string | null
): Promise<{ paymentId: string; proofUrl: string }> {
  // 1. Create payment record via secure RPC
  const { data, error: rpcError } = await supabase.rpc("rpc_record_payment_secure", {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: method || "BANK_TRANSFER",
    p_reference: reference || `PAY-${Date.now().toString().slice(-6)}`
  });

  if (rpcError) throw rpcError;
  const paymentId = (data as any)?.paymentId;
  if (!paymentId) {
    throw new Error("Failed to record partial payment: no payment ID returned from database");
  }

  try {
    // 2. Upload the payment proof file using the authoritative payment ID
    const proofUrl = await uploadPaymentProofFile(
      file,
      tenantId,
      invoiceId,
      paymentId
    );

    // 3. Attach proofUrl to Payment record via secure RPC
    await attachPaymentProof(paymentId, invoiceId, tenantId, proofUrl);

    return { paymentId, proofUrl };
  } catch (uploadError) {
    // If upload or attach fails, safely cancel the unproven payment record
    try {
      await cancelPaymentRecord(paymentId);
    } catch (cancelErr) {
      console.warn("Failed to automatically cancel payment after proof failure:", cancelErr);
    }
    throw uploadError;
  }
}

/**
 * Fetches a payment proof file URL with proper authorization
 * Returns a signed URL for secure access
 *
 * @param paymentId - The payment ID
 * @returns The signed URL for the payment proof, or null if no proof exists or authorization fails
 */
export async function getPaymentProofUrl(
  paymentId: string,
  tenantId: string,
  clientId?: string | null,
  role?: Role
): Promise<string | null> {
  // First find the payment and its invoice
  const { data: payment, error: paymentError } = await supabase
    .from("Payment")
    .select("proofUrl, tenantId, invoiceId")
    .eq("id", paymentId)
    .single();

  if (paymentError || !payment || !payment.proofUrl) {
    return null;
  }

  // Verify the payment's invoice belongs to the user's tenant and client
  const { data: invoice, error: invoiceError } = await supabase
    .from("Invoice")
    .select("tenantId, clientId")
    .eq("id", payment.invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return null;
  }

  // Verify invoice tenant matches
  if (tenantId && invoice.tenantId !== tenantId) {
    return null;
  }

  // If role is CLIENT, verify invoice clientId matches with company-group support
  if (isClientRole(role)) {
    if (!clientId) return null;
    if (invoice.clientId !== clientId) {
      const isOwner = await verifyCompanyOwnership(invoice.clientId, undefined, clientId);
      if (!isOwner) return null;
    }
  } else if (role !== "PLATFORM_ADMIN" && clientId && invoice.clientId !== clientId) {
    return null;
  }

  // Extract storage path from proofUrl
  let storagePath = payment.proofUrl;
  if (storagePath.includes("/object/public/payment-proofs/")) {
    storagePath = storagePath.substring(
      storagePath.indexOf("/object/public/payment-proofs/") + "/object/public/payment-proofs/".length
    );
  } else if (storagePath.includes("/object/public/")) {
    storagePath = storagePath.substring(
      storagePath.indexOf("/object/public/") + "/object/public/".length
    );
  }

  // Generate a signed URL for secure access
  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(storagePath, 60 * 60); // 1 hour expiry

  if (signedError || !signedUrlData?.signedUrl) {
    // Fallback if path did or did not include payment-proofs/ prefix
    const altPath = storagePath.startsWith("payment-proofs/")
      ? storagePath.replace("payment-proofs/", "")
      : `payment-proofs/${storagePath}`;
    const { data: altData } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(altPath, 60 * 60);
    return altData?.signedUrl || null;
  }

  return signedUrlData.signedUrl;
}

// ======================== NOTIFICATIONS ========================

export async function fetchUserNotifications(
  tenantId?: string | null,
  userId?: string | null,
  clientId?: string | null,
  role?: Role
): Promise<Notification[]> {
  let query = supabase
    .from("Notification")
    .select("*, order:Order(id, clientId)")
    .order("createdAt", { ascending: false })
    .limit(50);

  if (tenantId) query = query.eq("tenantId", tenantId);

  const { data, error } = await query;
  if (error) throw error;
  const allNotifs = (data as any[]) || [];

  if (isClientRole(role)) {
    if (!clientId) return [];
    // For CLIENT users: only include notifications addressed to this user or belonging to client's order
    return allNotifs.filter((n) => {
      if (n.userId && userId && n.userId === userId) return true;
      if (n.order && n.order.clientId === clientId) return true;
      return false;
    }) as Notification[];
  }

  return allNotifs as Notification[];
}

export async function markNotificationRead(
  notificationId: string,
  tenantId: string,
  clientId?: string | null,
  userId?: string | null,
  role?: Role
) {
  // First verify the notification belongs to the user's tenant and client
  const { data: notif, error: fetchError } = await supabase
    .from("Notification")
    .select("tenantId, userId, orderId, order:Order(id, clientId)")
    .eq("id", notificationId)
    .single();

  if (fetchError || !notif) {
    // Notification not found - return null without revealing existence
    return null;
  }

  // Verify tenant ownership
  if (notif.tenantId !== tenantId) {
    return null;
  }

  // For CLIENT users, verify client/user ownership
  if (isClientRole(role)) {
    const belongsToClient = notif.order && (notif.order as any).clientId === clientId;
    const belongsToUser = notif.userId && notif.userId === userId;
    if (!belongsToClient && !belongsToUser) {
      return null;
    }
  }

  // Now mark as read if ownership verified
  const { data, error } = await supabase
    .from("Notification")
    .update({ read: true, readAt: new Date().toISOString() })
    .eq("id", notificationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ======================== AUDIT LOGS ========================

export async function fetchAuditLogs(tenantId?: string | null): Promise<AuditLog[]> {
  let query = supabase
    .from("AuditLog")
    .select("*, user:User(*)")
    .order("createdAt", { ascending: false })
    .limit(100);

  if (tenantId) query = query.eq("tenantId", tenantId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as AuditLog[]) || [];
}

// ======================== PRODUCTS ========================

export async function fetchProducts(tenantId?: string | null) {
  let query = supabase
    .from("Product")
    .select("*, category:Category(*)")
    .order("name", { ascending: true });

  if (tenantId) query = query.eq("tenantId", tenantId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createProductFromInvoice(payload: {
  tenantId: string;
  sku: string;
  name: string;
  unit: string;
  sellingPrice: number;
  gstRate: number;
}) {
  const productId = `prod_${Math.random().toString(36).substring(2, 11)}`;
  const { data, error } = await supabase
    .from("Product")
    .insert({
      id: productId,
      tenantId: payload.tenantId,
      sku: payload.sku.toUpperCase().trim(),
      name: payload.name.trim(),
      unit: payload.unit || "pcs",
      purchasePrice: payload.sellingPrice || 0,
      sellingPrice: payload.sellingPrice || 0,
      gstRate: payload.gstRate || 18,
      minimumStock: 0,
      reorderLevel: 0,
      status: "ACTIVE"
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ======================== ADMIN DASHBOARD ========================

export interface AdminWarehouseItem {
  id: string;
  name: string;
  code: string;
  address: string;
  status: string;
  createdAt: string;
  tenantId: string;
  tenant: { id: string; name: string; slug: string } | null;
  locationsCount: number;
  inventoryCount: number;
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: Role;
  status: string;
  createdAt: string;
  tenantId: string | null;
  tenant: { id: string; name: string; slug: string } | null;
  client?: { id: string; employeeRole: ClientEmployeeRole | null; companyName: string } | null;
}

export interface AdminClientItem {
  id: string;
  companyGroupId: string | null;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string | null;
  gstNumber: string | null;
  billingAddress: string;
  shippingAddress: string;
  status: string;
  employeeRole: string | null;
  createdAt: string;
  tenantId: string;
  tenant: { id: string; name: string; slug: string } | null;
  companyGroup: { id: string; name: string } | null;
  orders: Array<{ id: string; orderNumber: string; status: string }>;
}

export interface AdminCompanyGroupItem {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  clients: AdminClientItem[];
}

export interface AdminTenantItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  warehousesCount: number;
  usersCount: number;
  clientsCount: number;
}

export async function fetchAdminDashboardData(tenantId?: string | null, role?: Role) {
  let warehousesRes, usersRes, clientsRes, groupsRes, tenantsRes;

  // PLATFORM_ADMIN can see all tenants, others only their own
  if (role === "PLATFORM_ADMIN") {
    [warehousesRes, usersRes, clientsRes, groupsRes, tenantsRes] = await Promise.all([
      supabase
        .from("Warehouse")
        .select("*, tenant:Tenant(id, name, slug), locations:WarehouseLocation(id), inventory:Inventory(id)")
        .order("createdAt", { ascending: false }),
      supabase
        .from("User")
        .select("*, tenant:Tenant(id, name, slug), client:Client(id, employeeRole, companyName)")
        .order("createdAt", { ascending: false }),
      supabase
        .from("Client")
        .select("*, tenant:Tenant(id, name, slug), companyGroup:CompanyGroup(id, name), orders:Order(id, orderNumber, status)")
        .order("createdAt", { ascending: false }),
      supabase
        .from("CompanyGroup")
        .select("*, clients:Client(*)")
        .order("name", { ascending: true }),
      supabase
        .from("Tenant")
        .select("*, warehouses:Warehouse(id), users:User(id), clients:Client(id)")
        .order("name", { ascending: true })
    ]);
  } else {
    // Non-PLATFORM_ADMIN users can only access their own tenant's data
    const tenantQuery = tenantId
      ? supabase.from("Tenant").select("*, warehouses:Warehouse(id), users:User(id), clients:Client(id)").eq("id", tenantId)
      : supabase.from("Tenant").select("*, warehouses:Warehouse(id), users:User(id), clients:Client(id)");

    [warehousesRes, usersRes, clientsRes, groupsRes, tenantsRes] = await Promise.all([
      supabase
        .from("Warehouse")
        .select("*, tenant:Tenant(id, name, slug), locations:WarehouseLocation(id), inventory:Inventory(id)")
        .eq("tenantId", tenantId || "")
        .order("createdAt", { ascending: false }),
      supabase
        .from("User")
        .select("*, tenant:Tenant(id, name, slug), client:Client(id, employeeRole, companyName)")
        .eq("tenantId", tenantId || "")
        .order("createdAt", { ascending: false }),
      supabase
        .from("Client")
        .select("*, tenant:Tenant(id, name, slug), companyGroup:CompanyGroup(id, name), orders:Order(id, orderNumber, status)")
        .eq("tenantId", tenantId || "")
        .order("createdAt", { ascending: false }),
      supabase
        .from("CompanyGroup")
        .select("*, clients:Client(*)")
        .eq("tenantId", tenantId || "")
        .order("name", { ascending: true }),
      tenantQuery.order("name", { ascending: true })
    ]);
  }

  const warehouses: AdminWarehouseItem[] = (warehousesRes.data || []).map((w: any) => ({
    id: w.id,
    name: w.name,
    code: w.code,
    address: w.address,
    status: w.status,
    createdAt: w.createdAt,
    tenantId: w.tenantId,
    tenant: w.tenant,
    locationsCount: Array.isArray(w.locations) ? w.locations.length : 0,
    inventoryCount: Array.isArray(w.inventory) ? w.inventory.length : 0
  }));

  const users: AdminUserItem[] = (usersRes.data || []).map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    tenantId: u.tenantId,
    tenant: u.tenant,
    client: u.client ? { id: u.client.id, employeeRole: u.client.employeeRole, companyName: u.client.companyName } : null
  }));

  const clients: AdminClientItem[] = (clientsRes.data || []).map((c: any) => ({
    id: c.id,
    companyGroupId: c.companyGroupId,
    companyName: c.companyName,
    contactPerson: c.contactPerson,
    mobile: c.mobile,
    email: c.email,
    gstNumber: c.gstNumber,
    billingAddress: c.billingAddress,
    shippingAddress: c.shippingAddress,
    status: c.status,
    employeeRole: c.employeeRole,
    createdAt: c.createdAt,
    tenantId: c.tenantId,
    tenant: c.tenant,
    companyGroup: c.companyGroup,
    orders: Array.isArray(c.orders) ? c.orders : []
  }));

  const companyGroups: AdminCompanyGroupItem[] = (groupsRes.data || []).map((g: any) => ({
    id: g.id,
    tenantId: g.tenantId,
    name: g.name,
    description: g.description,
    clients: (g.clients || []).map((c: any) => ({
      id: c.id,
      companyGroupId: c.companyGroupId,
      companyName: c.companyName,
      contactPerson: c.contactPerson,
      mobile: c.mobile,
      email: c.email,
      gstNumber: c.gstNumber,
      billingAddress: c.billingAddress,
      shippingAddress: c.shippingAddress,
      status: c.status,
      employeeRole: c.employeeRole,
      createdAt: c.createdAt,
      tenantId: c.tenantId,
      tenant: null,
      companyGroup: null,
      orders: []
    }))
  }));

  const tenants: AdminTenantItem[] = (tenantsRes.data || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    warehousesCount: Array.isArray(t.warehouses) ? t.warehouses.length : 0,
    usersCount: Array.isArray(t.users) ? t.users.length : 0,
    clientsCount: Array.isArray(t.clients) ? t.clients.length : 0
  }));

  return { warehouses, users, clients, companyGroups, tenants };
}

export async function createAdminWarehouse(payload: {
  name: string;
  code: string;
  address: string;
  tenantId: string;
}) {
  const { data, error } = await supabase
    .from("Warehouse")
    .insert([
      {
        name: payload.name,
        code: payload.code.toUpperCase(),
        address: payload.address,
        tenantId: payload.tenantId,
        status: "ACTIVE"
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createAdminUser(payload: {
  name: string;
  email?: string;
  password?: string;
  mobile?: string;
  role: Role;
  tenantId?: string;
}) {
  if (!payload.email) throw new Error("Email is required to create a user account.");
  const result = await createEmployeeWithAuth({
    name: payload.name,
    email: payload.email,
    password: payload.password || "TemporaryPass123!",
    mobile: payload.mobile,
    role: payload.role,
    tenantId: payload.tenantId
  });
  if (!result.success) throw new Error(result.error || "Failed to create user");
  return { id: result.userId, ...payload };
}

export async function createAdminClient(payload: {
  companyName: string;
  contactPerson: string;
  mobile: string;
  email?: string;
  gstNumber?: string;
  billingAddress: string;
  shippingAddress: string;
  tenantId: string;
  companyGroupId?: string;
  employeeRole?: string;
}) {
  const { data, error } = await supabase
    .from("Client")
    .insert([
      {
        companyName: payload.companyName,
        contactPerson: payload.contactPerson,
        mobile: payload.mobile,
        email: payload.email || null,
        gstNumber: payload.gstNumber || null,
        billingAddress: payload.billingAddress,
        shippingAddress: payload.shippingAddress,
        tenantId: payload.tenantId,
        companyGroupId: payload.companyGroupId || null,
        employeeRole: payload.employeeRole || "CLIENT",
        status: "ACTIVE"
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createAdminCompanyGroup(payload: {
  tenantId: string;
  name: string;
  description?: string;
}) {
  const { data, error } = await supabase
    .from("CompanyGroup")
    .insert([
      {
        tenantId: payload.tenantId,
        name: payload.name,
        description: payload.description || null
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createAdminTenant(payload: {
  name: string;
  slug?: string;
  gstNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
}) {
  const slug =
    payload.slug?.trim() ||
    payload.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const { data, error } = await supabase
    .from("Tenant")
    .insert([
      {
        name: payload.name.trim(),
        slug,
        gstNumber: payload.gstNumber?.trim() || null,
        email: payload.email?.trim() || null,
        phone: payload.phone?.trim() || null,
        address: payload.address?.trim() || null,
        status: "ACTIVE"
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── UPDATE / DELETE ─────────────────────────────────────────────────

export async function updateAdminWarehouse(id: string, payload: Partial<{ name: string; code: string; address: string; status: string; tenantId: string }>) {
  const { data, error } = await supabase.from("Warehouse").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAdminWarehouse(id: string) {
  const { error } = await supabase.from("Warehouse").delete().eq("id", id);
  if (error) throw error;
}

export async function updateAdminUser(id: string, payload: Partial<{ name: string; email: string; mobile: string; role: string; status: string; tenantId: string }>) {
  const { data, error } = await supabase.from("User").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export interface CreateClientEmployeePayload {
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  shippingAddress?: string;
  billingAddress?: string;
  tenantId: string;
  employeeRole: ClientEmployeeRole;
  companyGroupId?: string;
  actorUserId?: string | null;
  actorUserRole?: Role;
}

export async function createClientEmployeeWithUser(payload: CreateClientEmployeePayload & { password?: string }) {
  const normalizedEmail = payload.email?.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required for Client Employee creation to enable WMS login.");
  }
  if (!payload.tenantId) {
    throw new Error("Tenant ID is required.");
  }
  if (!payload.contactPerson.trim()) {
    throw new Error("Contact Person name is required.");
  }
  if (!payload.mobile.trim()) {
    throw new Error("Mobile number is required.");
  }

  const result = await createEmployeeWithAuth({
    name: payload.contactPerson.trim(),
    email: normalizedEmail,
    password: payload.password || "TemporaryPass123!",
    mobile: payload.mobile.trim() || undefined,
    role: "CLIENT",
    clientEmployeeRole: payload.employeeRole,
    companyName: payload.companyName.trim(),
    shippingAddress: payload.shippingAddress?.trim() || "Main Office",
    billingAddress: payload.billingAddress?.trim() || payload.shippingAddress?.trim() || "Main Office",
    tenantId: payload.tenantId,
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to create client employee");
  }

  // Audit Logging
  try {
    if (result.clientId) {
      await createAuditLogRecord({
        tenantId: payload.tenantId,
        userId: payload.actorUserId || null,
        userRole: payload.actorUserRole || "PLATFORM_ADMIN",
        action: "CREATE_CLIENT_EMPLOYEE",
        entity: "Client",
        entityId: result.clientId,
        changes: {
          clientName: payload.contactPerson,
          companyName: payload.companyName,
          role: payload.employeeRole,
          userId: result.userId
        }
      });
    }
  } catch (auditErr) {
    console.warn("Audit log creation failed for client employee:", auditErr);
  }

  return {
    id: result.clientId,
    userId: result.userId,
    ...payload
  };
}

export interface UpdateAdminUserRolePayload {
  userId: string;
  name?: string;
  email?: string;
  mobile?: string;
  status?: string;
  role: Role;
  previousRole: Role;
  clientId?: string;
  employeeRole?: ClientEmployeeRole;
  previousEmployeeRole?: ClientEmployeeRole;
  targetUserTenantId?: string | null;
  actorUserId?: string | null;
  actorUserRole?: Role;
}

export async function updateAdminUserWithRoleAudit(payload: UpdateAdminUserRolePayload) {
  // 1. Self-protection: PLATFORM_ADMIN cannot demote self
  if (
    payload.userId === payload.actorUserId &&
    payload.actorUserRole === "PLATFORM_ADMIN" &&
    payload.role !== "PLATFORM_ADMIN"
  ) {
    throw new Error("Platform Admins cannot remove or demote their own PLATFORM_ADMIN role.");
  }

  // 2. Privilege check: only PLATFORM_ADMIN can modify user roles
  if (payload.actorUserRole !== "PLATFORM_ADMIN") {
    throw new Error("Only Platform Administrators are authorized to modify user roles.");
  }

  // 3. Transition TO CLIENT: require valid client association
  if (payload.role === "CLIENT" && !payload.clientId) {
    throw new Error("A valid Client Company must be linked when assigning the CLIENT role.");
  }

  // 4. If role is CLIENT and a clientId is provided, link Client and update employeeRole
  if (payload.role === "CLIENT" && payload.clientId) {
    const clientUpdatePayload: Record<string, any> = { userId: payload.userId };
    if (payload.employeeRole) {
      clientUpdatePayload.employeeRole = payload.employeeRole;
    }
    const { error: clientUpdateError } = await supabase
      .from("Client")
      .update(clientUpdatePayload)
      .eq("id", payload.clientId);

    if (clientUpdateError) {
      throw new Error(`Failed to link client employee record: ${clientUpdateError.message}`);
    }

    if (payload.employeeRole && payload.employeeRole !== payload.previousEmployeeRole) {
      try {
        await createAuditLogRecord({
          tenantId: payload.targetUserTenantId || null,
          userId: payload.actorUserId || null,
          userRole: payload.actorUserRole,
          action: "UPDATE_CLIENT_EMPLOYEE_ROLE",
          entity: "Client",
          entityId: payload.clientId,
          previousValue: { employeeRole: payload.previousEmployeeRole || null },
          newValue: { employeeRole: payload.employeeRole }
        });
      } catch (auditErr) {
        console.warn("Audit log creation for client employee role failed (non-critical):", auditErr);
      }
    }
  }

  // 5. If role is changing FROM CLIENT to a non-CLIENT role, clear the clientId
  //    from the User record while preserving the Client company data.
  //    The new WMS role determines authorization; do not treat a non-CLIENT user
  //    as a client employee.
  if (payload.previousRole === "CLIENT" && payload.role !== "CLIENT" && payload.clientId) {
    // Clear clientId from User record — the user is no longer a client employee
    const { error: clearClientError } = await supabase
      .from("User")
      .update({ clientId: null })
      .eq("id", payload.userId);

    if (clearClientError) {
      console.warn(
        `Warning: Failed to clear clientId from User ${payload.userId} during role transition FROM CLIENT: ${clearClientError.message}`
      );
    } else {
      // Audit the client association removal
      try {
        await createAuditLogRecord({
          tenantId: payload.targetUserTenantId || null,
          userId: payload.actorUserId || null,
          userRole: payload.actorUserRole,
          action: "REMOVE_CLIENT_EMPLOYEE_ASSOCIATION",
          entity: "User",
          entityId: payload.userId,
          previousValue: { clientId: payload.clientId, employeeRole: payload.previousEmployeeRole || null },
          newValue: { clientId: null, employeeRole: null }
        });
      } catch (auditErr) {
        console.warn("Audit log for client employee removal failed (non-critical):", auditErr);
      }
    }
  }

  // 5. Update User record
  const userUpdatePayload: Record<string, any> = {
    role: payload.role
  };
  if (payload.name !== undefined) userUpdatePayload.name = payload.name;
  if (payload.email !== undefined) userUpdatePayload.email = payload.email ? payload.email.trim().toLowerCase() : null;
  if (payload.mobile !== undefined) userUpdatePayload.mobile = payload.mobile ? payload.mobile.trim() : null;
  if (payload.status !== undefined) userUpdatePayload.status = payload.status;

  const { data: updatedUser, error: userUpdateError } = await supabase
    .from("User")
    .update(userUpdatePayload)
    .eq("id", payload.userId)
    .select()
    .single();

  if (userUpdateError) {
    throw userUpdateError;
  }

  // 6. Audit log for role change
  if (payload.role !== payload.previousRole) {
    try {
      await createAuditLogRecord({
        tenantId: payload.targetUserTenantId || null,
        userId: payload.actorUserId || null,
        userRole: payload.actorUserRole,
        action: "UPDATE_USER_ROLE",
        entity: "User",
        entityId: payload.userId,
        previousValue: { role: payload.previousRole },
        newValue: { role: payload.role }
      });
    } catch (auditErr) {
      console.warn("Audit log creation for user role failed (non-critical):", auditErr);
    }
  }

  return updatedUser;
}

export async function deleteAdminUser(id: string) {
  const { error } = await supabase.from("User").delete().eq("id", id);
  if (error) throw error;
}

export async function updateAdminClient(id: string, payload: Partial<{ companyName: string; contactPerson: string; mobile: string; email: string; gstNumber: string; billingAddress: string; shippingAddress: string; status: string; employeeRole: string; tenantId: string; companyGroupId: string }>) {
  const { data, error } = await supabase.from("Client").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAdminClient(id: string) {
  const { error } = await supabase.from("Client").delete().eq("id", id);
  if (error) throw error;
}

export async function updateAdminTenant(id: string, payload: Partial<{ name: string; slug: string; gstNumber: string; email: string; phone: string; address: string; status: string }>) {
  const { data, error } = await supabase.from("Tenant").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAdminTenant(id: string) {
  const { error } = await supabase.from("Tenant").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAdminCompanyGroup(id: string) {
  const { error } = await supabase.from("CompanyGroup").delete().eq("id", id);
  if (error) throw error;
}

// ======================== EMPLOYEES ========================

export async function fetchEmployees(tenantId?: string | null) {
  if (!tenantId) return [];

  const { data, error } = await supabase
    .from("User")
    .select("*, tenant:Tenant(*)")
    .eq("tenantId", tenantId)
    .in("role", ALLOWED_EMPLOYEE_ROLES)
    .order("createdAt", { ascending: false });

  if (error) throw error;
  return (data as User[]) || [];
}

export async function updateEmployeeSecure(params: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  name?: string;
  email?: string;
  mobile?: string;
  role?: Role;
  status?: UserStatus;
}): Promise<{ success: boolean; targetId: string; previousRole: string; newRole: string }> {
  const { data, error } = await supabase.rpc("rpc_update_employee", {
    p_actor_id: params.actorId,
    p_actor_role: params.actorRole,
    p_target_id: params.targetId,
    p_name: params.name ?? null,
    p_email: params.email ?? null,
    p_mobile: params.mobile ?? null,
    p_new_role: params.role ?? null,
    p_new_status: params.status ?? null
  });

  if (error) throw error;
  if (!data?.success) throw new Error("Employee update failed");
  return data;
}

export async function createEmployee(payload: {
  name: string;
  email?: string;
  mobile?: string;
  role: Role;
  tenantId: string;
  status?: UserStatus;
}) {
  const { data, error } = await supabase
    .from("User")
    .insert({
      name: payload.name.trim(),
      email: payload.email?.trim() || null,
      mobile: payload.mobile?.trim() || null,
      role: payload.role,
      tenantId: payload.tenantId,
      status: payload.status || "ACTIVE"
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEmployee(
  id: string,
  payload: Partial<{
    name: string;
    email: string;
    mobile: string;
    role: string;
    status: string;
  }>
) {
  const { data, error } = await supabase
    .from("User")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createAuditLogRecord(payload: {
  tenantId?: string | null;
  userId?: string | null;
  userRole: Role;
  action: string;
  entity: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  const { data, error } = await supabase
    .from("AuditLog")
    .insert({
      tenantId: payload.tenantId || null,
      userId: payload.userId || null,
      userRole: payload.userRole,
      action: payload.action,
      entity: payload.entity,
      entityId: payload.entityId,
      previousValue: payload.previousValue || null,
      newValue: payload.newValue || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ======================== TENANT SETTINGS ========================

export async function fetchTenantSettings(tenantId?: string | null) {
  if (!tenantId) return null;
  try {
    const { data, error } = await supabase
      .from("WarehouseSetting")
      .select("*")
      .eq("tenantId", tenantId)
      .maybeSingle();
    if (!error && data) return data;
  } catch {
    // Ignore and fallback
  }

  try {
    const { data, error } = await supabase
      .from("TenantSettings")
      .select("*")
      .eq("tenantId", tenantId)
      .maybeSingle();
    if (!error && data) return data;
  } catch {
    // Ignore
  }

  return null;
}

export async function updateTenantSettings(
  id: string,
  payload: Partial<{ invoicePrefix: string | null; orderPrefix?: string | null; notificationPreferences?: any }>
) {
  const updateData = {
    ...payload,
    updatedAt: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from("WarehouseSetting")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (!error && data) return data;

    // Try update by tenantId if id was passed as tenantId
    const byTenant = await supabase
      .from("WarehouseSetting")
      .update(updateData)
      .eq("tenantId", id)
      .select()
      .maybeSingle();
    if (!byTenant.error && byTenant.data) return byTenant.data;
  } catch {
    // Fallback to TenantSettings
  }

  const { data, error } = await supabase
    .from("TenantSettings")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createTenantSettings(payload: {
  tenantId: string;
  invoicePrefix?: string | null;
  orderPrefix?: string | null;
}) {
  const id = "ws_" + Math.random().toString(36).substring(2, 15);
  const now = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from("WarehouseSetting")
      .upsert({
        id,
        tenantId: payload.tenantId,
        invoicePrefix: payload.invoicePrefix?.trim() ?? "",
        orderPrefix: payload.orderPrefix || "ORD",
        updatedAt: now
      }, { onConflict: "tenantId" })
      .select()
      .single();
    if (!error && data) return data;
  } catch {
    // Fallback
  }

  const { data, error } = await supabase
    .from("TenantSettings")
    .insert({
      tenantId: payload.tenantId,
      invoicePrefix: payload.invoicePrefix?.trim() ?? null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Get or create tenant settings with safe defaults
export async function getOrCreateTenantSettings(tenantId: string) {
  const settings = await fetchTenantSettings(tenantId);
  if (settings) return settings;
  return await createTenantSettings({ tenantId, invoicePrefix: "" });
}

// ======================== NOTIFICATION SETTINGS ========================

// Default notification event configuration
const DEFAULT_NOTIFICATION_SETTINGS: Record<NotificationType, { inApp: boolean; clientEmail: boolean }> = {
  NEW_ORDER: { inApp: true, clientEmail: true },
  ORDER_ISSUED: { inApp: true, clientEmail: true },
  PROCESSING_STARTED: { inApp: true, clientEmail: false },
  READY_FOR_DISPATCH: { inApp: true, clientEmail: true },
  ORDER_DISPATCHED: { inApp: true, clientEmail: true },
  CLIENT_RECEIVED_ORDER: { inApp: true, clientEmail: false },
  CLIENT_STARTED_VERIFICATION: { inApp: true, clientEmail: false },
  CLIENT_COMPLETED_VERIFICATION: { inApp: true, clientEmail: true },
  CLIENT_REJECTED_ORDER: { inApp: true, clientEmail: true },
  DAMAGE_REPORTED: { inApp: true, clientEmail: true },
  MISSING_ITEMS_REPORTED: { inApp: true, clientEmail: true },
  VERIFICATION_COMPLETED: { inApp: true, clientEmail: true },
  INVOICE_GENERATED: { inApp: true, clientEmail: true },
  INVOICE_SENT: { inApp: true, clientEmail: true },
  PAYMENT_RECEIVED: { inApp: true, clientEmail: true },
  PAYMENT_OVERDUE: { inApp: true, clientEmail: true },
  ORDER_COMPLETED: { inApp: true, clientEmail: true }
};

export async function fetchNotificationSettings(tenantId?: string | null) {
  if (!tenantId) return null;
  try {
    const { data, error } = await supabase
      .from("NotificationSettings")
      .select("*")
      .eq("tenantId", tenantId)
      .maybeSingle();
    if (!error && data) return data;
  } catch {
    // Fallback to WarehouseSetting
  }

  try {
    const { data } = await supabase
      .from("WarehouseSetting")
      .select("id, tenantId, notificationPreferences, createdAt, updatedAt")
      .eq("tenantId", tenantId)
      .maybeSingle();
    if (data) {
      const prefs = (data.notificationPreferences as any) || {};
      return {
        id: data.id,
        tenantId: data.tenantId,
        enabled: prefs.enabled !== false,
        eventConfig: prefs.eventConfig || DEFAULT_NOTIFICATION_SETTINGS,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    }
  } catch {
    // Ignore
  }

  return null;
}

export async function updateNotificationSettings(
  id: string,
  payload: Partial<{ enabled?: boolean; eventConfig?: Record<NotificationType, { inApp: boolean; clientEmail: boolean }> }>
) {
  try {
    const { data, error } = await supabase
      .from("NotificationSettings")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (!error && data) return data;
  } catch {
    // Fallback to WarehouseSetting
  }

  try {
    const updatePayload: any = {
      updatedAt: new Date().toISOString()
    };
    if (payload.enabled !== undefined || payload.eventConfig !== undefined) {
      // Merge with existing
      const existing = await fetchNotificationSettings(id);
      updatePayload.notificationPreferences = {
        enabled: payload.enabled !== undefined ? payload.enabled : (existing?.enabled ?? true),
        eventConfig: payload.eventConfig || existing?.eventConfig || DEFAULT_NOTIFICATION_SETTINGS
      };
    }

    const { data, error } = await supabase
      .from("WarehouseSetting")
      .update(updatePayload)
      .or(`id.eq.${id},tenantId.eq.${id}`)
      .select()
      .maybeSingle();

    if (!error && data) {
      const prefs = (data.notificationPreferences as any) || {};
      return {
        id: data.id,
        tenantId: data.tenantId,
        enabled: prefs.enabled !== false,
        eventConfig: prefs.eventConfig || DEFAULT_NOTIFICATION_SETTINGS,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    }
  } catch (e) {
    console.error("Failed to update notification preferences in WarehouseSetting:", e);
  }

  return null;
}

export async function createNotificationSettings(payload: {
  tenantId: string;
  enabled?: boolean;
  eventConfig?: Record<NotificationType, { inApp: boolean; clientEmail: boolean }>;
}) {
  try {
    const { data, error } = await supabase
      .from("NotificationSettings")
      .insert({
        tenantId: payload.tenantId,
        enabled: payload.enabled !== false,
        eventConfig: payload.eventConfig || DEFAULT_NOTIFICATION_SETTINGS
      })
      .select()
      .single();
    if (!error && data) return data;
  } catch {
    // Fallback
  }

  try {
    const id = "ws_" + Math.random().toString(36).substring(2, 15);
    const now = new Date().toISOString();
    const notificationPreferences = {
      enabled: payload.enabled !== false,
      eventConfig: payload.eventConfig || DEFAULT_NOTIFICATION_SETTINGS
    };

    const { data, error } = await supabase
      .from("WarehouseSetting")
      .upsert({
        id,
        tenantId: payload.tenantId,
        notificationPreferences,
        updatedAt: now
      }, { onConflict: "tenantId" })
      .select()
      .single();

    if (!error && data) {
      return {
        id: data.id,
        tenantId: data.tenantId,
        enabled: notificationPreferences.enabled,
        eventConfig: notificationPreferences.eventConfig,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    }
  } catch {
    // Ignore
  }

  return null;
}

// Get or create notification settings with safe defaults
export async function getOrCreateNotificationSettings(tenantId: string) {
  const settings = await fetchNotificationSettings(tenantId);
  if (settings) return settings;
  return await createNotificationSettings({ tenantId });
}

/**
 * Sends a client email notification
 * This function respects the notification settings and tenant isolation.
 * In a production environment, this would integrate with an email provider.
 * If notification.userId is set, email is sent to that specific user;
 * otherwise, email is sent to the client contact person.
 *
 * @param notification - The notification record containing event details
 * @param tenantId - The tenant ID for security validation
 * @param clientId - The client ID to receive the email (used as fallback)
 * @returns true if email was queued/sent, false if skipped due to settings
 */
export async function sendClientEmail(
  notification: Notification,
  tenantId: string,
  clientId: string
): Promise<boolean> {
  // Get notification settings for this tenant
  const settings = await getOrCreateNotificationSettings(tenantId);

  // Check if notifications are enabled globally
  if (!settings.enabled) {
    console.debug(`Notifications disabled for tenant ${tenantId}`);
    return false;
  }

  // Check if client email is enabled for this event type
  const eventConfig = settings.eventConfig?.[notification.type as NotificationType];
  if (!eventConfig?.clientEmail) {
    console.debug(`Client email disabled for event ${notification.type}`);
    return false;
  }

  // Security: Verify client belongs to tenant
  const { data: client, error: clientError } = await supabase
    .from("Client")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientError || !client || client.tenantId !== tenantId) {
    console.error(`Security: Client ${clientId} does not belong to tenant ${tenantId}`);
    return false;
  }

  // Determine who to send the email to:
  // If notification.userId is set, send to that specific user's email
  // Otherwise, send to the client contact person (existing behavior)
  let emailRecipient: string | null = null;

  if (notification.userId) {
    // Fetch the specific user's email by userId
    const { data: user } = await supabase
      .from("User")
      .select("email")
      .eq("id", notification.userId)
      .single();

    if (user?.email) {
      emailRecipient = user.email;
    } else {
      // Fall back to client contact if user has no email
      emailRecipient = client.email ?? client.contactPerson;
    }
  } else {
    // No userId selected — send to client contact (existing behavior)
    emailRecipient = client.email ?? client.contactPerson;
  }

  // Build email payload - cast client to access email/contactPerson
  const emailClient = client as { email?: string; contactPerson?: string; tenantId: string };
  const emailPayload = buildClientEmailPayload(notification, emailClient);

  // Simulate email sending (replace with actual email provider integration)
  // In production, you would use a service like SendGrid, Mailgun, etc.
  try {
    console.log(`[Email Simulation] Sending to ${emailRecipient}:`, {
      subject: emailPayload.subject,
      to: emailRecipient,
      event: notification.type,
      tenantId,
      clientId,
      sentToUserId: notification.userId || null
    });

    // Return true to indicate email would be sent
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
}

/**
 * Builds an email payload for client notifications
 */
function buildClientEmailPayload(
  notification: Notification,
  client: Client
): { subject: string; body: string } {
  const { type, title, message, actionUrl, createdAt } = notification;

  const eventLabels: Record<string, string> = {
    NEW_ORDER: "New Order Created",
    ORDER_ISSUED: "Order Issued",
    PROCESSING_STARTED: "Order Processing Started",
    READY_FOR_DISPATCH: "Order Ready for Dispatch",
    ORDER_DISPATCHED: "Order Dispatched",
    CLIENT_RECEIVED_ORDER: "Order Received",
    CLIENT_STARTED_VERIFICATION: "Verification Started",
    CLIENT_COMPLETED_VERIFICATION: "Verification Completed",
    CLIENT_REJECTED_ORDER: "Order Rejected",
    DAMAGE_REPORTED: "Damage Reported",
    MISSING_ITEMS_REPORTED: "Missing Items Reported",
    VERIFICATION_COMPLETED: "Delivery Verification Complete",
    INVOICE_GENERATED: "Invoice Generated",
    INVOICE_SENT: "Invoice Sent",
    PAYMENT_RECEIVED: "Payment Received",
    PAYMENT_OVERDUE: "Payment Overdue",
    ORDER_COMPLETED: "Order Completed"
  };

  const eventLabel = eventLabels[type] || type;

  // Generate action link if provided
  const actionLink = actionUrl ? `\n\nView details: ${actionUrl}` : "";

  const emailBody = `
Dear ${client.contactPerson || "Valued Client"},

${title}

${message}

Event: ${eventLabel}
Timestamp: ${new Date(createdAt).toLocaleString()}

${actionLink}

Best regards,
Warevo Logistics Enterprise
`;

  return {
    subject: `${eventLabel} - ${title}`,
    body: emailBody.trim()
  };
}
