import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rglumbheyypdanfpmuef.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbHVtYmhleXlwZGFuZnBtdWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjYxNzQsImV4cCI6MjEwMzE0MjE3NH0.8cTQrLjtp2RjF86VWUSbCaS0cvC6b-yVYP9YsbL3q5Q";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbHVtYmhleXlwZGFuZnBtdWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU2NjE3NCwiZXhwIjoyMTAzMTQyMTc0fQ.tzE-CokWVlX9AQjToy51DW0XRXWeNEeTKzYVQTB3DXY";

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runVerification() {
  console.log("==================================================");
  console.log("END-TO-END SUPABASE AUTH USER CREATION VERIFICATION");
  console.log("==================================================\n");

  const cleanupUserIds = [];
  const cleanupAuthIds = [];
  const cleanupClientIds = [];

  try {
    // -------------------------------------------------------------
    // TEST 1: EXISTING USER LOGIN & INVARIANT CHECK
    // -------------------------------------------------------------
    console.log("[TEST 1] Verifying existing user login (alex@gmail.com)...");
    const { data: existLogin, error: existErr } = await supabaseAnon.auth.signInWithPassword({
      email: "alex@gmail.com",
      password: "OwnerPassword123!"
    });
    if (existErr) throw new Error(`Existing user login failed: ${existErr.message}`);
    const ownerToken = existLogin.session.access_token;
    const ownerAuthId = existLogin.user.id;

    const { data: ownerWms } = await supabaseAdmin
      .from("User")
      .select("id, email, role, tenantId, supabaseUserId")
      .eq("supabaseUserId", ownerAuthId)
      .single();

    console.log("✓ Existing user login SUCCESS!");
    console.log(`  auth.users.id: ${ownerAuthId}`);
    console.log(`  User.supabaseUserId: ${ownerWms?.supabaseUserId}`);
    console.log(`  Role: ${ownerWms?.role}, Tenant: ${ownerWms?.tenantId}`);
    if (ownerWms?.supabaseUserId !== ownerAuthId) {
      throw new Error("Invariant failed: User.supabaseUserId != auth.users.id");
    }

    // -------------------------------------------------------------
    // TEST 2: NEW WAREHOUSE EMPLOYEE CREATION & LOGIN
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Creating new Warehouse Employee with Auth...");
    const staffEmail = `wms.staff.${Date.now()}@example.com`;
    const staffPassword = "StaffPassword123!";
    const resStaff = await fetch(`${SUPABASE_URL}/functions/v1/create-employee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: "Verified Warehouse Staff",
        email: staffEmail,
        password: staffPassword,
        mobile: "+91 91234 56789",
        role: "WAREHOUSE_STAFF"
      })
    });
    const staffResult = await resStaff.json();
    console.log(`  Creation HTTP status: ${resStaff.status}`, staffResult);
    if (!staffResult.success) throw new Error(`Staff creation failed: ${staffResult.error}`);

    cleanupUserIds.push(staffResult.userId);

    // Verify DB records
    const { data: staffWms } = await supabaseAdmin
      .from("User")
      .select("*")
      .eq("id", staffResult.userId)
      .single();

    cleanupAuthIds.push(staffWms.supabaseUserId);

    console.log("✓ Warehouse employee created in WMS User table:");
    console.log(`  id: ${staffWms.id}`);
    console.log(`  role: ${staffWms.role}`);
    console.log(`  supabaseUserId: ${staffWms.supabaseUserId}`);
    console.log(`  tenantId: ${staffWms.tenantId}`);

    // Verify password is NOT in DB
    if ("password" in staffWms || "passwordHash" in staffWms) {
      throw new Error("SECURITY FAILURE: Password field found in WMS User record!");
    }
    console.log("✓ Verified NO password exists in PostgreSQL User record.");

    // Test Login with new employee
    console.log("  Testing email/password login as newly created Warehouse Employee...");
    const { data: staffLogin, error: staffLoginErr } = await supabaseAnon.auth.signInWithPassword({
      email: staffEmail,
      password: staffPassword
    });
    if (staffLoginErr) throw new Error(`New staff login failed: ${staffLoginErr.message}`);
    console.log(`✓ New Warehouse employee successfully logged in via Supabase Auth! auth.uid: ${staffLogin.user.id}`);
    if (staffLogin.user.id !== staffWms.supabaseUserId) {
      throw new Error("Invariant failed: staff auth.users.id != User.supabaseUserId");
    }

    // -------------------------------------------------------------
    // TEST 3: NEW CLIENT EMPLOYEE CREATION & LOGIN
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Creating new Client Employee with Auth & Portal Access...");
    const clientEmail = `client.receiver.${Date.now()}@example.com`;
    const clientPassword = "ClientPass123!";
    const clientMobile = `+91 ${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const resClient = await fetch(`${SUPABASE_URL}/functions/v1/create-employee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: "Verified Client Receiver",
        email: clientEmail,
        password: clientPassword,
        mobile: clientMobile,
        role: "CLIENT",
        clientEmployeeRole: "RECEIVER",
        companyName: "Prime Retailers Ltd",
        shippingAddress: "Gate 4, Prime Superstore",
        billingAddress: "Prime HQ, Commercial Area"
      })
    });
    const clientResult = await resClient.json();
    console.log(`  Creation HTTP status: ${resClient.status}`, clientResult);
    if (!clientResult.success) throw new Error(`Client employee creation failed: ${clientResult.error}`);

    cleanupUserIds.push(clientResult.userId);
    cleanupClientIds.push(clientResult.clientId);

    // Verify User and Client records
    const { data: clientWmsUser } = await supabaseAdmin
      .from("User")
      .select("*")
      .eq("id", clientResult.userId)
      .single();

    cleanupAuthIds.push(clientWmsUser.supabaseUserId);

    const { data: clientRec } = await supabaseAdmin
      .from("Client")
      .select("*")
      .eq("id", clientResult.clientId)
      .single();

    console.log("✓ Client Employee User record:");
    console.log(`  id: ${clientWmsUser.id}`);
    console.log(`  role: ${clientWmsUser.role}`);
    console.log(`  supabaseUserId: ${clientWmsUser.supabaseUserId}`);

    console.log("✓ Linked Client record:");
    console.log(`  id: ${clientRec.id}`);
    console.log(`  companyName: ${clientRec.companyName}`);
    console.log(`  employeeRole: ${clientRec.employeeRole}`);
    console.log(`  userId: ${clientRec.userId}`);

    if (clientRec.userId !== clientWmsUser.id) {
      throw new Error("Client.userId does not match User.id!");
    }

    // Test Login as Client Employee
    console.log("  Testing email/password login as newly created Client Employee...");
    const { data: clientLogin, error: clientLoginErr } = await supabaseAnon.auth.signInWithPassword({
      email: clientEmail,
      password: clientPassword
    });
    if (clientLoginErr) throw new Error(`Client employee login failed: ${clientLoginErr.message}`);
    console.log(`✓ New Client Employee successfully logged in! auth.uid: ${clientLogin.user.id}`);
    if (clientLogin.user.id !== clientWmsUser.supabaseUserId) {
      throw new Error("Invariant failed: client auth.users.id != User.supabaseUserId");
    }

    // -------------------------------------------------------------
    // TEST 4: PLATFORM ADMIN CREATION & TENANT PROVISIONING
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Testing Platform Admin user creation flow...");
    // Sign in as platform admin
    // Update platform admin password first to ensure login
    await supabaseAdmin.auth.admin.updateUserById(
      "5895f77b-80d9-4b97-b1a5-42ff65c0fc6a",
      { password: "AdminPassword123!" }
    );
    const { data: adminLogin, error: adminLoginErr } = await supabaseAnon.auth.signInWithPassword({
      email: "platform-admin@example.test",
      password: "AdminPassword123!"
    });
    if (adminLoginErr) throw new Error(`Platform admin login failed: ${adminLoginErr.message}`);
    const adminToken = adminLogin.session.access_token;

    const adminCreatedEmail = `admin.staff.${Date.now()}@example.com`;
    const adminCreatedPass = "AdminStaff123!";
    const resAdminCreate = await fetch(`${SUPABASE_URL}/functions/v1/create-employee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: "Admin Created Accountant",
        email: adminCreatedEmail,
        password: adminCreatedPass,
        mobile: "+91 98888 77777",
        role: "ACCOUNTANT",
        tenantId: ownerWms.tenantId
      })
    });
    const adminCreateResult = await resAdminCreate.json();
    console.log(`  Admin creation HTTP status: ${resAdminCreate.status}`, adminCreateResult);
    if (!adminCreateResult.success) throw new Error(`Admin user creation failed: ${adminCreateResult.error}`);

    cleanupUserIds.push(adminCreateResult.userId);
    const { data: adminCreatedWms } = await supabaseAdmin.from("User").select("supabaseUserId").eq("id", adminCreateResult.userId).single();
    cleanupAuthIds.push(adminCreatedWms.supabaseUserId);

    // Test Login for admin-created user
    const { data: adminStaffLogin, error: adminStaffLoginErr } = await supabaseAnon.auth.signInWithPassword({
      email: adminCreatedEmail,
      password: adminCreatedPass
    });
    if (adminStaffLoginErr) throw new Error(`Admin-created user login failed: ${adminStaffLoginErr.message}`);
    console.log(`✓ Admin-created accountant successfully logged in! auth.uid: ${adminStaffLogin.user.id}`);

    // -------------------------------------------------------------
    // TEST 5: TENANT ISOLATION (TAMPER RESISTANCE)
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Testing tenant isolation (WAREHOUSE_OWNER cannot create user in another tenant)...");
    const tamperEmail = `tamper.${Date.now()}@example.com`;
    const resTamper = await fetch(`${SUPABASE_URL}/functions/v1/create-employee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: "Tamper Test User",
        email: tamperEmail,
        password: "TamperPassword123!",
        role: "WAREHOUSE_STAFF",
        tenantId: "hacked-external-tenant-id"
      })
    });
    const tamperResult = await resTamper.json();
    if (tamperResult.userId) {
      cleanupUserIds.push(tamperResult.userId);
      const { data: tamperWms } = await supabaseAdmin.from("User").select("tenantId, supabaseUserId").eq("id", tamperResult.userId).single();
      cleanupAuthIds.push(tamperWms.supabaseUserId);
      console.log(`  Target tenant requested: 'hacked-external-tenant-id'`);
      console.log(`  Actual tenant assigned in DB: '${tamperWms.tenantId}'`);
      if (tamperWms.tenantId === "hacked-external-tenant-id") {
        throw new Error("SECURITY FAILURE: Edge function honored client-supplied tenantId!");
      }
      console.log("✓ Tenant isolation enforced: Edge function strictly bound user to caller's tenantId!");
    }

    // -------------------------------------------------------------
    // TEST 6: COMPENSATING ROLLBACK & ORPHAN CLEANUP
    // -------------------------------------------------------------
    console.log("\n[TEST 6] Testing compensating rollback when DB operation fails...");
    // 1. Insert a dummy client with a specific phone number to trigger duplicate mobile constraint
    const conflictMobile = "+91 90000 00001";
    const { data: dummyClient } = await supabaseAdmin.from("Client").insert({
      id: `cl_dummy_${Date.now()}`,
      tenantId: ownerWms.tenantId,
      companyName: "Conflict Co",
      contactPerson: "Conflict Person",
      mobile: conflictMobile,
      billingAddress: "Test Addr",
      shippingAddress: "Test Addr"
    }).select().single();

    cleanupClientIds.push(dummyClient.id);

    // 2. Try creating client employee with same mobile
    const orphanTestEmail = `orphan.candidate.${Date.now()}@example.com`;
    const resOrphan = await fetch(`${SUPABASE_URL}/functions/v1/create-employee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: "Orphan Candidate",
        email: orphanTestEmail,
        password: "OrphanPassword123!",
        mobile: conflictMobile,
        role: "CLIENT",
        clientEmployeeRole: "RECEIVER",
        companyName: "Conflict Co"
      })
    });
    const orphanResult = await resOrphan.json();
    console.log(`  Orphan test response status: ${resOrphan.status} (Expected: 409)`, orphanResult);

    // 3. Verify no auth user exists for orphanTestEmail
    const { data: allAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
    const orphanAuth = allAuthUsers?.users?.find(u => u.email === orphanTestEmail);
    if (orphanAuth) {
      throw new Error(`CLEANUP FAILURE: Found orphan auth user ${orphanAuth.id} for email ${orphanTestEmail}`);
    }
    console.log("✓ Compensating cleanup verified: No orphan auth.users record was left behind!");

    console.log("\n==================================================");
    console.log("ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (100%)");
    console.log("==================================================");

  } catch (err) {
    console.error("\n❌ VERIFICATION TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    console.log("\nCleaning up test artifacts from database...");
    for (const id of cleanupClientIds) {
      await supabaseAdmin.from("Client").delete().eq("id", id);
    }
    for (const id of cleanupUserIds) {
      await supabaseAdmin.from("User").delete().eq("id", id);
    }
    for (const id of cleanupAuthIds) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }
    console.log("Cleanup completed.");
  }
}

runVerification();
