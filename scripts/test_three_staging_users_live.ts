import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const adminSupabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== SETUP / VERIFY 3 TEST CLIENT USERS FOR PART 8 & PART 12 ===");

  const tenantId = "f03af287-52e1-4954-bf64-61330f6c5dbc";
  const clientId = "51dc7a56-6078-4f9d-9dc0-72670d6382e1";

  // Check existing users
  const { data: users } = await adminSupabase
    .from("User")
    .select("*, clientEmployee:ClientEmployee(*)")
    .eq("role", "CLIENT");

  console.log("Existing CLIENT users count:", users?.length);

  // We need 3 users with auth accounts:
  // User A (RECEIVER): receiver.test@example.com
  // User B (STORE): store.test@example.com
  // User C (ACCOUNT): account.test@example.com

  const testAccounts = [
    { email: "test.receiver@warevo.test", role: "RECEIVER", roleId: "role_receiver", name: "Test Receiver", mobile: "9876543201" },
    { email: "test.store@warevo.test", role: "STORE", roleId: "role_store", name: "Test Store", mobile: "9876543202" },
    { email: "test.account@warevo.test", role: "ACCOUNT", roleId: "role_account", name: "Test Account", mobile: "9876543203" },
  ];

  const createdAuthUsers: Record<string, { authId: string; user: any; clientEmployee: any }> = {};

  for (const acc of testAccounts) {
    // 1. Check or create Supabase Auth User
    let authUser: any = null;
    const { data: listUsers } = await adminSupabase.auth.admin.listUsers();
    authUser = listUsers?.users?.find((u) => u.email === acc.email);

    if (!authUser) {
      const { data: newAuth, error: authErr } = await adminSupabase.auth.admin.createUser({
        email: acc.email,
        password: "TestPassword123!",
        email_confirm: true,
      });
      if (authErr) throw authErr;
      authUser = newAuth.user;
      console.log(`Created auth user for ${acc.email}: ${authUser.id}`);
    } else {
      // Ensure password is set
      await adminSupabase.auth.admin.updateUserById(authUser.id, {
        password: "TestPassword123!",
        email_confirm: true,
      });
      console.log(`Found auth user for ${acc.email}: ${authUser.id}`);
    }

    // 2. Check or create WMS User
    let { data: wmsUser } = await adminSupabase
      .from("User")
      .select("*")
      .eq("email", acc.email)
      .maybeSingle();

    if (!wmsUser) {
      const { data: insertedUser, error: uErr } = await adminSupabase
        .from("User")
        .insert({
          id: `usr_${acc.role.toLowerCase()}_test`,
          email: acc.email,
          name: acc.name,
          role: "CLIENT",
          tenantId,
          status: "ACTIVE",
          supabaseUserId: authUser.id,
        })
        .select()
        .single();
      if (uErr) throw uErr;
      wmsUser = insertedUser;
      console.log(`Created WMS User for ${acc.email}: ${wmsUser.id}`);
    } else {
      // Ensure supabaseUserId and status
      const { data: updatedUser } = await adminSupabase
        .from("User")
        .update({
          supabaseUserId: authUser.id,
          status: "ACTIVE",
          tenantId,
        })
        .eq("id", wmsUser.id)
        .select()
        .single();
      wmsUser = updatedUser;
    }

    // 3. Check or create ClientEmployee
    let { data: ce } = await adminSupabase
      .from("ClientEmployee")
      .select("*")
      .eq("userId", wmsUser.id)
      .maybeSingle();

    if (!ce) {
      const { data: insertedCe, error: ceErr } = await adminSupabase
        .from("ClientEmployee")
        .insert({
          id: `ce_${acc.role.toLowerCase()}_test`,
          clientId,
          tenantId,
          userId: wmsUser.id,
          employeeRole: acc.role,
          roleId: acc.roleId,
          status: "ACTIVE",
          email: acc.email,
          contactPerson: acc.name,
          mobile: acc.mobile,
        })
        .select()
        .single();
      if (ceErr) throw ceErr;
      ce = insertedCe;
      console.log(`Created ClientEmployee for ${acc.email}: ${ce.id} (role: ${ce.employeeRole}, roleId: ${ce.roleId})`);
    } else {
      const { data: updatedCe } = await adminSupabase
        .from("ClientEmployee")
        .update({
          employeeRole: acc.role,
          roleId: acc.roleId,
          status: "ACTIVE",
        })
        .eq("id", ce.id)
        .select()
        .single();
      ce = updatedCe;
      console.log(`Updated ClientEmployee for ${acc.email}: ${ce.id} (role: ${ce.employeeRole}, roleId: ${ce.roleId})`);
    }

    createdAuthUsers[acc.role] = { authId: authUser.id, user: wmsUser, clientEmployee: ce };
  }

  console.log("\n=== TESTING AUTH SESSIONS & RPC CALLS ===");

  const orderId = "ord_81f2dce7829d8354";
  const invoiceId = "inv_ad96c47ec61ca6fb";

  // Reset order to pristine DISPATCHED, deliveryVerifiedAt = null, storeVerifiedAt = null
  await adminSupabase
    .from("Order")
    .update({
      status: "DISPATCHED",
      deliveryVerifiedAt: null,
      deliveryVerifiedById: null,
      storeVerifiedAt: null,
      storeVerifiedById: null,
      verificationStatus: "PENDING",
    })
    .eq("id", orderId);

  await adminSupabase
    .from("Invoice")
    .update({
      status: "FINAL",
      paymentStatus: "UNPAID",
    })
    .eq("id", invoiceId);

  // Delete any existing payments on this invoice
  await adminSupabase.from("Payment").delete().eq("invoiceId", invoiceId);

  console.log(`Order ${orderId} reset to DISPATCHED with deliveryVerifiedAt = null`);

  // Helper to create client
  const getAuthClient = async (email: string) => {
    const client = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );
    const { error } = await client.auth.signInWithPassword({
      email,
      password: "TestPassword123!",
    });
    if (error) throw error;
    return client;
  };

  const receiverClient = await getAuthClient("test.receiver@warevo.test");
  const storeClient = await getAuthClient("test.store@warevo.test");
  const accountClient = await getAuthClient("test.account@warevo.test");

  console.log("\n==================================================");
  console.log("TEST 1: RPC_GET_MY_PERMISSIONS FOR EACH USER");
  console.log("==================================================");

  const { data: recPerms } = await receiverClient.rpc("rpc_get_my_permissions");
  console.log("RECEIVER permissions:", recPerms?.permissions);

  const { data: storePerms } = await storeClient.rpc("rpc_get_my_permissions");
  console.log("STORE permissions:", storePerms?.permissions);

  const { data: accPerms } = await accountClient.rpc("rpc_get_my_permissions");
  console.log("ACCOUNT permissions:", accPerms?.permissions);

  console.log("\n==================================================");
  console.log("TEST 2: UNAUTHORIZED ROLE ATTEMPTS BEFORE WORKFLOW");
  console.log("==================================================");

  // STORE tries delivery verification (should be rejected)
  const { data: storeDelivRes, error: storeDelivErr } = await storeClient.rpc("rpc_submit_verification", {
    p_order_id: orderId,
    p_status: "VERIFIED",
    p_responses: {},
  });
  console.log("STORE calling rpc_submit_verification (DELIVERY_VERIFY):", 
    storeDelivErr ? `REJECTED (${storeDelivErr.message})` : (storeDelivRes?.success ? "UNEXPECTED SUCCESS" : `REJECTED (${storeDelivRes?.message})`));

  // ACCOUNT tries delivery verification (should be rejected)
  const { data: accDelivRes, error: accDelivErr } = await accountClient.rpc("rpc_submit_verification", {
    p_order_id: orderId,
    p_status: "VERIFIED",
    p_responses: {},
  });
  console.log("ACCOUNT calling rpc_submit_verification (DELIVERY_VERIFY):", 
    accDelivErr ? `REJECTED (${accDelivErr.message})` : (accDelivRes?.success ? "UNEXPECTED SUCCESS" : `REJECTED (${accDelivRes?.message})`));

  // RECEIVER tries inventory verification (should be rejected)
  const { data: recStoreRes, error: recStoreErr } = await receiverClient.rpc("rpc_submit_store_verification", {
    p_order_id: orderId,
    p_items: [],
  });
  console.log("RECEIVER calling rpc_submit_store_verification (INVENTORY_VERIFY):", 
    recStoreErr ? `REJECTED (${recStoreErr.message})` : (recStoreRes?.success ? "UNEXPECTED SUCCESS" : `REJECTED (${recStoreRes?.message})`));

  // RECEIVER tries payment (should be rejected)
  const { data: recPayRes, error: recPayErr } = await receiverClient.rpc("rpc_record_payment_secure", {
    p_invoice_id: invoiceId,
    p_amount: 100,
    p_method: "BANK_TRANSFER",
    p_reference: "REF-REC",
  });
  console.log("RECEIVER calling rpc_record_payment_secure (PAYMENTS_RECORD):", 
    recPayErr ? `REJECTED (${recPayErr.message})` : (recPayRes?.success ? "UNEXPECTED SUCCESS" : `REJECTED (${recPayRes?.message})`));

  // STORE tries payment (should be rejected)
  const { data: storePayRes, error: storePayErr } = await storeClient.rpc("rpc_record_payment_secure", {
    p_invoice_id: invoiceId,
    p_amount: 100,
    p_method: "BANK_TRANSFER",
    p_reference: "REF-STORE",
  });
  console.log("STORE calling rpc_record_payment_secure (PAYMENTS_RECORD):", 
    storePayErr ? `REJECTED (${storePayErr.message})` : (storePayRes?.success ? "UNEXPECTED SUCCESS" : `REJECTED (${storePayRes?.message})`));

  // ACCOUNT tries payment before delivery verification (should be blocked by PAYMENT GATE: deliveryVerifiedAt IS NULL)
  const { data: earlyPayRes, error: earlyPayErr } = await accountClient.rpc("rpc_record_payment_secure", {
    p_invoice_id: invoiceId,
    p_amount: 100,
    p_method: "BANK_TRANSFER",
    p_reference: "REF-EARLY",
  });
  console.log("ACCOUNT calling payment BEFORE delivery verification (PAYMENT GATE CHECK):", 
    earlyPayErr ? `GATE ENFORCED (${earlyPayErr.message})` : (earlyPayRes?.success ? "UNEXPECTED SUCCESS" : `GATE ENFORCED (${earlyPayRes?.message})`));

  console.log("\n==================================================");
  console.log("TEST 3: AUTHORIZED WORKFLOW EXECUTION");
  console.log("==================================================");

  // 1. RECEIVER executes Delivery Verification
  const checklist = [
    { id: "seal_intact", checked: true },
    { id: "box_undamaged", checked: true },
    { id: "count_matches", checked: true },
    { id: "labels_verified", checked: true },
    { id: "temp_compliant", checked: true },
    { id: "doc_matched", checked: true },
    { id: "signoff_ready", checked: true },
  ];
  const { data: validDelivRes, error: validDelivErr } = await receiverClient.rpc("rpc_submit_verification", {
    p_order_id: orderId,
    p_status: "VERIFIED",
    p_responses: checklist,
    p_comments: "Delivery verified successfully by RECEIVER",
  });
  console.log("1. RECEIVER executing delivery verification:", validDelivRes?.success ? "SUCCESS" : `FAILED: ${validDelivErr?.message || validDelivRes?.message}`);

  // Verify deliveryVerifiedAt was set on order
  const { data: updatedOrd1 } = await adminSupabase.from("Order").select("status, deliveryVerifiedAt, storeVerifiedAt").eq("id", orderId).single();
  console.log("   Order state after delivery verification:", { status: updatedOrd1?.status, deliveryVerifiedAt: updatedOrd1?.deliveryVerifiedAt });

  // 2. STORE executes Store Verification
  const { data: validStoreRes, error: validStoreErr } = await storeClient.rpc("rpc_submit_store_verification", {
    p_order_id: orderId,
    p_items: [],
    p_comments: "Inventory verified successfully by STORE",
  });
  console.log("2. STORE executing store/inventory verification:", validStoreRes?.success ? "SUCCESS" : `FAILED: ${validStoreErr?.message || validStoreRes?.message}`);

  // Verify storeVerifiedAt was set on order
  const { data: updatedOrd2 } = await adminSupabase.from("Order").select("status, storeVerifiedAt").eq("id", orderId).single();
  console.log("   Order state after store verification:", { status: updatedOrd2?.status, storeVerifiedAt: updatedOrd2?.storeVerifiedAt });

  // 3. ACCOUNT executes Payment Recording
  const { data: validPayRes, error: validPayErr } = await accountClient.rpc("rpc_record_payment_secure", {
    p_invoice_id: invoiceId,
    p_amount: 4078.08,
    p_method: "BANK_TRANSFER",
    p_reference: "REF-ACCOUNT-PAY",
  });
  console.log("3. ACCOUNT executing payment recording:", validPayRes?.success ? "SUCCESS" : `FAILED: ${validPayErr?.message || validPayRes?.message}`);

  console.log("\n==================================================");
  console.log("TEST 4: SECURITY DEFINER & ISOLATION REJECTIONS");
  console.log("==================================================");

  // Cross-tenant user test: create a user in a different tenant and attempt to access this order/invoice
  const crossTenantEmail = "crosstenant.test@warevo.test";
  let { data: crossAuth } = await adminSupabase.auth.admin.listUsers();
  let crossUser = crossAuth?.users?.find(u => u.email === crossTenantEmail);
  if (!crossUser) {
    const { data: createdCross } = await adminSupabase.auth.admin.createUser({
      email: crossTenantEmail,
      password: "TestPassword123!",
      email_confirm: true,
    });
    crossUser = createdCross.user;
  }
  // Link to a dummy tenant
  const foreignTenantId = "00000000-0000-0000-0000-000000000001";
  await adminSupabase.from("User").upsert({
    id: "usr_cross_test",
    email: crossTenantEmail,
    role: "CLIENT",
    tenantId: foreignTenantId,
    status: "ACTIVE",
    supabaseUserId: crossUser!.id,
  });
  await adminSupabase.from("ClientEmployee").upsert({
    id: "ce_cross_test",
    clientId: "00000000-0000-0000-0000-000000000002",
    tenantId: foreignTenantId,
    userId: "usr_cross_test",
    employeeRole: "RECEIVER",
    roleId: "role_receiver",
    status: "ACTIVE",
    email: crossTenantEmail,
    contactPerson: "Cross Tenant",
    mobile: "9876543299",
  });

  const crossClient = await getAuthClient(crossTenantEmail);
  const { data: crossDelivRes, error: crossDelivErr } = await crossClient.rpc("rpc_submit_verification", {
    p_order_id: orderId,
    p_status: "VERIFIED",
    p_responses: checklist,
  });
  console.log("Cross-tenant user calling rpc_submit_verification:",
    crossDelivErr ? `REJECTED (${crossDelivErr.message})` : (crossDelivRes?.success ? "UNEXPECTED SUCCESS" : `REJECTED (${crossDelivRes?.message})`));

  // Inactive ClientEmployee test
  await adminSupabase.from("ClientEmployee").update({ status: "INACTIVE" }).eq("id", "ce_cross_test");
  const { data: inactCeRes, error: inactCeErr } = await crossClient.rpc("rpc_submit_verification", {
    p_order_id: orderId,
    p_status: "VERIFIED",
    p_responses: checklist,
  });
  console.log("Inactive ClientEmployee calling rpc_submit_verification:",
    inactCeErr ? `REJECTED (${inactCeErr.message})` : (inactCeRes?.success ? "UNEXPECTED SUCCESS" : `REJECTED (${inactCeRes?.message})`));

  // Inactive User test
  await adminSupabase.from("User").update({ status: "INACTIVE" }).eq("id", "usr_cross_test");
  const { data: inactUserRes, error: inactUserErr } = await crossClient.rpc("rpc_submit_verification", {
    p_order_id: orderId,
    p_status: "VERIFIED",
    p_responses: checklist,
  });
  console.log("Inactive User calling rpc_submit_verification:",
    inactUserErr ? `REJECTED (${inactUserErr.message})` : (inactUserRes?.success ? "UNEXPECTED SUCCESS" : `REJECTED (${inactUserRes?.message})`));

  // Cleanup cross tenant user
  await adminSupabase.from("ClientEmployee").delete().eq("id", "ce_cross_test");
  await adminSupabase.from("User").delete().eq("id", "usr_cross_test");
  await adminSupabase.auth.admin.deleteUser(crossUser!.id);
  console.log("Cross-tenant test user cleaned up.");
}

main().catch(console.error);
