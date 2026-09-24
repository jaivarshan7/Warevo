import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLIENT_ROLE_PERMISSIONS,
  hasClientPermission,
  canVerifyDelivery,
  canVerifyInventory,
  canRecordPayment,
  canUploadPaymentProof,
  canViewOrders,
  canAccessAccounting,
  canAccessRoute,
  canAccessTenant
} from "@/src/lib/permissions";
import { getRoleDisplay, getRoleBadgeStyle } from "@/src/lib/roleDisplay";
import {
  deriveClientWorkflowStages,
  ORDER_ACTIVE_WORKFLOW,
  assertValidTransition
} from "@/src/lib/orderWorkflow";
import { User, OrderStatus, PaymentStatus } from "@/src/types";

describe("ROLE AUTHORIZATION - Client Employee Roles", () => {
  const createUser = (employeeRole: any, status: any = "ACTIVE", tenantId = "tenant-1", clientId = "client-1"): User => ({
    id: `user-${employeeRole.toLowerCase()}`,
    name: `User ${employeeRole}`,
    email: `${employeeRole.toLowerCase()}@example.com`,
    role: "CLIENT",
    tenantId,
    clientId,
    status,
    clientEmployee: {
      id: `ce-${employeeRole.toLowerCase()}`,
      clientId,
      tenantId,
      contactPerson: `User ${employeeRole}`,
      mobile: "9876543210",
      email: `${employeeRole.toLowerCase()}@example.com`,
      employeeRole,
      status
    }
  });

  describe("MD (Managing Director)", () => {
    const md = createUser("MD");

    it("has delivery verify permission", () => {
      expect(canVerifyDelivery(md)).toBe(true);
      expect(hasClientPermission(md, "DELIVERY_VERIFY")).toBe(true);
    });

    it("has inventory verify permission", () => {
      expect(canVerifyInventory(md)).toBe(true);
      expect(hasClientPermission(md, "INVENTORY_VERIFY")).toBe(true);
    });

    it("has invoice and account access", () => {
      expect(canAccessAccounting(md)).toBe(true);
      expect(hasClientPermission(md, "INVOICES_VIEW")).toBe(true);
      expect(hasClientPermission(md, "ACCOUNTS_VIEW")).toBe(true);
    });

    it("can record payment and upload payment proof", () => {
      expect(canRecordPayment(md)).toBe(true);
      expect(canUploadPaymentProof(md)).toBe(true);
      expect(hasClientPermission(md, "PAYMENTS_RECORD")).toBe(true);
    });

    it("has full client workflow access", () => {
      expect(canViewOrders(md)).toBe(true);
      expect(hasClientPermission(md, "REPORTS_VIEW")).toBe(true);
    });
  });

  describe("GM (General Manager)", () => {
    const gm = createUser("GM");

    it("has same full workflow access as MD", () => {
      expect(canVerifyDelivery(gm)).toBe(true);
      expect(canVerifyInventory(gm)).toBe(true);
      expect(canAccessAccounting(gm)).toBe(true);
      expect(canRecordPayment(gm)).toBe(true);
      expect(canUploadPaymentProof(gm)).toBe(true);
      expect(canViewOrders(gm)).toBe(true);
    });
  });

  describe("MANAGER", () => {
    const manager = createUser("MANAGER");

    it("has same full workflow access as MD and GM", () => {
      expect(canVerifyDelivery(manager)).toBe(true);
      expect(canVerifyInventory(manager)).toBe(true);
      expect(canAccessAccounting(manager)).toBe(true);
      expect(canRecordPayment(manager)).toBe(true);
      expect(canUploadPaymentProof(manager)).toBe(true);
      expect(canViewOrders(manager)).toBe(true);
    });
  });

  describe("RECEIVER", () => {
    const receiver = createUser("RECEIVER");

    it("delivery verify succeeds", () => {
      expect(canVerifyDelivery(receiver)).toBe(true);
      expect(hasClientPermission(receiver, "DELIVERY_VERIFY")).toBe(true);
    });

    it("inventory verify rejected", () => {
      expect(canVerifyInventory(receiver)).toBe(false);
      expect(hasClientPermission(receiver, "INVENTORY_VERIFY")).toBe(false);
    });

    it("payment rejected", () => {
      expect(canRecordPayment(receiver)).toBe(false);
      expect(hasClientPermission(receiver, "PAYMENTS_RECORD")).toBe(false);
    });

    it("accounting access rejected", () => {
      expect(canAccessAccounting(receiver)).toBe(false);
      expect(hasClientPermission(receiver, "ACCOUNTS_VIEW")).toBe(false);
      expect(hasClientPermission(receiver, "INVOICES_VIEW")).toBe(false);
    });

    it("can view relevant orders for delivery verification", () => {
      expect(canViewOrders(receiver)).toBe(true);
    });
  });

  describe("STORE", () => {
    const store = createUser("STORE");

    it("inventory verify succeeds", () => {
      expect(canVerifyInventory(store)).toBe(true);
      expect(hasClientPermission(store, "INVENTORY_VERIFY")).toBe(true);
    });

    it("delivery verify rejected", () => {
      expect(canVerifyDelivery(store)).toBe(false);
      expect(hasClientPermission(store, "DELIVERY_VERIFY")).toBe(false);
    });

    it("payment rejected", () => {
      expect(canRecordPayment(store)).toBe(false);
      expect(hasClientPermission(store, "PAYMENTS_RECORD")).toBe(false);
    });

    it("accounting access rejected", () => {
      expect(canAccessAccounting(store)).toBe(false);
      expect(hasClientPermission(store, "ACCOUNTS_VIEW")).toBe(false);
      expect(hasClientPermission(store, "INVOICES_VIEW")).toBe(false);
    });

    it("can view relevant orders for store verification", () => {
      expect(canViewOrders(store)).toBe(true);
    });
  });

  describe("ACCOUNT", () => {
    const account = createUser("ACCOUNT");

    it("invoices and accounts accessible", () => {
      expect(canAccessAccounting(account)).toBe(true);
      expect(hasClientPermission(account, "INVOICES_VIEW")).toBe(true);
      expect(hasClientPermission(account, "ACCOUNTS_VIEW")).toBe(true);
    });

    it("payment succeeds", () => {
      expect(canRecordPayment(account)).toBe(true);
      expect(canUploadPaymentProof(account)).toBe(true);
      expect(hasClientPermission(account, "PAYMENTS_RECORD")).toBe(true);
      expect(hasClientPermission(account, "PAYMENT_PROOF_UPLOAD")).toBe(true);
    });

    it("delivery verify rejected", () => {
      expect(canVerifyDelivery(account)).toBe(false);
      expect(hasClientPermission(account, "DELIVERY_VERIFY")).toBe(false);
    });

    it("inventory verify rejected", () => {
      expect(canVerifyInventory(account)).toBe(false);
      expect(hasClientPermission(account, "INVENTORY_VERIFY")).toBe(false);
    });
  });
});

