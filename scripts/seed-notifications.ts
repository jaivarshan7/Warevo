import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedNotifications() {
  console.log("Seeding notifications...");

  // Fetch existing tenants and users
  const { data: tenants } = await supabase.from("Tenant").select("id, name");
  const { data: users } = await supabase.from("User").select("id, name, role, tenantId");
  const { data: orders } = await supabase.from("Order").select("id, orderNumber, tenantId").limit(5);

  if (!tenants?.length || !users?.length) {
    console.error("No tenants or users found. Please seed basic data first.");
    return;
  }

  const tenant = tenants[0];
  const tenantUsers = users.filter((u) => u.tenantId === tenant.id);

  if (tenantUsers.length === 0) {
    console.error("No users found for tenant:", tenant.name);
    return;
  }

  // Generate a variety of realistic notifications
  const now = new Date();
  const notifications = [
    {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      tenantId: tenant.id,
      userId: tenantUsers[0]?.id || null,
      orderId: orders?.[0]?.id || null,
      type: "NEW_ORDER",
      title: "New Order Created",
      message: `Order ${orders?.[0]?.orderNumber || "ORD-2026-000001"} has been created and is awaiting processing.`,
      priority: "HIGH",
      actionUrl: orders?.[0] ? `/operations/orders/${orders[0].id}` : "/operations/orders",
      read: false,
      createdAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString()
    },
    {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      tenantId: tenant.id,
      userId: tenantUsers[0]?.id || null,
      orderId: orders?.[1]?.id || null,
      type: "ORDER_DISPATCHED",
      title: "Order Dispatched",
      message: `Order ${orders?.[1]?.orderNumber || "ORD-2026-000002"} has been dispatched and is en route to the client.`,
      priority: "MEDIUM",
      actionUrl: orders?.[1] ? `/operations/orders/${orders[1].id}` : "/operations/orders",
      read: false,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString()
    },
    {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      tenantId: tenant.id,
      userId: tenantUsers[0]?.id || null,
      orderId: null,
      type: "INVOICE_GENERATED",
      title: "Invoice Auto-Generated",
      message: "A new invoice has been generated for the latest verified order. Review it in the Accounting section.",
      priority: "MEDIUM",
      actionUrl: "/accounting?tab=invoices",
      read: false,
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString()
    },
    {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      tenantId: tenant.id,
      userId: tenantUsers[0]?.id || null,
      orderId: null,
      type: "PAYMENT_RECEIVED",
      title: "Payment Received",
      message: "A payment of ₹45,000 has been received via NEFT/RTGS. Invoice status updated to PAID.",
      priority: "HIGH",
      actionUrl: "/accounting?tab=payments",
      read: true,
      readAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
    },
    {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      tenantId: tenant.id,
      userId: tenantUsers[0]?.id || null,
      orderId: orders?.[2]?.id || null,
      type: "VERIFICATION_COMPLETED",
      title: "Verification Completed",
      message: `Client has completed product verification for order ${orders?.[2]?.orderNumber || "ORD-2026-000003"}. All items confirmed.`,
      priority: "LOW",
      actionUrl: orders?.[2] ? `/operations/orders/${orders[2].id}` : "/operations/orders",
      read: true,
      readAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString()
    },
    {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      tenantId: tenant.id,
      userId: null, // broadcast to all users in tenant
      orderId: null,
      type: "DAMAGE_REPORTED",
      title: "Damage Report Filed",
      message: "A damage report has been filed for inventory zone B2. 3 units of 'Premium Steel Rods' marked as damaged.",
      priority: "HIGH",
      actionUrl: "/operations/inventory",
      read: false,
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
    },
    {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      tenantId: tenant.id,
      userId: tenantUsers[0]?.id || null,
      orderId: null,
      type: "PAYMENT_OVERDUE",
      title: "Payment Overdue Alert",
      message: "Invoice INV-2026-000005 is 7 days overdue. Total outstanding: ₹1,25,000. Please follow up with the client.",
      priority: "HIGH",
      actionUrl: "/accounting?tab=invoices",
      read: false,
      createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()
    },
    {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      tenantId: tenant.id,
      userId: tenantUsers[0]?.id || null,
      orderId: null,
      type: "PROCESSING_STARTED",
      title: "Processing Started",
      message: "Order ORD-2026-000008 has entered the PROCESSING stage. Warehouse staff assigned.",
      priority: "LOW",
      actionUrl: "/operations/orders",
      read: true,
      readAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  // Delete existing notifications first
  const { error: deleteErr } = await supabase
    .from("Notification")
    .delete()
    .eq("tenantId", tenant.id);

  if (deleteErr) {
    console.warn("Warning: Could not clear existing notifications:", deleteErr.message);
  }

  const { data, error } = await supabase.from("Notification").insert(notifications).select();

  if (error) {
    console.error("Error seeding notifications:", error);
    return;
  }

  console.log(`✅ Successfully seeded ${data.length} notifications for tenant "${tenant.name}"`);
  data.forEach((n) => {
    console.log(`  - [${n.read ? "READ" : "UNRD"}] ${n.title} (${n.type})`);
  });
}

seedNotifications().catch(console.error);
