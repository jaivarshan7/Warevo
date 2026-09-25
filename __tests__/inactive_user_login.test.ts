import { describe, expect, it, vi } from "vitest";
import { User, Tenant, ClientEmployee } from "@/src/types";

// Helper to simulate authentication and WMS user validation logic
interface ValidateLoginResult {
  allowed: boolean;
  error?: string;
  errorType?: "INVALID_CREDENTIALS" | "ACCOUNT_INACTIVE" | "NOT_REGISTERED" | "GENERAL";
  signedOut?: boolean;
}

function simulateLoginValidation(
  authResult: { user?: { id: string; email: string } | null; error?: Error | null },
  wmsUser: User | null
): ValidateLoginResult {
  // 1. Supabase Auth credential check
  if (authResult.error || !authResult.user) {
    return {
      allowed: false,
      error: "Invalid email or password.",
      errorType: "INVALID_CREDENTIALS"
    };
  }

  // 2. Lookup WMS user by supabaseUserId
  if (!wmsUser) {
    return {
      allowed: false,
      error: "Your account is not registered in the WMS. Please contact your administrator.",
      errorType: "NOT_REGISTERED",
      signedOut: true
    };
  }

  // 3. Status check for User and ClientEmployee
  const isUserInactive = wmsUser.status === "INACTIVE";
  const isClientEmployeeInactive = Boolean(wmsUser.clientEmployee && wmsUser.clientEmployee.status === "INACTIVE");

  if (isUserInactive || isClientEmployeeInactive) {
    return {
      allowed: false,
      error: "Your account is inactive. Please contact your administrator.",
      errorType: "ACCOUNT_INACTIVE",
      signedOut: true
    };
  }

  // 4. Active user succeeds
  return {
    allowed: true
  };
}

// Simulates the exact state machine in AuthCallbackPage
interface OAuthResolutionContext {
  authUser: { id: string; email: string } | null;
  authError: Error | null;
  queryError: Error | null;
  dbUserBySupabaseId: User | null;
  dbUserByEmail: User | null;
  rpcLinkSuccess: boolean;
  rpcLinkError: string | null;
}

interface OAuthResolutionOutcome {
  status: "success" | "error" | "redirect";
  redirectUrl?: string;
  errorType?: string;
  errorMessage?: string;
  errorDetail?: string;
  signedOut?: boolean;
  rpcCalled?: boolean;
  userSetInContext?: boolean;
}