describe("SECURITY & ACTOR ISOLATION", () => {
  it("rejects inactive client employee from permissions", () => {
    const inactiveUser: User = {
      id: "u-inactive",
      name: "Inactive Receiver",
      email: "inactive@example.com",
      role: "CLIENT",
      status: "INACTIVE",
      tenantId: "tenant-1",
      clientId: "client-1",
      clientEmployee: {
        id: "ce-inactive",
        clientId: "client-1",
        tenantId: "tenant-1",
        contactPerson: "Inactive",
        mobile: "123",
        email: "inactive@example.com",
        employeeRole: "RECEIVER",
        status: "INACTIVE"
      }
    };

    expect(canVerifyDelivery(inactiveUser)).toBe(false);
    expect(hasClientPermission(inactiveUser, "DELIVERY_VERIFY")).toBe(false);
  });

  it("enforces tenant isolation across tenant IDs", () => {
    expect(canAccessTenant("WAREHOUSE_OWNER", "tenant-alpha", "tenant-alpha")).toBe(true);
    expect(canAccessTenant("WAREHOUSE_OWNER", "tenant-alpha", "tenant-beta")).toBe(false);
    expect(canAccessTenant("PLATFORM_ADMIN", null, "tenant-beta")).toBe(true);
  });
});

describe("ROLE DISPLAY", () => {
  it("displays CLIENT / <ROLE> for all valid client employee roles", () => {
    expect(getRoleDisplay("CLIENT", "MD")).toBe("CLIENT / MD");
    expect(getRoleDisplay("CLIENT", "GM")).toBe("CLIENT / GM");
    expect(getRoleDisplay("CLIENT", "MANAGER")).toBe("CLIENT / MANAGER");
    expect(getRoleDisplay("CLIENT", "STORE")).toBe("CLIENT / STORE");
    expect(getRoleDisplay("CLIENT", "RECEIVER")).toBe("CLIENT / RECEIVER");
    expect(getRoleDisplay("CLIENT", "ACCOUNT")).toBe("CLIENT / ACCOUNT");
  });

  it("displays CLIENT when employeeRole is not present", () => {
    expect(getRoleDisplay("CLIENT", null)).toBe("CLIENT");
  });

  it("displays CLIENT_ACCOUNTANT appropriately without employeeRole leakage", () => {
    expect(getRoleDisplay("CLIENT_ACCOUNTANT", null)).toBe("CLIENT / ACCOUNT");
  });

  it("does not use PRODUCT_RECEIVER in badge style or display", () => {
    const display = getRoleDisplay("CLIENT", "RECEIVER");
    expect(display).not.toContain("PRODUCT_RECEIVER");
    const style = getRoleBadgeStyle("CLIENT", "RECEIVER");
    expect(style).toBeDefined();
  });
});

