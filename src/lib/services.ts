import { supabase } from "./supabase";
import {
  Order,
  Inventory,
  Client,
  Invoice,
  Notification,
  AuditLog,
  OrderStatus,
  InventoryMovementType,
  VerificationStatus,
  Role
} from "@/types";

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

    if (role === "CLIENT" && clientId) {
      orderQuery = orderQuery.eq("clientId", clientId);
      invoiceQuery = invoiceQuery.eq("clientId", clientId);
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
  clientId?: string | null
): Promise<Order[]> {
  let query = supabase
    .from("Order")
    .select("*, client:Client(*), createdBy:User!createdById(*), assignedStaff:User!assignedStaffId(*), items:OrderItem(*, product:Product(*))")
    .order("createdAt", { ascending: false });

  if (role !== "PLATFORM_ADMIN" && tenantId) {
    query = query.eq("tenantId", tenantId);
  }
  if (role === "CLIENT" && clientId) {
    query = query.eq("clientId", clientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Order[]) || [];
}

export async function fetchOrderById(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("Order")
    .select(`
      *,
      client:Client(*),
      createdBy:User!createdById(*),
      assignedStaff:User!assignedStaffId(*),
      items:OrderItem(*, product:Product(*)),
      statusHistory:OrderStatusHistory(*, changedBy:User!changedById(*)),
      verification:VerificationResponse(*)
    `)
    .eq("id", orderId)
    .single();

  if (error) {
    console.error("Error fetching order by ID:", error);
    return null;
  }
  return data as Order;
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

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from("Order")
    .insert({
      id: orderId,
      tenantId: payload.tenantId,
      clientId: payload.clientId,
      orderNumber,
      status: "DRAFT",
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

  return order;
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

// ======================== ACCOUNTING & INVOICES ========================

export async function fetchInvoices(
  tenantId?: string | null,
  clientId?: string | null
): Promise<Invoice[]> {
  let query = supabase
    .from("Invoice")
    .select("*, client:Client(*), order:Order(*), items:InvoiceItem(*, product:Product(*)), payments:Payment(*)")
    .order("createdAt", { ascending: false });

  if (tenantId) query = query.eq("tenantId", tenantId);
  if (clientId) query = query.eq("clientId", clientId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as Invoice[]) || [];
}

export async function fetchInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from("Invoice")
    .select("*, client:Client(*), order:Order(*), items:InvoiceItem(*, product:Product(*)), payments:Payment(*)")
    .eq("id", invoiceId)
    .single();

  if (error) {
    console.error("Error fetching invoice:", error);
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
  const { data, error } = await supabase.rpc("rpc_record_payment", {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: method,
    p_reference: reference || null,
    p_proof_url: proofUrl || null,
    p_user_id: userId || null,
    p_user_role: userRole || "ACCOUNTS_TEAM"
  });

  if (error) throw error;
  return data;
}

// ======================== NOTIFICATIONS ========================

export async function fetchUserNotifications(
  tenantId?: string | null,
  userId?: string | null
): Promise<Notification[]> {
  let query = supabase
    .from("Notification")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(30);

  if (tenantId) query = query.eq("tenantId", tenantId);
  if (userId) query = query.or(`userId.eq.${userId},userId.is.null`);

  const { data, error } = await query;
  if (error) throw error;
  return (data as Notification[]) || [];
}

export async function markNotificationRead(notificationId: string) {
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

export async function fetchAdminDashboardData() {
  const [warehousesRes, usersRes, clientsRes, groupsRes, tenantsRes] = await Promise.all([
    supabase
      .from("Warehouse")
      .select("*, tenant:Tenant(id, name, slug), locations:WarehouseLocation(id), inventory:Inventory(id)")
      .order("createdAt", { ascending: false }),
    supabase
      .from("User")
      .select("*, tenant:Tenant(id, name, slug)")
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
    tenant: u.tenant
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
  mobile?: string;
  role: Role;
  tenantId?: string;
}) {
  const { data, error } = await supabase
    .from("User")
    .insert([
      {
        name: payload.name,
        email: payload.email || null,
        mobile: payload.mobile || null,
        role: payload.role,
        tenantId: payload.tenantId || null,
        status: "ACTIVE"
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
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
