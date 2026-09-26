import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
const adminSupabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testUser(email: string, roleName: string) {
  console.log(`\n==================================================`);
  console.log(`TESTING USER: ${email} (${roleName})`);
  console.log(`==================================================`);

  const client = createClient(supabaseUrl, supabaseKey);
  const { data: authData, error: loginErr } = await client.auth.signInWithPassword({
    email,
    password: "TestPassword123!",
  });

  if (loginErr) {
    console.error(`Login error for ${email}:`, loginErr.message);
    return;
  }

  const userId = authData.user.id;
  console.log(`Logged in successfully! User ID: ${userId}`);

  // Fetch User record and ClientEmployee record
  const { data: userRec } = await adminSupabase
    .from("User")
    .select("*")
    .eq("email", email)
    .single();

  const { data: ceRec } = await adminSupabase
    .from("ClientEmployee")
    .select("*")
    .eq("userId", userRec?.id)
    .single();

  console.log(`User.role: ${userRec?.role}`);
  console.log(`ClientEmployee.employeeRole: ${ceRec?.employeeRole}`);
  console.log(`ClientEmployee.roleId: ${ceRec?.roleId}`);

  // Call rpc_get_my_permissions
  const { data: permsData, error: permErr } = await client.rpc("rpc_get_my_permissions");
  if (permErr) {
    console.error("rpc_get_my_permissions error:", permErr.message);
  } else {
    console.log(`rpc_get_my_permissions returned ${permsData?.permissions?.length || 0} permissions:`, permsData?.permissions);
  }

  const clientId = ceRec?.clientId || "51dc7a56-6078-4f9d-9dc0-72670d6382e1";
  const { data: clientRow } = await adminSupabase.from("Client").select("tenantId").eq("id", clientId).single();
  const tenantId = clientRow?.tenantId || "f03af287-52e1-4954-bf64-61330f6c5dbc";

  // Let's create a dedicated test order to test delivery verification, store verification, and payment
  const orderNum = `TEST-${roleName}-${Date.now().toString().slice(-6)}`;
  const { data: newOrder, error: ordErr } = await adminSupabase
    .from("Order")
    .insert({
      orderNumber: orderNum,
      tenantId,
      clientId,
      createdById: userRec?.id,
      status: "DISPATCHED",
      verificationStatus: "PENDING",
      subtotal: 5000,
      taxTotal: 900,
      discountTotal: 0,
      totalAmount: 5900,
      notes: `Test order for ${roleName}`,
    })
    .select()
    .single();

  if (ordErr || !newOrder) {
    console.error("Failed to create test order:", ordErr);
    return;
  }
  console.log(`Created test order ${newOrder.id} (${newOrder.orderNumber}) in DISPATCHED state`);

  // Create an invoice for this order
  const invoiceId = `inv_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
  const { data: newInvoice, error: invErr } = await adminSupabase
    .from("Invoice")
    .insert({
      id: invoiceId,
      invoiceNumber: `INV-${orderNum}`,
      orderId: newOrder.id,
      clientId,
      tenantId,
      subtotal: 5000,
      cgst: 450,
      sgst: 450,
      igst: 0,
      discountTotal: 0,
      total: 5900,
      status: "FINAL",
      paymentStatus: "UNPAID",
      updatedAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (invErr || !newInvoice) {
    console.error("Failed to create test invoice:", invErr);
    return;
  }
  console.log(`Created test invoice ${newInvoice.id} (${newInvoice.invoiceNumber})`);

  // 1. Try payment BEFORE delivery verification (Payment gate should reject)
  const { data: earlyPayRes, error: earlyPayErr } = await client.rpc("rpc_record_payment_secure", {
    p_invoice_id: newInvoice.id,
    p_amount: 5900,
    p_method: "BANK_TRANSFER",
    p_reference: `REF-EARLY-${roleName}`,
  });
  console.log(`1. Early payment before delivery verification:`,
    earlyPayErr ? `GATE ENFORCED (${earlyPayErr.message})` : (earlyPayRes?.success ? "FAILED (Unexpected success)" : `GATE ENFORCED (${earlyPayRes?.message})`));

  // 2. Test Delivery Verification
  const checklist = [
    { id: "seal_intact", checked: true },
    { id: "box_undamaged", checked: true },
    { id: "count_matches", checked: true },
    { id: "labels_verified", checked: true },
    { id: "temp_compliant", checked: true },
    { id: "doc_matched", checked: true },
    { id: "signoff_ready", checked: true },
  ];
  const { data: delivRes, error: delivErr } = await client.rpc("rpc_submit_verification", {
    p_order_id: newOrder.id,
    p_status: "VERIFIED",
    p_responses: checklist,
    p_comments: `Delivery verified by ${roleName}`,
  });
  console.log(`2. Delivery verification by ${roleName}:`,
    delivRes?.success ? "SUCCESS" : `FAILED: ${delivErr?.message || delivRes?.message}`);

  // Check order status
  const { data: ordAfterDeliv } = await adminSupabase.from("Order").select("status, deliveryVerifiedAt").eq("id", newOrder.id).single();
  console.log(`   Order after delivery verification: status=${ordAfterDeliv?.status}, deliveryVerifiedAt=${ordAfterDeliv?.deliveryVerifiedAt}`);

  // 3. Test Store/Inventory Verification
  const { data: storeRes, error: storeErr } = await client.rpc("rpc_submit_store_verification", {
    p_order_id: newOrder.id,
    p_items: [],
    p_comments: `Store verified by ${roleName}`,
  });
  console.log(`3. Store/inventory verification by ${roleName}:`,
    storeRes?.success ? "SUCCESS" : `FAILED: ${storeErr?.message || storeRes?.message}`);

  const { data: ordAfterStore } = await adminSupabase.from("Order").select("status, storeVerifiedAt").eq("id", newOrder.id).single();
  console.log(`   Order after store verification: status=${ordAfterStore?.status}, storeVerifiedAt=${ordAfterStore?.storeVerifiedAt}`);

  // 4. Test Payment AFTER delivery verification
  const { data: payRes, error: payErr } = await client.rpc("rpc_record_payment_secure", {
    p_invoice_id: newInvoice.id,
    p_amount: 5900,
    p_method: "BANK_TRANSFER",
    p_reference: `REF-FINAL-${roleName}`,
  });
  console.log(`4. Payment recording after delivery verification by ${roleName}:`,
    payRes?.success ? "SUCCESS" : `FAILED: ${payErr?.message || payRes?.message}`);

  const { data: invAfterPay } = await adminSupabase.from("Invoice").select("paymentStatus").eq("id", newInvoice.id).single();
  console.log(`   Invoice paymentStatus: ${invAfterPay?.paymentStatus}`);
}

async function run() {
  await testUser("mang@user.com", "MANAGER");
  await testUser("gm@user.com", "GM");
  await testUser("md@user.com", "MD");
}

run().catch(console.error);
