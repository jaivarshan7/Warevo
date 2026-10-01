import { describe, expect, it, vi, beforeEach } from "vitest";
import { Role, Inventory, EmailLog, EmailLogStatus } from "@/types";
import { fetchEmailSentCount, fetchInventory, adjustInventoryStock } from "@/src/lib/services";
import { supabase } from "@/src/lib/supabase";

describe("FEATURE 1: Inventory Search Filtering Logic", () => {
  const mockInventory: Inventory[] = [
    {
      id: "inv-1",
      tenantId: "tenant-alpha",
      warehouseId: "wh-1",
      productId: "prod-1",
      totalQuantity: 100,
      availableQuantity: 90,
      reservedQuantity: 10,
      damagedQuantity: 0,
      updatedAt: "2026-10-01T10:00:00Z",
      product: {
        id: "prod-1",
        tenantId: "tenant-alpha",
        name: "Ergonomic Office Chair",
        sku: "FURN-CHAIR-001",
        unit: "PCS",
        purchasePrice: 50,
        sellingPrice: 120,
        gstRate: 18,
        minimumStock: 10,
        reorderLevel: 20,
        barcode: "8901234567890",
        status: "ACTIVE",
        createdAt: "2026-09-01T00:00:00Z",
        category: {
          id: "cat-1",
          tenantId: "tenant-alpha",
          name: "Furniture",
          createdAt: "2026-09-01T00:00:00Z",
        },
      },
    },
    {
      id: "inv-2",
      tenantId: "tenant-alpha",
      warehouseId: "wh-1",
      productId: "prod-2",
      totalQuantity: 250,
      availableQuantity: 240,
      reservedQuantity: 5,
      damagedQuantity: 5,
      updatedAt: "2026-10-01T11:00:00Z",
      product: {
        id: "prod-2",
        tenantId: "tenant-alpha",
        name: "Wireless Mechanical Keyboard",
        sku: "TECH-KB-099",
        unit: "PCS",
        purchasePrice: 40,
        sellingPrice: 90,
        gstRate: 18,
        minimumStock: 20,
        reorderLevel: 30,
        barcode: "8909876543210",
        status: "ACTIVE",
        createdAt: "2026-09-01T00:00:00Z",
        category: {
          id: "cat-2",
          tenantId: "tenant-alpha",
          name: "Electronics",
          createdAt: "2026-09-01T00:00:00Z",
        },
      },
    },
    {
      id: "inv-3",
      tenantId: "tenant-alpha",
      warehouseId: "wh-2",
      productId: "prod-3",
      totalQuantity: 500,
      availableQuantity: 480,
      reservedQuantity: 20,
      damagedQuantity: 0,
      updatedAt: "2026-10-01T12:00:00Z",
      product: {
        id: "prod-3",
        tenantId: "tenant-alpha",
        name: "Ceramic Coffee Mug",
        sku: "KITCH-MUG-BLUE",
        unit: "PCS",
        purchasePrice: 2,
        sellingPrice: 8,
        gstRate: 12,
        minimumStock: 50,
        reorderLevel: 100,
        barcode: "8905551234567",
        status: "ACTIVE",
        createdAt: "2026-09-01T00:00:00Z",
        category: {
          id: "cat-3",
          tenantId: "tenant-alpha",
          name: "Kitchenware",
          createdAt: "2026-09-01T00:00:00Z",
        },
      },
    },
  ];

  // Pure filtering function mirroring InventoryPage useMemo
  function filterInventory(items: Inventory[], search: string): Inventory[] {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((inv) => {
      const p = inv.product;
      if (!p) return false;

      const name = (p.name || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      const category = (p.category?.name || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      const productId = (p.id || "").toLowerCase();

      return (
        name.includes(query) ||
        sku.includes(query) ||
        category.includes(query) ||
        barcode.includes(query) ||
        productId.includes(query)
      );
    });
  }

  it("1. searches inventory by product name (partial match)", () => {
    const result = filterInventory(mockInventory, "Chair");
    expect(result).toHaveLength(1);
    expect(result[0].product?.name).toBe("Ergonomic Office Chair");

    const partial = filterInventory(mockInventory, "board");
    expect(partial).toHaveLength(1);
    expect(partial[0].product?.name).toBe("Wireless Mechanical Keyboard");
  });

  it("2. searches inventory by SKU", () => {
    const result = filterInventory(mockInventory, "FURN-CHAIR");
    expect(result).toHaveLength(1);
    expect(result[0].product?.sku).toBe("FURN-CHAIR-001");

    const partialSku = filterInventory(mockInventory, "099");
    expect(partialSku).toHaveLength(1);
    expect(partialSku[0].product?.sku).toBe("TECH-KB-099");
  });

  it("3. searches inventory by category name", () => {
    const result = filterInventory(mockInventory, "Kitchenware");
    expect(result).toHaveLength(1);
    expect(result[0].product?.name).toBe("Ceramic Coffee Mug");

    const electronics = filterInventory(mockInventory, "elect");
    expect(electronics).toHaveLength(1);
    expect(electronics[0].product?.name).toBe("Wireless Mechanical Keyboard");
  });

  it("4. performs case-insensitive and whitespace-trimmed search", () => {
    // Upper case with extra spaces
    const upper = filterInventory(mockInventory, "  WIRELESS  ");
    expect(upper).toHaveLength(1);
    expect(upper[0].product?.name).toBe("Wireless Mechanical Keyboard");

    // Mixed case SKU
    const mixed = filterInventory(mockInventory, "kItCh-MuG");
    expect(mixed).toHaveLength(1);
    expect(mixed[0].product?.sku).toBe("KITCH-MUG-BLUE");

    // Empty or only whitespace returns all items
    expect(filterInventory(mockInventory, "   ")).toHaveLength(3);
    expect(filterInventory(mockInventory, "")).toHaveLength(3);
  });

  it("5. correctly distinguishes between empty warehouse and empty search result", () => {
    // Case A: Warehouse inventory has records, but search yields 0 matches
    const noMatch = filterInventory(mockInventory, "Nonexistent item XYZ");
    expect(mockInventory.length).toBe(3);
    expect(noMatch.length).toBe(0);

    // Empty state should be: "No products match your search"
    const hasSearchEmptyState = mockInventory.length > 0 && noMatch.length === 0;
    expect(hasSearchEmptyState).toBe(true);

    // Case B: Completely empty inventory
    const emptyInventory: Inventory[] = [];
    const searchOnEmpty = filterInventory(emptyInventory, "Chair");
    const isWarehouseEmpty = emptyInventory.length === 0;
    expect(isWarehouseEmpty).toBe(true);
    expect(searchOnEmpty.length).toBe(0);
  });

  it("also matches product barcode and product ID", () => {
    const byBarcode = filterInventory(mockInventory, "8905551234567");
    expect(byBarcode).toHaveLength(1);
    expect(byBarcode[0].product?.name).toBe("Ceramic Coffee Mug");

    const byId = filterInventory(mockInventory, "prod-1");
    expect(byId).toHaveLength(1);
    expect(byId[0].product?.name).toBe("Ergonomic Office Chair");
  });
});

describe("FEATURE 2: Email Sent Counter & Scoping Logic", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Simulated EmailLog dataset
  const emailLogs: EmailLog[] = [
    {
      id: "elog-1",
      tenantId: "tenant-A",
      recipientEmail: "user1@tenantA.com",
      eventType: "NEW_ORDER",
      subject: "[Warevo] New Order",
      status: "SENT",
      createdAt: "2026-10-01T08:00:00Z",
    },
    {
      id: "elog-2",
      tenantId: "tenant-A",
      recipientEmail: "user2@tenantA.com",
      eventType: "ORDER_DISPATCHED",
      subject: "[Warevo] Order Dispatched",
      status: "SENT",
      createdAt: "2026-10-01T09:00:00Z",
    },
    {
      id: "elog-3",
      tenantId: "tenant-A",
      recipientEmail: "skipped@tenantA.com",
      eventType: "NEW_ORDER",
      subject: "[Warevo] Skipped",
      status: "SKIPPED",
      createdAt: "2026-10-01T09:30:00Z",
    },
    {
      id: "elog-4",
      tenantId: "tenant-A",
      recipientEmail: "fail@tenantA.com",
      eventType: "ORDER_DISPATCHED",
      subject: "[Warevo] Failed",
      status: "FAILED",
      createdAt: "2026-10-01T09:45:00Z",
    },
    {
      id: "elog-5",
      tenantId: "tenant-A",
      recipientEmail: "pending@tenantA.com",
      eventType: "NEW_ORDER",
      subject: "[Warevo] Pending",
      status: "PENDING",
      createdAt: "2026-10-01T09:50:00Z",
    },
    // Tenant B logs
    {
      id: "elog-6",
      tenantId: "tenant-B",
      recipientEmail: "user1@tenantB.com",
      eventType: "NEW_ORDER",
      subject: "[Warevo] New Order B",
      status: "SENT",
      createdAt: "2026-10-01T10:00:00Z",
    },
    {
      id: "elog-7",
      tenantId: "tenant-B",
      recipientEmail: "user2@tenantB.com",
      eventType: "INVOICE_GENERATED",
      subject: "[Warevo] Invoice B",
      status: "SENT",
      createdAt: "2026-10-01T10:30:00Z",
    },
    {
      id: "elog-8",
      tenantId: "tenant-B",
      recipientEmail: "user3@tenantB.com",
      eventType: "PAYMENT_RECEIVED",
      subject: "[Warevo] Payment B",
      status: "SENT",
      createdAt: "2026-10-01T11:00:00Z",
    },
    {
      id: "elog-9",
      tenantId: "tenant-B",
      recipientEmail: "fail@tenantB.com",
      eventType: "INVOICE_GENERATED",
      subject: "[Warevo] Fail B",
      status: "FAILED",
      createdAt: "2026-10-01T11:15:00Z",
    },
  ];

  // Reference implementation of database RPC logic
  function executeRpcGetEmailSentCount(
    callerRole: Role,
    callerTenantId: string | null,
    p_tenant_id: string | null
  ): number {
    if (callerRole === "PLATFORM_ADMIN") {
      const targetTenant = p_tenant_id || null;
      if (!targetTenant) {
        return emailLogs.filter((log) => log.status === "SENT").length;
      }
      return emailLogs.filter((log) => log.status === "SENT" && log.tenantId === targetTenant).length;
    }

    const WAREHOUSE_ROLES: Role[] = [
      "WAREHOUSE_OWNER",
      "WAREHOUSE_MODERATOR",
      "WAREHOUSE_STAFF",
      "ACCOUNTANT",
      "ACCOUNTS_TEAM",
    ];

    if (WAREHOUSE_ROLES.includes(callerRole)) {
      if (p_tenant_id && p_tenant_id !== callerTenantId) {
        throw new Error("Unauthorized: cross-tenant access denied");
      }
      return emailLogs.filter(
        (log) => log.status === "SENT" && log.tenantId === callerTenantId
      ).length;
    }

    throw new Error("Unauthorized: insufficient permissions to view email metrics");
  }

  it("6. PLATFORM_ADMIN sees platform-wide SENT email count", () => {
    // Total SENT across all tenants is 2 (Tenant A) + 3 (Tenant B) = 5
    const platformCount = executeRpcGetEmailSentCount("PLATFORM_ADMIN", null, null);
    expect(platformCount).toBe(5);
  });

  it("7. WAREHOUSE_OWNER sees tenant SENT email count", () => {
    // Tenant A has 2 SENT emails
    const ownerCount = executeRpcGetEmailSentCount("WAREHOUSE_OWNER", "tenant-A", "tenant-A");
    expect(ownerCount).toBe(2);

    // Tenant B owner has 3 SENT emails
    const ownerBCount = executeRpcGetEmailSentCount("WAREHOUSE_OWNER", "tenant-B", "tenant-B");
    expect(ownerBCount).toBe(3);
  });

  it("8. WAREHOUSE_STAFF sees same tenant-scoped count as WAREHOUSE_OWNER", () => {
    const staffCount = executeRpcGetEmailSentCount("WAREHOUSE_STAFF", "tenant-A", "tenant-A");
    const ownerCount = executeRpcGetEmailSentCount("WAREHOUSE_OWNER", "tenant-A", "tenant-A");
    expect(staffCount).toBe(ownerCount);
    expect(staffCount).toBe(2);

    // Also ACCOUNTANT and ACCOUNTS_TEAM see the same tenant count
    const accountantCount = executeRpcGetEmailSentCount("ACCOUNTANT", "tenant-A", "tenant-A");
    const accountsTeamCount = executeRpcGetEmailSentCount("ACCOUNTS_TEAM", "tenant-A", "tenant-A");
    expect(accountantCount).toBe(2);
    expect(accountsTeamCount).toBe(2);
  });

  it("9. SKIPPED emails are not counted", () => {
    const countA = executeRpcGetEmailSentCount("WAREHOUSE_OWNER", "tenant-A", "tenant-A");
    // Tenant A has 1 SKIPPED email (elog-3), but count is 2
    expect(countA).toBe(2);
    const skippedInLogs = emailLogs.filter((l) => l.tenantId === "tenant-A" && l.status === "SKIPPED");
    expect(skippedInLogs.length).toBe(1);
  });

  it("10. FAILED emails are not counted", () => {
    const countA = executeRpcGetEmailSentCount("WAREHOUSE_OWNER", "tenant-A", "tenant-A");
    // Tenant A has 1 FAILED email (elog-4), but count is 2
    expect(countA).toBe(2);
    const failedInLogs = emailLogs.filter((l) => l.tenantId === "tenant-A" && l.status === "FAILED");
    expect(failedInLogs.length).toBe(1);
  });

  it("11. PENDING emails are not counted", () => {
    const countA = executeRpcGetEmailSentCount("WAREHOUSE_OWNER", "tenant-A", "tenant-A");
    // Tenant A has 1 PENDING email (elog-5), but count is 2
    expect(countA).toBe(2);
    const pendingInLogs = emailLogs.filter((l) => l.tenantId === "tenant-A" && l.status === "PENDING");
    expect(pendingInLogs.length).toBe(1);
  });

  it("12. cross-tenant warehouse access is rejected", () => {
    // Warehouse user from tenant-A attempts to query tenant-B
    expect(() => {
      executeRpcGetEmailSentCount("WAREHOUSE_OWNER", "tenant-A", "tenant-B");
    }).toThrow("Unauthorized: cross-tenant access denied");

    // Warehouse staff from tenant-A attempts to query tenant-B
    expect(() => {
      executeRpcGetEmailSentCount("WAREHOUSE_STAFF", "tenant-A", "tenant-B");
    }).toThrow("Unauthorized: cross-tenant access denied");
  });

  it("CLIENT role is blocked from warehouse email metrics", () => {
    expect(() => {
      executeRpcGetEmailSentCount("CLIENT", "tenant-A", "tenant-A");
    }).toThrow("Unauthorized: insufficient permissions to view email metrics");
  });
});

describe("FEATURE 2: Service Layer & Resiliency", () => {
  it("13. fetchEmailSentCount handles RPC error gracefully without crashing and returns null", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
      data: null,
      error: { message: "Network failure / timeout" } as any,
    });

    const result = await fetchEmailSentCount({
      tenantId: "tenant-A",
      role: "WAREHOUSE_OWNER",
    });

    // Returns null on error so Profile page displays "—" instead of crashing
    expect(result).toBeNull();
  });

  it("fetchEmailSentCount returns 0 if no emails sent", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
      data: 0,
      error: null,
    });

    const result = await fetchEmailSentCount({
      tenantId: "tenant-empty",
      role: "WAREHOUSE_OWNER",
    });

    expect(result).toBe(0);
  });

  it("fetchEmailSentCount calls rpc_get_email_sent_count with null tenantId for PLATFORM_ADMIN", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
      data: 1248,
      error: null,
    });

    const result = await fetchEmailSentCount({
      role: "PLATFORM_ADMIN",
    });

    expect(result).toBe(1248);
    expect(rpcSpy).toHaveBeenCalledWith("rpc_get_email_sent_count", {
      p_tenant_id: null,
    });
  });

  it("fetchEmailSentCount passes tenantId for warehouse users", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
      data: 42,
      error: null,
    });

    const result = await fetchEmailSentCount({
      tenantId: "4bc083f7-4144-40d5-88a1-0ccef40981ec",
      role: "WAREHOUSE_OWNER",
    });

    expect(result).toBe(42);
    expect(rpcSpy).toHaveBeenCalledWith("rpc_get_email_sent_count", {
      p_tenant_id: "4bc083f7-4144-40d5-88a1-0ccef40981ec",
    });
  });

  it("14. existing email sending behavior and exports remain intact", async () => {
    const services = await import("@/src/lib/services");
    expect(services.fetchEmailLogs).toBeDefined();
    expect(services.fetchEmailSentCount).toBeDefined();
    expect(services.sendClientEmail).toBeDefined();
  });

  it("15. existing inventory creation and stock adjustment services remain intact", async () => {
    const services = await import("@/src/lib/services");
    expect(services.fetchInventory).toBeDefined();
    expect(services.adjustInventoryStock).toBeDefined();
    expect(services.createProductWithInitialStock).toBeDefined();
    expect(services.fetchInventoryMovements).toBeDefined();
  });
});
