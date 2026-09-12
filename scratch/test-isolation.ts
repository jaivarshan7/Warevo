import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rglumbheyypdanfpmuef.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbHVtYmhleXlwZGFuZnBtdWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjYxNzQsImV4cCI6MjEwMzE0MjE3NH0.8cTQrLjtp2RjF86VWUSbCaS0cvC6b-yVYP9YsbL3q5Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const isClientRole = (role: string) => role === "CLIENT" || role === "CLIENT_ACCOUNTANT";

async function fetchOrders(tenantId?: string | null, role?: string, clientId?: string | null) {
  let query = supabase
    .from("Order")
    .select("id, orderNumber, tenantId, clientId")
    .order("createdAt", { ascending: false });

  if (role !== "PLATFORM_ADMIN" && tenantId) {
    query = query.eq("tenantId", tenantId);
  }
  if (isClientRole(role || "")) {
    if (!clientId) return [];
    query = query.eq("clientId", clientId);
  }
  const { data } = await query;
  return data || [];
}

async function fetchOrderById(orderId: string, tenantId?: string | null, clientId?: string | null, userRole?: string) {
  if (isClientRole(userRole || "") && !clientId) return null;

  let query = supabase
    .from("Order")
    .select("id, orderNumber, tenantId, clientId")
    .eq("id", orderId);

  if (userRole && userRole !== "PLATFORM_ADMIN" && tenantId) {
    query = query.eq("tenantId", tenantId);
  }
  if (isClientRole(userRole || "") && clientId) {
    query = query.eq("clientId", clientId);
  }
  const { data } = await query.maybeSingle();
  if (!data) return null;
  if (isClientRole(userRole || "") && data.clientId !== clientId) return null;
  return data;
}

async function fetchInvoices(tenantId?: string | null, clientId?: string | null, role?: string) {
  let query = supabase
    .from("Invoice")
    .select("id, invoiceNumber, tenantId, clientId")
    .order("createdAt", { ascending: false });

  if (role !== "PLATFORM_ADMIN" && tenantId) {
    query = query.eq("tenantId", tenantId);
  }
  if (isClientRole(role || "")) {
    if (!clientId) return [];
    query = query.eq("clientId", clientId);
  }
  const { data } = await query;
  return data || [];
}

async function fetchInvoiceById(invoiceId: string, tenantId?: string | null, clientId?: string | null, userRole?: string) {
  if (isClientRole(userRole || "") && !clientId) return null;

  let query = supabase
    .from("Invoice")
    .select("id, invoiceNumber, tenantId, clientId")
    .eq("id", invoiceId);

  if (userRole && userRole !== "PLATFORM_ADMIN" && tenantId) {
    query = query.eq("tenantId", tenantId);
  }
  if (isClientRole(userRole || "") && clientId) {
    query = query.eq("clientId", clientId);
  }
  const { data } = await query.maybeSingle();
  if (!data) return null;
  if (isClientRole(userRole || "") && data.clientId !== clientId) return null;
  return data;
}

async function test() {
  const tenantId = "7398ea38-92ce-4a6f-96ac-135c051c36ac";
  const clientA_pvr = "a5ddae1c-8f8d-4e91-be72-7392c03ed06b";
  const clientB_kauvery = "7c5eac47-1b6f-44ce-8814-9b773aa7cfa8";

  console.log("=== CLIENT A (PVR) TESTS ===");
  const pvrOrders = await fetchOrders(tenantId, "CLIENT", clientA_pvr);
  console.log("List Client A orders (count, numbers):", pvrOrders.length, pvrOrders.map(o => o.orderNumber));
  
  const pvrOwnOrder = await fetchOrderById("ord_vmbqcjay6", tenantId, clientA_pvr, "CLIENT");
  console.log("Open Client A order (ORD-2):", pvrOwnOrder ? `YES (${pvrOwnOrder.orderNumber})` : "NO");

  const pvrOtherOrder = await fetchOrderById("ord_r771o0kqj", tenantId, clientA_pvr, "CLIENT");
  console.log("Open Client B order (ORD-1) by ID:", pvrOtherOrder ? `LEAKED (${pvrOtherOrder.orderNumber})` : "BLOCKED (null)");

  const pvrInvoices = await fetchInvoices(tenantId, clientA_pvr, "CLIENT");
  console.log("List Client A invoices:", pvrInvoices.length, pvrInvoices.map(i => i.invoiceNumber));

  const pvrOwnInvoice = await fetchInvoiceById("inv_6e5429174d12a914", tenantId, clientA_pvr, "CLIENT");
  console.log("Open Client A invoice (INV-2):", pvrOwnInvoice ? `YES (${pvrOwnInvoice.invoiceNumber})` : "NO");

  const pvrOtherInvoice = await fetchInvoiceById("inv_84ebf935c079b55c", tenantId, clientA_pvr, "CLIENT");
  console.log("Open Client B invoice (INV-1) by ID:", pvrOtherInvoice ? `LEAKED (${pvrOtherInvoice.invoiceNumber})` : "BLOCKED (null)");

  console.log("\n=== CLIENT B (KAUVERY) TESTS ===");
  const kauveryOrders = await fetchOrders(tenantId, "CLIENT", clientB_kauvery);
  console.log("List Client B orders (count, numbers):", kauveryOrders.length, kauveryOrders.map(o => o.orderNumber));

  const kauveryOwnOrder = await fetchOrderById("ord_r771o0kqj", tenantId, clientB_kauvery, "CLIENT");
  console.log("Open Client B order (ORD-1):", kauveryOwnOrder ? `YES (${kauveryOwnOrder.orderNumber})` : "NO");

  const kauveryOtherOrder = await fetchOrderById("ord_vmbqcjay6", tenantId, clientB_kauvery, "CLIENT");
  console.log("Open Client A order (ORD-2) by ID:", kauveryOtherOrder ? `LEAKED (${kauveryOtherOrder.orderNumber})` : "BLOCKED (null)");

  console.log("\n=== WAREHOUSE OWNER (ALEX) TESTS ===");
  const ownerOrders = await fetchOrders(tenantId, "WAREHOUSE_OWNER");
  console.log("Owner sees all orders:", ownerOrders.length, "orders");
  const ownerOrder1 = await fetchOrderById("ord_r771o0kqj", tenantId, undefined, "WAREHOUSE_OWNER");
  const ownerOrder2 = await fetchOrderById("ord_vmbqcjay6", tenantId, undefined, "WAREHOUSE_OWNER");
  console.log("Owner can open Order 1:", !!ownerOrder1, "Order 2:", !!ownerOrder2);

  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