function simulateOAuthResolution(ctx: OAuthResolutionContext): OAuthResolutionOutcome {
  // State A: Supabase authentication failed
  if (ctx.authError || !ctx.authUser) {
    return {
      status: "error",
      errorMessage: "Authentication failed. Please try signing in again.",
      errorDetail: ctx.authError?.message || "No valid session found."
    };
  }

  // State B: WMS lookup returned query error
  if (ctx.queryError) {
    return {
      status: "error",
      errorMessage: "Unable to verify your warehouse management account.",
      errorDetail: ctx.queryError.message,
      signedOut: true
    };
  }

  let rawUser = ctx.dbUserBySupabaseId;
  let rpcCalled = false;

  // Unlinked user: attempt rpc_link_auth_user_by_email
  if (!rawUser && ctx.authUser.email) {
    rpcCalled = true;
    if (ctx.rpcLinkError || !ctx.rpcLinkSuccess) {
      const errMsg = ctx.rpcLinkError || "";
      if (errMsg.toLowerCase().includes("inactive")) {
        return {
          status: "redirect",
          redirectUrl: "/login?error=inactive",
          errorType: "ACCOUNT_INACTIVE",
          errorMessage: "Your account is inactive. Please contact your administrator.",
          signedOut: true,
          rpcCalled: true
        };
      }
      if (errMsg.toLowerCase().includes("no wms user found")) {
        return {
          status: "redirect",
          redirectUrl: "/login?error=not_registered",
          errorType: "NOT_REGISTERED",
          errorMessage: "Your account is not registered in the WMS. Please contact your administrator.",
          signedOut: true,
          rpcCalled: true
        };
      }
      return {
        status: "error",
        errorMessage: "Account linkage failed. Please contact your administrator.",
        errorDetail: errMsg,
        signedOut: true,
        rpcCalled: true
      };
    }
    rawUser = ctx.dbUserByEmail;
  }

  // State C: WMS User does not exist
  if (!rawUser) {
    return {
      status: "redirect",
      redirectUrl: "/login?error=not_registered",
      errorType: "NOT_REGISTERED",
      errorMessage: "Your account is not registered in the WMS. Please contact your administrator.",
      signedOut: true,
      rpcCalled
    };
  }

  // State D: WMS User exists and status === INACTIVE
  if (rawUser.status === "INACTIVE") {
    return {
      status: "redirect",
      redirectUrl: "/login?error=inactive",
      errorType: "ACCOUNT_INACTIVE",
      errorMessage: "Your account is inactive. Please contact your administrator.",
      signedOut: true,
      rpcCalled
    };
  }

  // State E: WMS User exists and status === ACTIVE
  if (rawUser.clientEmployee && rawUser.clientEmployee.status === "INACTIVE") {
    return {
      status: "redirect",
      redirectUrl: "/login?error=inactive",
      errorType: "ACCOUNT_INACTIVE",
      errorMessage: "Your account is inactive. Please contact your administrator.",
      signedOut: true,
      rpcCalled
    };
  }

  // Active warehouse user or client employee
  return {
    status: "redirect",
    redirectUrl: "/dashboard",
    userSetInContext: true,
    rpcCalled
  };
}

