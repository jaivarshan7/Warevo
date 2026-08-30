import { describe, expect, it } from "vitest";
import { OrderStatus } from "@prisma/client";
import { assertValidTransition } from "@/lib/order-workflow";
import { canAccessTenant, hasPermission } from "@/lib/rbac";
import { buildInitials, buildNotificationActionUrl, getRelativeTimeLabel } from "@/lib/notifications";
import { filterAuditLogs, summarizeAuditChange } from "@/lib/audit-log";
import { buildReportSummary } from "@/lib/reporting";

describe("RBAC and tenant isolation", () => {
  it("allows platform admins across tenants and blocks tenant users from other tenants", () => {
    expect(canAccessTenant("PLATFORM_ADMIN", null, "tenant-b")).toBe(true);
    expect(canAccessTenant("WAREHOUSE_OWNER", "tenant-a", "tenant-a")).toBe(true);
    expect(canAccessTenant("WAREHOUSE_OWNER", "tenant-a", "tenant-b")).toBe(false);
  });

  it("keeps staff out of accounting and user administration", () => {
    expect(hasPermission("WAREHOUSE_STAFF", "orders:operate")).toBe(true);
    expect(hasPermission("WAREHOUSE_STAFF", "payments:manage")).toBe(false);
    expect(hasPermission("WAREHOUSE_STAFF", "users:manage")).toBe(false);
  });
});

describe("notification helpers", () => {
  it("creates initials from user names reliably", () => {
    expect(buildInitials("Aisha Patel")).toBe("AP");
    expect(buildInitials("Riya")).toBe("R");
  });

  it("formats recent timestamps as human-friendly labels", () => {
    const recent = new Date(Date.now() - 2 * 60 * 1000);
    expect(getRelativeTimeLabel(recent)).toContain("minute");
  });

  it("builds the correct notification action URLs for bulk and single-item actions", () => {
    expect(buildNotificationActionUrl({ markAll: true })).toBe("/dashboard/notifications?markAll=1");
    expect(buildNotificationActionUrl({ id: "notif_123" })).toBe("/dashboard/notifications?markId=notif_123");
  });
});

describe("order state machine", () => {
  it("accepts configured forward transitions", () => {
    expect(() => assertValidTransition(OrderStatus.DISPATCHED, OrderStatus.RECEIVED)).not.toThrow();
  });

  it("rejects arbitrary jumps", () => {
    expect(() => assertValidTransition(OrderStatus.DRAFT, OrderStatus.INVOICED)).toThrow("Invalid order status transition");
  });
});

describe("audit log summaries", () => {
  it("creates a readable owner-facing change summary", () => {
    expect(summarizeAuditChange({
      action: "Changed order status",
      entity: "Order",
      previousValue: { status: "DISPATCHED" },
      newValue: { status: "RECEIVED" }
    })).toContain("Order");
    expect(summarizeAuditChange({
      action: "Recorded stock movement",
      entity: "Inventory",
      previousValue: { availableQuantity: 12 },
      newValue: { availableQuantity: 15, type: "RECEIPT" }
    })).toContain("Inventory");
  });

  it("filters audit entries by text, entity, and role", () => {
    const logs = [
      { id: "a", action: "Changed order status", entity: "Order", userRole: "WAREHOUSE_OWNER" },
      { id: "b", action: "Recorded stock movement", entity: "Inventory", userRole: "WAREHOUSE_STAFF" },
      { id: "c", action: "Generated final invoice", entity: "Invoice", userRole: "ACCOUNTANT" }
    ] as any[];

    expect(filterAuditLogs(logs, { query: "order", entity: "Order", role: "WAREHOUSE_OWNER" })).toHaveLength(1);
    expect(filterAuditLogs(logs, { query: "stock" })).toHaveLength(1);
    expect(filterAuditLogs(logs, { role: "WAREHOUSE_STAFF" })).toHaveLength(1);
  });
});

describe("report summary", () => {
  it("computes KPI totals for orders, revenue, verification, and low stock", () => {
    const summary = buildReportSummary(
      [
        { status: "VERIFIED", totalAmount: 100 },
        { status: "VERIFICATION_PENDING", totalAmount: 50 },
        { status: "COMPLETED", totalAmount: 200 }
      ] as any[],
      [
        { total: 275 },
        { total: 125 }
      ] as any[],
      [
        { inventory: [{ availableQuantity: 4 }], reorderLevel: 5 },
        { inventory: [{ availableQuantity: 9 }], reorderLevel: 10 }
      ] as any[]
    );

    expect(summary.totalRevenue).toBe(350);
    expect(summary.verificationPending).toBe(1);
    expect(summary.lowStockItems).toBe(2);
    expect(summary.completedOrders).toBe(1);
  });
});
