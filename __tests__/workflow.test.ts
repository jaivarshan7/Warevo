import { describe, expect, it } from "vitest";
import { OrderStatus } from "@prisma/client";
import { assertValidTransition } from "@/lib/order-workflow";
import { canAccessTenant, hasPermission } from "@/lib/rbac";

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

describe("order state machine", () => {
  it("accepts configured forward transitions", () => {
    expect(() => assertValidTransition(OrderStatus.DISPATCHED, OrderStatus.RECEIVED)).not.toThrow();
  });

  it("rejects arbitrary jumps", () => {
    expect(() => assertValidTransition(OrderStatus.DRAFT, OrderStatus.INVOICED)).toThrow("Invalid order status transition");
  });
});