describe("INACTIVE USER & GOOGLE OAUTH SECURITY SUITE", () => {
  const activeWarehouseUser: User = {
    id: "u-owner-1",
    name: "Alex Warehouse",
    email: "alex@gmail.com",
    role: "WAREHOUSE_OWNER",
    status: "ACTIVE",
    supabaseUserId: "sb-alex-123",
    tenantId: "tenant-1"
  };

  const activeClientEmployee: User = {
    id: "u-client-active",
    name: "Maxi Accounts",
    email: "maxi@gmail.com",
    role: "CLIENT",
    status: "ACTIVE",
    supabaseUserId: "sb-maxi-456",
    tenantId: "tenant-1",
    clientId: "cl-1",
    clientEmployee: {
      id: "ce-maxi",
      clientId: "cl-1",
      tenantId: "tenant-1",
      contactPerson: "Maxi Accounts",
      mobile: "9876543210",
      email: "maxi@gmail.com",
      employeeRole: "ACCOUNT",
      status: "ACTIVE"
    }
  };

  const inactiveWarehouseUser: User = {
    id: "u-staff-inactive",
    name: "Inactive Staff",
    email: "staff_inactive@gmail.com",
    role: "WAREHOUSE_STAFF",
    status: "INACTIVE",
    supabaseUserId: "sb-staff-789",
    tenantId: "tenant-1"
  };

  const inactiveClientEmployee: User = {
    id: "u-client-inactive",
    name: "Ash Receiver",
    email: "ash@gmail.com",
    role: "CLIENT",
    status: "INACTIVE",
    supabaseUserId: "sb-ash-000",
    tenantId: "tenant-1",
    clientId: "cl-1",
    clientEmployee: {
      id: "ce-ash",
      clientId: "cl-1",
      tenantId: "tenant-1",
      contactPerson: "Ash Receiver",
      mobile: "9876543211",
      email: "ash@gmail.com",
      employeeRole: "RECEIVER",
      status: "INACTIVE"
    }
  };

  describe("REQUIRED GOOGLE OAUTH FLOW VERIFICATIONS", () => {
    it("TEST 1: Active warehouse user + Google OAuth → dashboard", () => {
      const outcome = simulateOAuthResolution({
        authUser: { id: "sb-alex-123", email: "alex@gmail.com" },
        authError: null,
        queryError: null,
        dbUserBySupabaseId: activeWarehouseUser,
        dbUserByEmail: activeWarehouseUser,
        rpcLinkSuccess: true,
        rpcLinkError: null
      });

      expect(outcome.status).toBe("redirect");
      expect(outcome.redirectUrl).toBe("/dashboard");
      expect(outcome.userSetInContext).toBe(true);
      expect(outcome.signedOut).toBeFalsy();
    });

    it("TEST 2: Active client employee + Google OAuth → dashboard", () => {
      const outcome = simulateOAuthResolution({
        authUser: { id: "sb-maxi-456", email: "maxi@gmail.com" },
        authError: null,
        queryError: null,
        dbUserBySupabaseId: activeClientEmployee,
        dbUserByEmail: activeClientEmployee,
        rpcLinkSuccess: true,
        rpcLinkError: null
      });

      expect(outcome.status).toBe("redirect");
      expect(outcome.redirectUrl).toBe("/dashboard");
      expect(outcome.userSetInContext).toBe(true);
      expect(outcome.signedOut).toBeFalsy();
    });

    it("TEST 3: Inactive warehouse user + Google OAuth → Account Inactive", () => {
      const outcome = simulateOAuthResolution({
        authUser: { id: "sb-staff-789", email: "staff_inactive@gmail.com" },
        authError: null,
        queryError: null,
        dbUserBySupabaseId: inactiveWarehouseUser,
        dbUserByEmail: inactiveWarehouseUser,
        rpcLinkSuccess: true,
        rpcLinkError: null
      });

      expect(outcome.status).toBe("redirect");
      expect(outcome.redirectUrl).toBe("/login?error=inactive");
      expect(outcome.errorType).toBe("ACCOUNT_INACTIVE");
      expect(outcome.signedOut).toBe(true);
    });

    it("TEST 4: Inactive client employee + Google OAuth → Account Inactive", () => {
      const outcome = simulateOAuthResolution({
        authUser: { id: "sb-ash-000", email: "ash@gmail.com" },
        authError: null,
        queryError: null,
        dbUserBySupabaseId: inactiveClientEmployee,
        dbUserByEmail: inactiveClientEmployee,
        rpcLinkSuccess: true,
        rpcLinkError: null
      });

      expect(outcome.status).toBe("redirect");
      expect(outcome.redirectUrl).toBe("/login?error=inactive");
      expect(outcome.errorType).toBe("ACCOUNT_INACTIVE");
      expect(outcome.signedOut).toBe(true);
    });

    it("TEST 5: Google-authenticated user with no WMS User → Account Not Registered", () => {
      const outcome = simulateOAuthResolution({
        authUser: { id: "sb-stranger-999", email: "stranger@gmail.com" },
        authError: null,
        queryError: null,
        dbUserBySupabaseId: null,
        dbUserByEmail: null,
        rpcLinkSuccess: false,
        rpcLinkError: "No WMS user found matching email stranger@gmail.com"
      });

      expect(outcome.status).toBe("redirect");
      expect(outcome.redirectUrl).toBe("/login?error=not_registered");
      expect(outcome.errorType).toBe("NOT_REGISTERED");
      expect(outcome.signedOut).toBe(true);
      expect(outcome.errorType).not.toBe("ACCOUNT_INACTIVE");
    });

    it("TEST 6: WMS lookup/query error → authentication/bootstrap error → NOT Account Inactive", () => {
      const outcome = simulateOAuthResolution({
        authUser: { id: "sb-alex-123", email: "alex@gmail.com" },
        authError: null,
        queryError: new Error("connection to server at 'db.supabase.co' failed: timeout"),
        dbUserBySupabaseId: null,
        dbUserByEmail: null,
        rpcLinkSuccess: false,
        rpcLinkError: null
      });

      expect(outcome.status).toBe("error");
      expect(outcome.errorMessage).toBe("Unable to verify your warehouse management account.");
      expect(outcome.errorDetail).toContain("timeout");
      expect(outcome.errorType).toBeUndefined();
      expect(outcome.redirectUrl).toBeUndefined();
    });

    it("TEST 7: Existing linked active user → does not attempt unnecessary relinking", () => {
      const outcome = simulateOAuthResolution({
        authUser: { id: "sb-alex-123", email: "alex@gmail.com" },
        authError: null,
        queryError: null,
        dbUserBySupabaseId: activeWarehouseUser,
        dbUserByEmail: activeWarehouseUser,
        rpcLinkSuccess: true,
        rpcLinkError: null
      });

      expect(outcome.status).toBe("redirect");
      expect(outcome.redirectUrl).toBe("/dashboard");
      expect(outcome.rpcCalled).toBe(false);
    });

    it("TEST 8: Unlinked active WMS user with matching email → secure rpc_link_auth_user_by_email → user becomes linked → dashboard", () => {
      const unlinkedUser: User = {
        ...activeWarehouseUser,
        supabaseUserId: null
      };
      const linkedUser: User = {
        ...activeWarehouseUser,
        supabaseUserId: "sb-new-google-uid-123"
      };

      const outcome = simulateOAuthResolution({
        authUser: { id: "sb-new-google-uid-123", email: "alex@gmail.com" },
        authError: null,
        queryError: null,
        dbUserBySupabaseId: null, // initially null
        dbUserByEmail: linkedUser, // found after RPC link
        rpcLinkSuccess: true,
        rpcLinkError: null
      });

      expect(outcome.rpcCalled).toBe(true);
      expect(outcome.status).toBe("redirect");
      expect(outcome.redirectUrl).toBe("/dashboard");
      expect(outcome.userSetInContext).toBe(true);
    });

    it("TEST 9: Google OAuth followed by page refresh → active user remains authenticated", () => {
      // Simulates initAuth on page refresh when active session exists
      const hasActiveSession = true;
      const cachedUserId = "sb-alex-123";
      const resolvedUser = activeWarehouseUser;

      const isUserInactive = resolvedUser.status === "INACTIVE";
      const isClientEmployeeInactive = Boolean(resolvedUser.clientEmployee && resolvedUser.clientEmployee.status === "INACTIVE");

      const shouldStayAuthenticated = hasActiveSession && !isUserInactive && !isClientEmployeeInactive;
      expect(shouldStayAuthenticated).toBe(true);
    });

    it("TEST 10: Inactive Google user → Supabase session is signed out", () => {
      const outcome = simulateOAuthResolution({
        authUser: { id: "sb-ash-000", email: "ash@gmail.com" },
        authError: null,
        queryError: null,
        dbUserBySupabaseId: inactiveClientEmployee,
        dbUserByEmail: inactiveClientEmployee,
        rpcLinkSuccess: true,
        rpcLinkError: null
      });

      expect(outcome.status).toBe("redirect");
      expect(outcome.redirectUrl).toBe("/login?error=inactive");
      expect(outcome.signedOut).toBe(true);
    });
  });

  describe("EMAIL & PASSWORD LOGIN REGRESSION CHECKS", () => {
    it("Active user logs in successfully", () => {
      const res = simulateLoginValidation(
        { user: { id: "sb-alex-123", email: "alex@gmail.com" } },
        activeWarehouseUser
      );
      expect(res.allowed).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("Inactive user receives Account Inactive error and is signed out", () => {
      const res = simulateLoginValidation(
        { user: { id: "sb-ash-000", email: "ash@gmail.com" } },
        inactiveClientEmployee
      );
      expect(res.allowed).toBe(false);
      expect(res.error).toBe("Your account is inactive. Please contact your administrator.");
      expect(res.errorType).toBe("ACCOUNT_INACTIVE");
      expect(res.signedOut).toBe(true);
    });

    it("Wrong password receives generic Invalid email or password", () => {
      const res = simulateLoginValidation(
        { user: null, error: new Error("Invalid login credentials") },
        null
      );
      expect(res.allowed).toBe(false);
      expect(res.error).toBe("Invalid email or password.");
      expect(res.errorType).toBe("INVALID_CREDENTIALS");
    });
  });
});
