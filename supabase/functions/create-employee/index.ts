import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, User as SupabaseUser } from "https://esm.sh/@supabase/supabase-js@2";

interface CreateEmployeeRequest {
  name: string;
  email: string;
  password: string;
  mobile?: string;
  role: string;
  tenantId?: string;
}

interface CreateEmployeeResponse {
  success: boolean;
  userId?: string;
  error?: string;
  code?: string;
}

// Allowed warehouse employee roles - server-side enforcement
const ALLOWED_EMPLOYEE_ROLES = [
  "WAREHOUSE_STAFF",
  "ACCOUNTS_TEAM",
  "ACCOUNTANT",
  "WAREHOUSE_MODERATOR"
];

// Roles that can create employees
const AUTHORIZED_CREATOR_ROLES = [
  "PLATFORM_ADMIN",
  "WAREHOUSE_OWNER",
  "WAREHOUSE_MODERATOR"
];

serve(async (req: Request) => {
  // CORS preflight handling
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid authorization header", code: "AUTH_MISSING" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");

    // Create Supabase client with service role key from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error", code: "SERVER_CONFIG_ERROR" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the JWT and get the authenticated user
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !authUser) {
      console.error("Invalid JWT:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication token", code: "INVALID_TOKEN" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const callerSupabaseUserId = authUser.id;

    // Load the caller's WMS User record
    const { data: callerWmsUser, error: callerFetchError } = await supabaseAdmin
      .from("User")
      .select("id, name, email, role, tenantId, supabaseUserId, status")
      .eq("supabaseUserId", callerSupabaseUserId)
      .single();

    if (callerFetchError || !callerWmsUser) {
      console.error("Caller WMS user not found:", callerFetchError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Authenticated user does not have a WMS profile", 
          code: "CALLER_NOT_FOUND" 
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if caller is active
    if (callerWmsUser.status !== "ACTIVE") {
      return new Response(
        JSON.stringify({ success: false, error: "Your account is inactive", code: "CALLER_INACTIVE" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate caller has permission to create employees
    if (!AUTHORIZED_CREATOR_ROLES.includes(callerWmsUser.role)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Unauthorized: ${callerWmsUser.role} cannot create employees`, 
          code: "UNAUTHORIZED_ROLE" 
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const requestBody: CreateEmployeeRequest = await req.json();
    const { name, email, password, mobile, role, tenantId } = requestBody;

    // Validate required fields
    if (!name || !name.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Name is required", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ success: false, error: "Password is required", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: "Password must be at least 8 characters", code: "PASSWORD_TOO_SHORT" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!role) {
      return new Response(
        JSON.stringify({ success: false, error: "Role is required", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email format", code: "INVALID_EMAIL" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // SERVER-SIDE: Validate role - only allow warehouse employee roles
    if (!ALLOWED_EMPLOYEE_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid role. Allowed roles: ${ALLOWED_EMPLOYEE_ROLES.join(", ")}`, 
          code: "INVALID_ROLE" 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Determine the tenant/company for the new employee
    let targetTenantId: string | null = null;

    if (callerWmsUser.role === "PLATFORM_ADMIN") {
      // Platform admin can create employees for authorized tenants
      // If tenantId is provided, validate it exists
      if (tenantId) {
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from("Tenant")
          .select("id, name, status")
          .eq("id", tenantId)
          .single();

        if (tenantError || !tenant) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid company/tenant specified", code: "INVALID_TENANT" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (tenant.status !== "ACTIVE") {
          return new Response(
            JSON.stringify({ success: false, error: "Selected company is not active", code: "TENANT_INACTIVE" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        targetTenantId = tenantId;
      } else {
        // Platform admin must specify a tenant
        return new Response(
          JSON.stringify({ success: false, error: "Company selection is required", code: "MISSING_TENANT" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } else {
      // WAREHOUSE_OWNER or WAREHOUSE_MODERATOR: restrict to their own tenant
      targetTenantId = callerWmsUser.tenantId;

      if (!targetTenantId) {
        return new Response(
          JSON.stringify({ success: false, error: "Caller does not belong to any company", code: "CALLER_NO_TENANT" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // If frontend sent a different tenantId, ignore it and use caller's tenant
      // This prevents privilege escalation
      if (tenantId && tenantId !== targetTenantId) {
        console.warn(`Attempted tenant override: caller=${callerWmsUser.tenantId}, requested=${tenantId}`);
      }
    }

    // Check for duplicate email in WMS User table
    const { data: existingWmsUser } = await supabaseAdmin
      .from("User")
      .select("id, email")
      .ilike("email", email.trim())
      .single();

    if (existingWmsUser) {
      return new Response(
        JSON.stringify({ success: false, error: "An employee with this email already exists", code: "DUPLICATE_EMAIL" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate email in Supabase Auth
    const { data: existingAuthUser, error: authCheckError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .single();

    // Note: This check may fail due to RLS, so we'll handle the error during user creation

    // Create Supabase Auth user using Admin API
    const { data: createdAuthUser, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true, // Auto-confirm since admin is creating
      user_metadata: {
        created_by: callerWmsUser.id,
        created_at: new Date().toISOString(),
      }
    });

    if (authCreateError) {
      console.error("Failed to create Supabase Auth user:", authCreateError.message);
      
      // Handle specific error cases
      if (authCreateError.message.includes("already been registered") || 
          authCreateError.message.includes("duplicate key")) {
        return new Response(
          JSON.stringify({ success: false, error: "An account with this email already exists", code: "DUPLICATE_EMAIL" }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Failed to create authentication account", code: "AUTH_CREATE_FAILED" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!createdAuthUser?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication account creation returned empty result", code: "AUTH_CREATE_EMPTY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const newAuthUserId = createdAuthUser.user.id;

    // Create WMS User record
    const { data: createdWmsUser, error: wmsCreateError } = await supabaseAdmin
      .from("User")
      .insert({
        id: `usr_${Math.random().toString(36).substring(2, 11)}${Math.random().toString(36).substring(2, 11)}`,
        tenantId: targetTenantId,
        supabaseUserId: newAuthUserId,
        role: role,
        name: name.trim(),
        email: email.trim(),
        mobile: mobile?.trim() || null,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (wmsCreateError) {
      console.error("Failed to create WMS User:", wmsCreateError.message);
      
      // ROLLBACK: Delete the Supabase Auth user if WMS User creation fails
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
      if (deleteAuthError) {
        console.error("Failed to rollback Auth user:", deleteAuthError.message);
      }

      // Handle specific error cases
      if (wmsCreateError.message.includes("duplicate key") || wmsCreateError.code === "23505") {
        return new Response(
          JSON.stringify({ success: false, error: "An employee with this email already exists", code: "DUPLICATE_EMAIL" }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Failed to create employee record", code: "WMS_CREATE_FAILED" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Success!
    const response: CreateEmployeeResponse = {
      success: true,
      userId: createdWmsUser.id,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });

  } catch (error: any) {
    console.error("Unexpected error in create-employee:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
