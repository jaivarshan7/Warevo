import { describe, expect, it, vi, beforeEach } from "vitest";
import { ALLOWED_EMPLOYEE_ROLES } from "@/src/types";
import { hasPermission } from "@/src/lib/permissions";
import { fetchEmployees, updateEmployeeSecure, createClientEmployeeWithUser } from "@/src/lib/services";
import { supabase } from "@/src/lib/supabase";

// Mock supabase client
vi.mock("@/src/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "mock-token" } },
          error: null
        })
      }
    },
  };
});

describe("Employee Roles and Permissions", () => {
  it("defines exactly the 4 authorized DB employee roles in ALLOWED_EMPLOYEE_ROLES", () => {
    expect(ALLOWED_EMPLOYEE_ROLES).toEqual([
      "WAREHOUSE_STAFF",
      "ACCOUNTS_TEAM",
      "ACCOUNTANT",
      "WAREHOUSE_MODERATOR",
    ]);
  });

  it("does not include admin, management, or client roles in ALLOWED_EMPLOYEE_ROLES", () => {
    expect(ALLOWED_EMPLOYEE_ROLES).not.toContain("PLATFORM_ADMIN");
    expect(ALLOWED_EMPLOYEE_ROLES).not.toContain("WAREHOUSE_OWNER");
    expect(ALLOWED_EMPLOYEE_ROLES).not.toContain("MANAGER");
    expect(ALLOWED_EMPLOYEE_ROLES).not.toContain("GM");
    expect(ALLOWED_EMPLOYEE_ROLES).not.toContain("CLIENT");
    expect(ALLOWED_EMPLOYEE_ROLES).not.toContain("CLIENT_ACCOUNTANT");
  });

  it("verifies employees:manage permission matches application model", () => {
    // Only WAREHOUSE_OWNER and PLATFORM_ADMIN have employees:manage
    expect(hasPermission("WAREHOUSE_OWNER", "employees:manage")).toBe(true);
    expect(hasPermission("PLATFORM_ADMIN", "employees:manage")).toBe(true);

    // MANAGER and GM do NOT have employees:manage
    expect(hasPermission("MANAGER", "employees:manage")).toBe(false);
    expect(hasPermission("GM", "employees:manage")).toBe(false);

    // Employee roles do not have employees:manage
    expect(hasPermission("WAREHOUSE_STAFF", "employees:manage")).toBe(false);
    expect(hasPermission("WAREHOUSE_MODERATOR", "employees:manage")).toBe(false);
    expect(hasPermission("ACCOUNTANT", "employees:manage")).toBe(false);
    expect(hasPermission("CLIENT", "employees:manage")).toBe(false);
  });
});

describe("Employee Services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchEmployees returns empty array without querying when tenantId is null or missing", async () => {
    const resultNull = await fetchEmployees(null);
    expect(resultNull).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();

    const resultUndefined = await fetchEmployees(undefined);
    expect(resultUndefined).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("fetchEmployees queries Supabase filtering by tenantId and ALLOWED_EMPLOYEE_ROLES", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        { id: "u1", role: "WAREHOUSE_STAFF", name: "Staff 1" },
        { id: "u2", role: "WAREHOUSE_MODERATOR", name: "Mod 1" },
      ],
      error: null,
    });
    const inMock = vi.fn().mockReturnValue({ order: orderMock });
    const eqMock = vi.fn().mockReturnValue({ in: inMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await fetchEmployees("tenant-123");

    expect(supabase.from).toHaveBeenCalledWith("User");
    expect(selectMock).toHaveBeenCalledWith("*, tenant:Tenant(*)");
    expect(eqMock).toHaveBeenCalledWith("tenantId", "tenant-123");
    expect(inMock).toHaveBeenCalledWith("role", ALLOWED_EMPLOYEE_ROLES);
    expect(result).toHaveLength(2);
  });

  it("updateEmployeeSecure calls rpc_update_employee with correct parameters", async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: {
        success: true,
        targetId: "target-456",
        previousRole: "WAREHOUSE_STAFF",
        newRole: "ACCOUNTANT",
      },
      error: null,
    });

    const result = await updateEmployeeSecure({
      actorId: "actor-123",
      actorRole: "WAREHOUSE_OWNER",
      targetId: "target-456",
      name: "Jane Doe",
      role: "ACCOUNTANT",
      status: "ACTIVE",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("rpc_update_employee", {
      p_actor_id: "actor-123",
      p_actor_role: "WAREHOUSE_OWNER",
      p_target_id: "target-456",
      p_name: "Jane Doe",
      p_email: null,
      p_mobile: null,
      p_new_role: "ACCOUNTANT",
      p_new_status: "ACTIVE",
    });
    expect(result.success).toBe(true);
    expect(result.newRole).toBe("ACCOUNTANT");
  });

  it("createClientEmployeeWithUser throws error if existing user is an employee or owner", async () => {
    // Mock finding an existing user who is a WAREHOUSE_STAFF
    const ilikeMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "u-staff",
          name: "John Staff",
          email: "staff@test.com",
          role: "WAREHOUSE_STAFF",
          tenantId: "tenant-123",
          status: "ACTIVE",
        },
      ],
      error: null,
    });
    const eqMock = vi.fn().mockReturnValue({ ilike: ilikeMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Cannot convert employee 'John Staff' (WAREHOUSE_STAFF) to a CLIENT",
      }),
    } as any);

    await expect(
      createClientEmployeeWithUser({
        tenantId: "tenant-123",
        clientId: "client-abc",
        contactPerson: "John Staff",
        email: "staff@test.com",
        mobile: "1234567890",
        employeeRole: "STORE",
      })
    ).rejects.toThrow(/Cannot convert employee 'John Staff' \(WAREHOUSE_STAFF\) to a CLIENT/);

    fetchSpy.mockRestore();
  });
});
