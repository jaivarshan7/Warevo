import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CreateEmployeeRequest {
  name: string;
  email: string;
  password: string;
  mobile?: string;
  role: string;
  tenantId?: string;
  // Client Employee specific fields
  clientEmployeeRole?: string;
  clientId?: string;
  companyName?: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstNumber?: string;
}

interface CreateEmployeeResponse {
  success: boolean;
  userId?: string;
  clientId?: string;
  employeeId?: string;
  error?: string;
  code?: string;
}

// Allowed warehouse employee roles
const WAREHOUSE_EMPLOYEE_ROLES = [
  "WAREHOUSE_STAFF",
  "ACCOUNTS_TEAM",
  "ACCOUNTANT",
  "WAREHOUSE_MODERATOR",
];

// Valid roles for a client employee
const VALID_CLIENT_EMPLOYEE_ROLES = [
  "RECEIVER",
  "STORE",
  "ACCOUNT",
  "MANAGER",
  "GM",
  "MD",
];

// Roles authorized to manage/create employees (matches Phase 6B rpc_update_employee)
// WAREHOUSE_MODERATOR is strictly excluded.
const AUTHORIZED_CREATOR_ROLES = [
  "PLATFORM_ADMIN",
  "WAREHOUSE_OWNER",
];

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // CORS preflight handling
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get and validate Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid authorization header", code: "AUTH_MISSING" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error", code: "SERVER_CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 2. Verify caller's JWT and extract auth.uid()
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !authUser) {
      console.error("Invalid JWT:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication token", code: "INVALID_TOKEN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerSupabaseUserId = authUser.id;

    // 3. Resolve caller's WMS profile from database using auth.uid()
    const { data: callerWmsUser, error: callerFetchError } = await supabaseAdmin
      .from("User")
      .select("id, name, email, role, tenantId, supabaseUserId, status")
      .eq("supabaseUserId", callerSupabaseUserId)
      .single();

    if (callerFetchError || !callerWmsUser) {
      console.error("Caller WMS user not found for auth.uid:", callerSupabaseUserId);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authenticated user does not have a WMS profile",
          code: "CALLER_NOT_FOUND",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (callerWmsUser.status !== "ACTIVE") {
      return new Response(
        JSON.stringify({ success: false, error: "Your account is inactive", code: "CALLER_INACTIVE" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check caller authorization
    if (!AUTHORIZED_CREATOR_ROLES.includes(callerWmsUser.role)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unauthorized: role ${callerWmsUser.role} cannot create users or employees`,
          code: "UNAUTHORIZED_ROLE",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Parse and validate request body
    const requestBody: CreateEmployeeRequest = await req.json();
    const {
      name,
      email,
      password,
      mobile,
      role,
      tenantId: requestedTenantId,
      clientEmployeeRole,
      clientId,
      companyName,
      billingAddress,
      shippingAddress,
      gstNumber,
    } = requestBody;

    if (!name || !name.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Name is required", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email format", code: "INVALID_EMAIL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ success: false, error: "Password is required", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: "Password must be at least 8 characters", code: "PASSWORD_TOO_SHORT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!role) {
      return new Response(
        JSON.stringify({ success: false, error: "Role is required", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Validate target role and tenant permissions based on caller's actual role
    let targetTenantId: string;

    if (callerWmsUser.role === "PLATFORM_ADMIN") {
      // Platform admin can create: warehouse employees, WAREHOUSE_OWNER, CLIENT
      const adminAllowedRoles = [
        ...WAREHOUSE_EMPLOYEE_ROLES,
        "WAREHOUSE_OWNER",
        "CLIENT",
      ];
      if (!adminAllowedRoles.includes(role)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Invalid role '${role}'. Allowed roles: ${adminAllowedRoles.join(", ")}`,
            code: "INVALID_ROLE",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!requestedTenantId) {
        return new Response(
          JSON.stringify({ success: false, error: "Company / Organization selection is required", code: "MISSING_TENANT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify target tenant exists and is ACTIVE
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("Tenant")
        .select("id, name, status")
        .eq("id", requestedTenantId)
        .single();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid organization specified", code: "INVALID_TENANT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (tenant.status !== "ACTIVE") {
        return new Response(
          JSON.stringify({ success: false, error: "Specified organization is not active", code: "TENANT_INACTIVE" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetTenantId = requestedTenantId;
    } else {
      // WAREHOUSE_OWNER: strictly locked to own tenantId
      if (!callerWmsUser.tenantId) {
        return new Response(
          JSON.stringify({ success: false, error: "Caller does not belong to any organization", code: "CALLER_NO_TENANT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetTenantId = callerWmsUser.tenantId;

      const ownerAllowedRoles = [
        ...WAREHOUSE_EMPLOYEE_ROLES,
        "CLIENT",
      ];
      if (!ownerAllowedRoles.includes(role)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unauthorized to create role '${role}'. Allowed roles: ${ownerAllowedRoles.join(", ")}`,
            code: "INVALID_ROLE",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let targetClientId: string | undefined = undefined;

    if (role === "CLIENT") {
      if (!clientEmployeeRole || !VALID_CLIENT_EMPLOYEE_ROLES.includes(clientEmployeeRole)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Client employee role is required. Valid roles: ${VALID_CLIENT_EMPLOYEE_ROLES.join(", ")}`,
            code: "INVALID_CLIENT_ROLE",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!clientId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "A valid client company must be selected to add an employee.",
            code: "MISSING_CLIENT_COMPANY",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Look up existing Client company and verify it belongs to targetTenantId
      const { data: existingClient, error: clientFetchErr } = await supabaseAdmin
        .from("Client")
        .select("id, companyName, tenantId")
        .eq("id", clientId)
        .single();

      if (clientFetchErr || !existingClient) {
        return new Response(
          JSON.stringify({ success: false, error: "Selected client company does not exist", code: "INVALID_CLIENT_ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existingClient.tenantId !== targetTenantId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Client company does not belong to your organization",
            code: "TENANT_MISMATCH",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetClientId = existingClient.id;

      // Check ClientEmployee unique constraint: (tenantId, mobile)
      if (mobile && mobile.trim()) {
        const { data: existingEmployeeMobile } = await supabaseAdmin
          .from("ClientEmployee")
          .select("id, contactPerson")
          .eq("tenantId", targetTenantId)
          .eq("mobile", mobile.trim())
          .maybeSingle();

        if (existingEmployeeMobile) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `A client employee with mobile number ${mobile.trim()} already exists in this organization`,
              code: "DUPLICATE_CLIENT_MOBILE",
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 8. Pre-check email duplicates in WMS User table
    const { data: existingWmsUser } = await supabaseAdmin
      .from("User")
      .select("id, email")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (existingWmsUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "This email address is already registered.",
          code: "DUPLICATE_EMAIL",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Step 1: Create Supabase Auth user (auth.users)
    const { data: createdAuthUser, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        created_by: callerWmsUser.id,
        created_at: new Date().toISOString(),
      },
    });

    if (authCreateError) {
      console.error("Failed to create Supabase Auth user:", authCreateError.message);
      if (
        authCreateError.message.includes("already been registered") ||
        authCreateError.message.includes("duplicate") ||
        authCreateError.message.includes("User already registered")
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "This email address is already registered.",
            code: "DUPLICATE_EMAIL",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create authentication account. Please try again.",
          code: "AUTH_CREATE_FAILED",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!createdAuthUser?.user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authentication account creation returned empty result",
          code: "AUTH_CREATE_EMPTY",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newAuthUserId = createdAuthUser.user.id;

    // 10. Step 2: Insert into WMS User table
    const newWmsUserId = `usr_${Math.random().toString(36).substring(2, 11)}${Math.random().toString(36).substring(2, 11)}`;
    const { data: createdWmsUser, error: wmsCreateError } = await supabaseAdmin
      .from("User")
      .insert({
        id: newWmsUserId,
        tenantId: targetTenantId,
        supabaseUserId: newAuthUserId,
        role: role,
        name: name.trim(),
        email: normalizedEmail,
        mobile: mobile?.trim() || null,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (wmsCreateError) {
      console.error("Failed to create WMS User:", wmsCreateError.message);

      // COMPENSATING ROLLBACK: Delete created Auth user
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
      if (deleteAuthError) {
        console.error("Failed to rollback Auth user after WMS User insert failure:", deleteAuthError.message);
      }

      if (wmsCreateError.message.includes("duplicate key") || wmsCreateError.code === "23505") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "This email address is already registered.",
            code: "DUPLICATE_EMAIL",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create user profile",
          code: "WMS_CREATE_FAILED",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 11. Step 3: If role === "CLIENT", create linked ClientEmployee record
    let createdEmployeeId: string | undefined = undefined;

    if (role === "CLIENT" && targetClientId) {
      const newEmployeeId = `ce_${Math.random().toString(36).substring(2, 11)}${Math.random().toString(36).substring(2, 11)}`;
      const { data: createdEmployee, error: employeeCreateError } = await supabaseAdmin
        .from("ClientEmployee")
        .insert({
          id: newEmployeeId,
          tenantId: targetTenantId,
          clientId: targetClientId,
          userId: createdWmsUser.id,
          contactPerson: name.trim(),
          mobile: mobile?.trim() || "",
          email: normalizedEmail,
          employeeRole: clientEmployeeRole,
          status: "ACTIVE",
        })
        .select()
        .single();

      if (employeeCreateError) {
        console.error("Failed to create ClientEmployee record for user:", employeeCreateError.message);

        // COMPENSATING ROLLBACK:
        // 1. Delete created WMS User
        const { error: deleteWmsError } = await supabaseAdmin
          .from("User")
          .delete()
          .eq("id", createdWmsUser.id);
        if (deleteWmsError) {
          console.error("Failed to rollback WMS User after ClientEmployee failure:", deleteWmsError.message);
        }

        // 2. Delete created Supabase Auth user
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
        if (deleteAuthError) {
          console.error("Failed to rollback Auth user after ClientEmployee failure:", deleteAuthError.message);
        }

        if (employeeCreateError.code === "23505" || employeeCreateError.message.includes("unique")) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "A client contact with this mobile number already exists in this organization.",
              code: "DUPLICATE_CLIENT_MOBILE",
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create client employee record",
            code: "CLIENT_EMPLOYEE_CREATE_FAILED",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      createdEmployeeId = createdEmployee.id;
    }

    // 12. Success response
    const response: CreateEmployeeResponse = {
      success: true,
      userId: createdWmsUser.id,
      clientId: targetClientId,
      employeeId: createdEmployeeId,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    console.error("Unexpected error in create-employee Edge Function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
        code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
