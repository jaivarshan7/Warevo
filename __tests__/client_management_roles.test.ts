import { describe, expect, it } from "vitest";
import {
  resolveDashboardType,
  canVerifyDelivery,
  canVerifyInventory,
  canRecordPayment,
  canUploadPaymentProof,
  canViewOrders,
  hasClientPermission,
  hasPermission,
  canAccessRoute
} from "@/src/lib/permissions";
import { getNavigationItems } from "@/src/lib/navigation";
import { User, ClientEmployeeRole, Role } from "@/src/types";

describe("WMS Client Management Roles & RBAC Architecture", () => {
  const makeUser = (
    employeeRole: ClientEmployeeRole | null,
    role: Role = "CLIENT",
    permissions?: string[]
  ): User => ({
    id: `usr-${(employeeRole || role).toLowerCase()}`,
    name: `User ${employeeRole || role}`,
    email: `${(employeeRole || role).toLowerCase()}@warevo.test`,
    role,
    tenantId: "tenant-1",
    clientId: "client-1",
    status: "ACTIVE",
    permissions,
    clientEmployee: employeeRole
      ? {
          id: `ce-${employeeRole.toLowerCase()}`,
          clientId: "client-1",
          tenantId: "tenant-1",
          contactPerson: `User ${employeeRole}`,
          mobile: "9876543210",
          email: `${employeeRole.toLowerCase()}@warevo.test`,
          employeeRole,
          status: "ACTIVE",
        }
      : undefined,
  });

  describe("PART 12: Dashboard Resolution Tests", () => {
    it("MANAGER resolves to CLIENT_MANAGEMENT dashboard (NOT warehouse overview)", () => {
      const type = resolveDashboardType("CLIENT", "MANAGER");
      expect(type).toBe("CLIENT_MANAGEMENT");
      expect(type === "WAREHOUSE_OVERVIEW").toBe(false);
    });

    it("GM resolves to CLIENT_MANAGEMENT dashboard (NOT warehouse overview)", () => {
      const type = resolveDashboardType("CLIENT", "GM");
      expect(type).toBe("CLIENT_MANAGEMENT");
      expect(type === "WAREHOUSE_OVERVIEW").toBe(false);
    });

    it("MD resolves to CLIENT_MANAGEMENT dashboard (NOT warehouse overview)", () => {
      const type = resolveDashboardType("CLIENT", "MD");
      expect(type).toBe("CLIENT_MANAGEMENT");
      expect(type === "WAREHOUSE_OVERVIEW").toBe(false);
    });

    it("Unassigned CLIENT resolves to CLIENT_MANAGEMENT dashboard (never warehouse overview)", () => {
      const type = resolveDashboardType("CLIENT", null);
      expect(type).toBe("CLIENT_MANAGEMENT");
      expect(type === "WAREHOUSE_OVERVIEW").toBe(false);
    });

    it("RECEIVER resolves to CLIENT_RECEIVER dashboard (NOT warehouse overview)", () => {
      const type = resolveDashboardType("CLIENT", "RECEIVER");
      expect(type).toBe("CLIENT_RECEIVER");
      expect(type === "WAREHOUSE_OVERVIEW").toBe(false);
    });

    it("STORE resolves to CLIENT_STORE dashboard (NOT warehouse overview)", () => {
      const type = resolveDashboardType("CLIENT", "STORE");
      expect(type).toBe("CLIENT_STORE");
      expect(type === "WAREHOUSE_OVERVIEW").toBe(false);
    });

    it("ACCOUNT resolves to CLIENT_ACCOUNT dashboard (NOT warehouse overview)", () => {
      const type = resolveDashboardType("CLIENT", "ACCOUNT");
      expect(type).toBe("CLIENT_ACCOUNT");
      expect(type === "WAREHOUSE_OVERVIEW").toBe(false);
    });

    it("WAREHOUSE_OWNER resolves to WAREHOUSE_OVERVIEW dashboard", () => {
      const type = resolveDashboardType("WAREHOUSE_OWNER");
      expect(type).toBe("WAREHOUSE_OVERVIEW");
      expect(type === "WAREHOUSE_OVERVIEW").toBe(true);
    });

    it("WAREHOUSE_MODERATOR resolves to WAREHOUSE_OVERVIEW dashboard", () => {
      const type = resolveDashboardType("WAREHOUSE_MODERATOR");
      expect(type).toBe("WAREHOUSE_OVERVIEW");
    });

    it("PLATFORM_ADMIN resolves to WAREHOUSE_OVERVIEW dashboard", () => {
      const type = resolveDashboardType("PLATFORM_ADMIN");
      expect(type).toBe("WAREHOUSE_OVERVIEW");
    });
  });

  describe("PART 12: Action & Permission Resolution for Management Roles", () => {
    const roles: ClientEmployeeRole[] = ["MANAGER", "GM", "MD"];

    roles.forEach((empRole) => {
      describe(`${empRole} Role Permissions`, () => {
        const user = makeUser(empRole);

        it("DELIVERY_VERIFY = true", () => {
          expect(canVerifyDelivery(user)).toBe(true);
          expect(hasClientPermission(user, "DELIVERY_VERIFY")).toBe(true);
        });

        it("INVENTORY_VERIFY = true", () => {
          expect(canVerifyInventory(user)).toBe(true);
          expect(hasClientPermission(user, "INVENTORY_VERIFY")).toBe(true);
        });

        it("PAYMENTS_RECORD = true", () => {
          expect(canRecordPayment(user)).toBe(true);
          expect(hasClientPermission(user, "PAYMENTS_RECORD")).toBe(true);
        });

        it("INVOICES_VIEW = true", () => {
          expect(hasClientPermission(user, "INVOICES_VIEW")).toBe(true);
        });

        it("ORDERS_VIEW = true", () => {
          expect(canViewOrders(user)).toBe(true);
          expect(hasClientPermission(user, "ORDERS_VIEW")).toBe(true);
        });

        it("PAYMENT_PROOF_UPLOAD = true", () => {
          expect(canUploadPaymentProof(user)).toBe(true);
          expect(hasClientPermission(user, "PAYMENT_PROOF_UPLOAD")).toBe(true);
        });

        it("REPORTS_VIEW = true", () => {
          expect(hasClientPermission(user, "REPORTS_VIEW")).toBe(true);
        });
      });
    });
  });

  describe("PART 12: Route Security Resolution (Warehouse Protection)", () => {
    const managementRoles: ClientEmployeeRole[] = ["MANAGER", "GM", "MD"];

    managementRoles.forEach((empRole) => {
      it(`${empRole} CAN access client routes`, () => {
        expect(canAccessRoute("CLIENT", "/dashboard", empRole)).toBe(true);
        expect(canAccessRoute("CLIENT", "/operations/orders", empRole)).toBe(true);
        expect(canAccessRoute("CLIENT", "/accounting", empRole)).toBe(true);
        expect(canAccessRoute("CLIENT", "/reports", empRole)).toBe(true);
        expect(canAccessRoute("CLIENT", "/notifications", empRole)).toBe(true);
      });

      it(`${empRole} CANNOT access warehouse-only administrative routes`, () => {
        // Warehouse inventory management
        expect(canAccessRoute("CLIENT", "/operations/inventory", empRole)).toBe(false);
        // Warehouse client management
        expect(canAccessRoute("CLIENT", "/operations/clients", empRole)).toBe(false);
        // Warehouse employees management
        expect(canAccessRoute("CLIENT", "/operations/employees", empRole)).toBe(false);
        expect(canAccessRoute("CLIENT", "/employees", empRole)).toBe(false);
        // Warehouse platform settings
        expect(canAccessRoute("CLIENT", "/settings", empRole)).toBe(false);
        // Platform admin
        expect(canAccessRoute("CLIENT", "/admin", empRole)).toBe(false);
        expect(canAccessRoute("CLIENT", "/platform", empRole)).toBe(false);
      });
    });

    it("WAREHOUSE_OWNER has access to warehouse routes", () => {
      expect(canAccessRoute("WAREHOUSE_OWNER", "/operations/inventory")).toBe(true);
      expect(canAccessRoute("WAREHOUSE_OWNER", "/operations/clients")).toBe(true);
      expect(canAccessRoute("WAREHOUSE_OWNER", "/operations/employees")).toBe(true);
      expect(canAccessRoute("WAREHOUSE_OWNER", "/settings")).toBe(true);
    });
  });

  describe("PART 12: Navigation Items Resolution", () => {
    it("MANAGER receives Executive Navigation with Orders, Invoices, Reports and NO warehouse stock", () => {
      const items = getNavigationItems("CLIENT", "MANAGER");
      const ids = items.map((i) => i.id);
      expect(ids).toContain("dashboard");
      expect(ids).toContain("orders");
      expect(ids).toContain("accounting");
      expect(ids).toContain("reports");
      expect(ids).not.toContain("inventory");
      expect(ids).not.toContain("clients");
      expect(ids).not.toContain("employees");
    });

    it("GM receives Executive Navigation with Orders, Invoices, Reports and NO warehouse stock", () => {
      const items = getNavigationItems("CLIENT", "GM");
      const ids = items.map((i) => i.id);
      expect(ids).toContain("dashboard");
      expect(ids).toContain("orders");
      expect(ids).toContain("accounting");
      expect(ids).toContain("reports");
      expect(ids).not.toContain("inventory");
    });

    it("MD receives Executive Navigation with Orders, Invoices, Reports and NO warehouse stock", () => {
      const items = getNavigationItems("CLIENT", "MD");
      const ids = items.map((i) => i.id);
      expect(ids).toContain("dashboard");
      expect(ids).toContain("orders");
      expect(ids).toContain("accounting");
      expect(ids).toContain("reports");
      expect(ids).not.toContain("inventory");
    });

    it("RECEIVER navigation has NO accounting or warehouse stock", () => {
      const items = getNavigationItems("CLIENT", "RECEIVER");
      const ids = items.map((i) => i.id);
      expect(ids).toContain("orders");
      expect(ids).not.toContain("accounting");
      expect(ids).not.toContain("reports");
      expect(ids).not.toContain("inventory");
    });

    it("STORE navigation has NO accounting or warehouse stock", () => {
      const items = getNavigationItems("CLIENT", "STORE");
      const ids = items.map((i) => i.id);
      expect(ids).toContain("orders");
      expect(ids).not.toContain("accounting");
      expect(ids).not.toContain("reports");
      expect(ids).not.toContain("inventory");
    });

    it("ACCOUNT navigation has NO orders or warehouse stock", () => {
      const items = getNavigationItems("CLIENT", "ACCOUNT");
      const ids = items.map((i) => i.id);
      expect(ids).toContain("accounting");
      expect(ids).not.toContain("orders");
      expect(ids).not.toContain("inventory");
    });
  });

  describe("PART 12: Order Action Workflow Gates", () => {
    it("Delivery verification is permitted for MANAGER when DISPATCHED and unverified", () => {
      const manager = makeUser("MANAGER");
      expect(canVerifyDelivery(manager)).toBe(true);
    });

    it("Delivery verification is denied for STORE and ACCOUNT", () => {
      expect(canVerifyDelivery(makeUser("STORE"))).toBe(false);
      expect(canVerifyDelivery(makeUser("ACCOUNT"))).toBe(false);
    });

    it("Store/Inventory verification is permitted for MANAGER and STORE", () => {
      expect(canVerifyInventory(makeUser("MANAGER"))).toBe(true);
      expect(canVerifyInventory(makeUser("STORE"))).toBe(true);
    });

    it("Store/Inventory verification is denied for RECEIVER and ACCOUNT", () => {
      expect(canVerifyInventory(makeUser("RECEIVER"))).toBe(false);
      expect(canVerifyInventory(makeUser("ACCOUNT"))).toBe(false);
    });

    it("Payment is permitted for MANAGER, GM, MD, ACCOUNT", () => {
      expect(canRecordPayment(makeUser("MANAGER"))).toBe(true);
      expect(canRecordPayment(makeUser("GM"))).toBe(true);
      expect(canRecordPayment(makeUser("MD"))).toBe(true);
      expect(canRecordPayment(makeUser("ACCOUNT"))).toBe(true);
    });

    it("Payment is denied for RECEIVER and STORE", () => {
      expect(canRecordPayment(makeUser("RECEIVER"))).toBe(false);
      expect(canRecordPayment(makeUser("STORE"))).toBe(false);
    });
  });
});