describe("WORKFLOW & PAYMENT STATE SPECIFICATION", () => {
  it("OrderStatus enum strictly contains only valid operational statuses", () => {
    expect(ORDER_ACTIVE_WORKFLOW).toEqual([
      "ISSUED",
      "PROCESSING",
      "READY_FOR_DISPATCH",
      "DISPATCHED",
      "VERIFIED"
    ]);
    expect(ORDER_ACTIVE_WORKFLOW).not.toContain("PAID");
    expect(ORDER_ACTIVE_WORKFLOW).not.toContain("INVOICED");
  });

  it("verified delivery produces inventory-pending state", () => {
    const stages = deriveClientWorkflowStages(
      {
        status: "DISPATCHED",
        deliveryVerifiedAt: "2026-09-24T12:00:00Z",
        storeVerifiedAt: null
      },
      "UNPAID"
    );
    const delivery = stages.find((s) => s.id === "DELIVERY_VERIFIED");
    const inventory = stages.find((s) => s.id === "INVENTORY_VERIFIED");

    expect(delivery?.state).toBe("completed");
    expect(inventory?.state).toBe("current");
  });

  it("inventory verification produces PAYMENT_PENDING state", () => {
    const stages = deriveClientWorkflowStages(
      {
        status: "VERIFIED",
        deliveryVerifiedAt: "2026-09-24T12:00:00Z",
        storeVerifiedAt: "2026-09-24T13:00:00Z"
      },
      "PAYMENT_PENDING"
    );
    const inventory = stages.find((s) => s.id === "INVENTORY_VERIFIED");
    const payment = stages.find((s) => s.id === "PAYMENT_PENDING");

    expect(inventory?.state).toBe("completed");
    expect(payment?.state).toBe("current");
  });

  it("full payment produces PAID and settles invoice", () => {
    const stages = deriveClientWorkflowStages(
      {
        status: "VERIFIED",
        deliveryVerifiedAt: "2026-09-24T12:00:00Z",
        storeVerifiedAt: "2026-09-24T13:00:00Z"
      },
      "PAID"
    );
    const paid = stages.find((s) => s.id === "PAID");
    expect(paid?.state).toBe("completed");
  });

  it("unpaid invoice never displays PAID", () => {
    const stages = deriveClientWorkflowStages(
      {
        status: "DISPATCHED",
        deliveryVerifiedAt: null,
        storeVerifiedAt: null
      },
      "UNPAID"
    );
    const paid = stages.find((s) => s.id === "PAID");
    expect(paid?.state).not.toBe("completed");
    expect(paid?.state).toBe("pending");
  });
});
