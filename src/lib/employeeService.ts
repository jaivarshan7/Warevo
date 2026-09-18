import { supabase } from "./supabase";
import { Role, ClientEmployeeRole, UserStatus } from "@/types";

export interface CreateEmployeePayload {
  name: string;
  email: string;
  password: string;
  mobile?: string;
  role: Role;
  tenantId?: string;
  clientEmployeeRole?: ClientEmployeeRole;
  clientId?: string;
  companyName?: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstNumber?: string;
}

export interface CreateEmployeeResult {
  success: boolean;
  userId?: string;
  clientId?: string;
  error?: string;
  code?: string;
}

/**
 * Creates a new employee or client employee using the Supabase Edge Function.
 * 
 * This function:
 * - Calls the create-employee Edge Function
 * - Authenticates the caller via JWT and resolves current actor identity
 * - Validates role/tenant/client permissions server-side
 * - Creates Supabase Auth user + WMS User (and Client record if role === 'CLIENT')
 * - Performs compensating rollback if any database insert fails
 * 
 * @param payload Employee creation data
 * @returns Result with success status and userId/clientId or error
 */
export async function createEmployeeWithAuth(
  payload: CreateEmployeePayload
): Promise<CreateEmployeeResult> {
  try {
    // Get the current session to obtain the JWT
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData?.session) {
      return {
        success: false,
        error: "You must be logged in to create users or employees",
        code: "NOT_AUTHENTICATED"
      };
    }

    const accessToken = sessionData.session.access_token;

    // Call the Edge Function
    const supabaseUrl = supabase.supabaseUrl;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-employee`;

    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        mobile: payload.mobile,
        role: payload.role,
        tenantId: payload.tenantId,
        clientEmployeeRole: payload.clientEmployeeRole,
        clientId: payload.clientId,
        companyName: payload.companyName,
        billingAddress: payload.billingAddress,
        shippingAddress: payload.shippingAddress,
        gstNumber: payload.gstNumber,
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "Failed to create employee",
        code: result.code || "REQUEST_FAILED"
      };
    }

    return {
      success: true,
      userId: result.userId,
      clientId: result.clientId
    };

  } catch (error: any) {
    console.error("createEmployeeWithAuth error:", error);
    
    // Handle network errors
    if (error.message?.includes("fetch") || error.message?.includes("network")) {
      return {
        success: false,
        error: "Network error. Please check your connection.",
        code: "NETWORK_ERROR"
      };
    }

    return {
      success: false,
      error: error.message || "An unexpected error occurred",
      code: "UNKNOWN_ERROR"
    };
  }
}

/**
 * Fetches warehouse employees for the current tenant.
 * Uses a secure backend approach that enforces tenant isolation.
 * 
 * @param tenantId The tenant ID to fetch employees for
 * @returns Array of employee users
 */
export async function fetchWarehouseEmployees(tenantId: string) {
  try {
    // Use the secure RPC or filtered query that enforces tenant isolation
    const { data, error } = await supabase
      .from("User")
      .select("*, tenant:Tenant(*)")
      .eq("tenantId", tenantId)
      .in("role", ["WAREHOUSE_STAFF", "ACCOUNTS_TEAM", "ACCOUNTANT", "WAREHOUSE_MODERATOR"])
      .order("createdAt", { ascending: false });

    if (error) throw error;
    
    return data || [];
  } catch (error: any) {
    console.error("fetchWarehouseEmployees error:", error);
    throw error;
  }
}
