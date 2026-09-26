import { describe, expect, it } from "vitest";
import {
  hasClientPermission,
  canVerifyDelivery,
  canVerifyInventory,
  canRecordPayment,
  canUploadPaymentProof,
  canViewOrders,
  hasPermission,
  canAccessTenant
} from "@/src/lib/permissions";
import { User, ClientEmployeeRole } from "@/src/types";

describe("WMS RBAC Client Permissions & Authorization Matrix", () => {
  const makeUser = (
    employeeRole: ClientEmployeeRole,
    status: "ACTIVE" | "INACTIVE" = "ACTIVE",
    tenantId = "tenant-1",
    clientId = "client-1",
    userStatus: "ACTIVE" | "INACTIVE" = "ACTIVE",
    roleDefinition?: any,
    permissions?: string[]
  ): User => ({
    id: `usr-${employeeRole.toLowerCase()}`,
    name: `User ${employeeRole}`,
    email: `${employeeRole.toLowerCase()}@client.test`,
    role: "CLIENT",
    tenantId,
    clientId,
    status: userStatus,
    permissions,
    clientEmployee: {
      id: `ce-${employeeRole.toLowerCase()}`,
      clientId,
      tenantId,
      contactPerson: `User ${employeeRole}`,
      mobile: "9876543210",
      email: `${employeeRole.toLowerCase()}@client.test`,
      employeeRole,
      status,
      roleDefinition
    }
  });

  describe("RECEIVER Role", () => {
    const receiver = makeUser("RECEIVER");

    it("DELIVERY_VERIFY is allowed", () => {
      expect(canVerifyDelivery(receiver)).toBe(true);
      expect(hasClientPermission(receiver, "DELIVERY_VERIFY")).toBe(true);
      expect(hasPermission("CLIENT", "DELIVERY_VERIFY", receiver)).toBe(true);
    });

    it("INVENTORY_VERIFY is denied", () => {
      expect(canVerifyInventory(receiver)).toBe(false);
      expect(hasClientPermission(receiver, "INVENTORY_VERIFY")).toBe(false);
      expect(hasPermission("CLIENT", "INVENTORY_VERIFY", receiver)).toBe(false);
    });

    it("PAYMENTS_RECORD is denied", () => {
      expect(canRecordPayment(receiver)).toBe(false);
      expect(hasClientPermission(receiver, "PAYMENTS_RECORD")).toBe(false);
      expect(hasPermission("CLIENT", "PAYMENTS_RECORD", receiver)).toBe(false);
    });

    it("ORDERS_VIEW is allowed", () => {
      expect(canViewOrders(receiver)).toBe(true);
      expect(hasClientPermission(receiver, "ORDERS_VIEW")).toBe(true);
    });
  });

  describe("STORE Role", () => {
    const store = makeUser("STORE");

    it("DELIVERY_VERIFY is denied according to matrix", () => {
      expect(canVerifyDelivery(store)).toBe(false);
      expect(hasClientPermission(store, "DELIVERY_VERIFY")).toBe(false);
      expect(hasPermission("CLIENT", "DELIVERY_VERIFY", store)).toBe(false);
    });

    it("INVENTORY_VERIFY is allowed", () => {
      expect(canVerifyInventory(store)).toBe(true);
      expect(hasClientPermission(store, "INVENTORY_VERIFY")).toBe(true);
      expect(hasPermission("CLIENT", "INVENTORY_VERIFY", store)).toBe(true);
    });

    it("PAYMENTS_RECORD is denied", () => {
      expect(canRecordPayment(store)).toBe(false);
      expect(hasClientPermission(store, "PAYMENTS_RECORD")).toBe(false);
      expect(hasPermission("CLIENT", "PAYMENTS_RECORD", store)).toBe(false);
    });

    it("ORDERS_VIEW is allowed", () => {
      expect(canViewOrders(store)).toBe(true);
      expect(hasClientPermission(store, "ORDERS_VIEW")).toBe(true);
    });
  });

  describe("ACCOUNT Role", () => {
    const account = makeUser("ACCOUNT");

    it("PAYMENTS_RECORD is allowed", () => {
      expect(canRecordPayment(account)).toBe(true);
      expect(canUploadPaymentProof(account)).toBe(true);
      expect(hasClientPermission(account, "PAYMENTS_RECORD")).toBe(true);
      expect(hasPermission("CLIENT", "PAYMENTS_RECORD", account)).toBe(true);
    });

    it("DELIVERY_VERIFY is denied", () => {
      expect(canVerifyDelivery(account)).toBe(false);
      expect(hasClientPermission(account, "DELIVERY_VERIFY")).toBe(false);
      expect(hasPermission("CLIENT", "DELIVERY_VERIFY", account)).toBe(false);
    });

    it("INVENTORY_VERIFY is denied", () => {
      expect(canVerifyInventory(account)).toBe(false);
      expect(hasClientPermission(account, "INVENTORY_VERIFY")).toBe(false);
      expect(hasPermission("CLIENT", "INVENTORY_VERIFY", account)).toBe(false);
    });
  });

  describe("Dynamic Database RoleDefinition / RolePermission Assignment", () => {
    it("respects dynamic RoleDefinition permissions assigned in admin DB", () => {
      const customRoleUser = makeUser(
        "RECEIVER",
        "ACTIVE",
        "tenant-1",
        "client-1",
        "ACTIVE",
        {
          id: "custom_role_special",
          name: "CUSTOM_ROLE",
          permissions: [
            { key: "DELIVERY_VERIFY" },
            { key: "INVENTORY_VERIFY" }
          ]
        }
      );
      // Both permissions present in roleDefinition
      expect(hasClientPermission(customRoleUser, "DELIVERY_VERIFY")).toBe(true);
      expect(hasClientPermission(customRoleUser, "INVENTORY_VERIFY")).toBe(true);
      expect(hasClientPermission(customRoleUser, "PAYMENTS_RECORD")).toBe(false);
    });

    it("respects live user.permissions resolved via rpc_get_my_permissions", () => {
      const userWithLivePerms = makeUser(
        "STORE",
        "ACTIVE",
        "tenant-1",
        "client-1",
        "ACTIVE",
        undefined,
        ["INVENTORY_VERIFY", "DELIVERY_VERIFY"]
      );
      expect(hasClientPermission(userWithLivePerms, "DELIVERY_VERIFY")).toBe(true);
      expect(hasClientPermission(userWithLivePerms, "INVENTORY_VERIFY")).toBe(true);
      expect(hasClientPermission(userWithLivePerms, "PAYMENTS_RECORD")).toBe(false);
    });
  });

  describe("Security, Inactivity & Rejection Tests", () => {
    it("rejects inactive ClientEmployee even if role is valid", () => {
      const inactiveEmp = makeUser("RECEIVER", "INACTIVE");
      expect(canVerifyDelivery(inactiveEmp)).toBe(false);
      expect(hasClientPermission(inactiveEmp, "DELIVERY_VERIFY")).toBe(false);
    });

    it("rejects inactive User even if ClientEmployee is active", () => {
      const inactiveUser = makeUser("RECEIVER", "ACTIVE", "tenant-1", "client-1", "INACTIVE");
      expect(canVerifyDelivery(inactiveUser)).toBe(false);
      expect(hasClientPermission(inactiveUser, "DELIVERY_VERIFY")).toBe(false);
    });

    it("rejects user with no ClientEmployee record", () => {
      const userWithoutEmp: User = {
        id: "usr-no-emp",
        name: "No Employee",
        email: "noemp@client.test",
        role: "CLIENT",
        status: "ACTIVE",
        tenantId: "tenant-1"
      };
      expect(canVerifyDelivery(userWithoutEmp)).toBe(false);
      expect(canVerifyInventory(userWithoutEmp)).toBe(false);
      expect(canRecordPayment(userWithoutEmp)).toBe(false);
      expect(hasClientPermission(userWithoutEmp, "DELIVERY_VERIFY")).toBe(false);
    });

    it("rejects cross-tenant access", () => {
      expect(canAccessTenant("CLIENT", "tenant-alpha", "tenant-beta")).toBe(false);
      expect(canAccessTenant("CLIENT", "tenant-alpha", "tenant-alpha")).toBe(true);
    });
  });
});
