import { describe, expect, it, vi, beforeEach } from "vitest";
import { OrderStatus } from "@prisma/client";

const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

const updateManyMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      updateMany: updateManyMock,
      update: updateMock,
    },
  },
}));
import { assertValidTransition } from "@/lib/order-workflow";
import { canAccessDashboardRoute, canAccessTenant, hasPermission } from "@/lib/rbac";
import { buildInitials, buildNotificationActionUrl, getRelativeTimeLabel } from "@/lib/notifications";
import { filterAuditLogs, summarizeAuditChange } from "@/lib/audit-log";
import { buildReportSummary } from "@/lib/reporting";
import { normalizeSelectedContactIds, resolvePrimaryClientId } from "@/lib/order-contacts";
import { parseInvoiceText, samplePureAuraInvoice } from "@/lib/invoice-parser";
import { extractTextFromPdf } from "@/lib/pdf-text-extractor";

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

  it("limits dashboard routes by role", () => {
    expect(canAccessDashboardRoute("PRODUCT_RECEIVER", "/dashboard/orders/track")).toBe(true);
    expect(canAccessDashboardRoute("PRODUCT_RECEIVER", "/dashboard/orders")).toBe(false);
    expect(canAccessDashboardRoute("CLIENT", "/dashboard", "RECEIVER")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT", "/dashboard/orders/track", "RECEIVER")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT", "/dashboard/orders", "RECEIVER")).toBe(false);
    expect(canAccessDashboardRoute("CLIENT", "/dashboard/accounting", "RECEIVER")).toBe(false);
    expect(canAccessDashboardRoute("WAREHOUSE_STAFF", "/dashboard/orders")).toBe(true);
    expect(canAccessDashboardRoute("WAREHOUSE_STAFF", "/dashboard/orders/track")).toBe(true);
    expect(canAccessDashboardRoute("WAREHOUSE_STAFF", "/dashboard/inventory")).toBe(false);
    expect(canAccessDashboardRoute("CLIENT_ACCOUNTANT", "/dashboard/accounting")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT_ACCOUNTANT", "/dashboard/orders")).toBe(false);
  });
});

describe("notification helpers", () => {
  beforeEach(() => {
    revalidatePathMock.mockClear();
    updateManyMock.mockReset();
    updateMock.mockReset();
  });

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

  it("marks notifications as read without triggering revalidatePath during render", async () => {
    updateManyMock.mockResolvedValue({ count: 2 });
    const { markAllNotificationsAsRead } = await import("@/lib/notifications-server");

    await markAllNotificationsAsRead({ id: "user-1", role: "WAREHOUSE_OWNER", tenantId: "tenant-1" });

    expect(updateManyMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).not.toHaveBeenCalled();
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

describe("multi-contact order selection", () => {
  it("normalizes and prioritizes selected client contacts for a single order", () => {
    expect(normalizeSelectedContactIds(["c1", "c2", "c1", "", "NEW", null])).toEqual(["c1", "c2"]);
    expect(resolvePrimaryClientId(["c2", "c1"])).toBe("c2");
    expect(resolvePrimaryClientId([], "fallback")).toBe("fallback");
  });
});

describe("invoice parser", () => {
  it("does not turn binary PDF text into bogus line items", () => {
    const parsed = parseInvoiceText("%PDF-1.7\n\u0000\u0001\uFFFD\uFFFD\uFFFD;x;y\nstream random binary endstream", "uploaded.pdf");

    expect(parsed.items).toEqual([]);
    expect(parsed.notes).toContain("Unable to extract readable text");
  });

  it("parses delimited invoice product rows with numeric quantities and prices", () => {
    const parsed = parseInvoiceText(
      [
        "Invoice No: INV-42",
        "Date: 02-09-2026",
        "Bill To: Acme Stores",
        "Phone: +91 98765 43210",
        "GSTIN: 33AAYFP5618B1Z4",
        "Floor Cleaner;3402;12;95.50;18",
      ].join("\n"),
      "items.csv"
    );

    expect(parsed.invoiceNumber).toBe("INV-42");
    expect(parsed.invoiceDate).toBe("2026-09-02");
    expect(parsed.clientName).toBe("Acme Stores");
    expect(parsed.items).toEqual([
      {
        name: "Floor Cleaner",
        sku: "HSN-3402",
        hsn: "3402",
        quantity: 12,
        unit: "pcs",
        unitPrice: 95.5,
        gstRate: 18,
      },
    ]);
  });

  it("keeps the curated Pure Aura sample explicit", () => {
    expect(parseInvoiceText("PURE AURA TAX INVOICE 2324", "anything.pdf")).toBe(samplePureAuraInvoice);
  });

  it("parses Pure Aura PDF text exported as vertical invoice table rows", () => {
    const parsed = parseInvoiceText(
      [
        "PURE AURA ENTERPRISES",
        "Bill To",
        "ST ANTONY'S RESIDENCY",
        "3 SIPCOT INDUSTRIAL GROWTH CENTRE GANGAIKONDAN",
        "Contact No.: 96263 81177",
        "GSTIN Number: 33AIHPA6467A2ZQ",
        "State: 33-Tamil Nadu",
        "Invoice Details",
        "Invoice No.: 2399",
        "Date: 28-08-2026",
        "#",
        "Item Name",
        "HSN",
        "MRP",
        "Quantity",
        "Unit",
        "Price/",
        "Unit",
        "CGST",
        "SGST",
        "Amount",
        "1",
        "INRD0171 Iris Reed",
        "Diffuser Oil -",
        "Aluminium can - 1 litre",
        "- Lemon Grass",
        "330749",
        "00",
        "2499.00",
        "2",
        "Nos",
        "\u20b9",
        "1,508.48",
        "(9.0%)",
        "(9.0%)",
        "2",
        "Wooden Stirrer - 140",
        "mm",
        "(500 pcs /packet)",
        "4419",
        "2",
        "Pac",
        "\u20b9 80.00",
        "(2.5%)",
        "(2.5%)",
        "Total",
        "4",
      ].join("\n"),
      "ST ANTONY S RESIDENCY_2399_28-08-2026_Original.pdf"
    );

    expect(parsed.invoiceNumber).toBe("2399");
    expect(parsed.invoiceDate).toBe("2026-08-28");
    expect(parsed.clientName).toBe("ST ANTONY'S RESIDENCY");
    expect(parsed.clientMobile).toBe("96263 81177");
    expect(parsed.clientGstin).toBe("33AIHPA6467A2ZQ");
    expect(parsed.items).toEqual([
      expect.objectContaining({
        name: "INRD0171 Iris Reed Diffuser Oil - Aluminium can - 1 litre - Lemon Grass",
        hsn: "33074900",
        quantity: 2,
        unit: "Nos",
        unitPrice: 1508.48,
        gstRate: 18,
      }),
      expect.objectContaining({
        name: "Wooden Stirrer - 140 mm (500 pcs /packet)",
        hsn: "4419",
        quantity: 2,
        unit: "Pac",
        unitPrice: 80,
        gstRate: 5,
      }),
    ]);
  });
});

describe("pdf text extractor", () => {
  it("decodes hex glyphs through a ToUnicode CMap", () => {
    const pdf = [
      "%PDF-1.4",
      "1 0 obj",
      "<</Type /Font /ToUnicode 2 0 R>>",
      "endobj",
      "2 0 obj",
      "<<>> stream",
      "/CIDInit /ProcSet findresource begin",
      "begincmap",
      "2 beginbfchar",
      "<01> <0048>",
      "<02> <0069>",
      "endbfchar",
      "endcmap",
      "end",
      "endstream",
      "endobj",
      "3 0 obj",
      "<</Resources <</Font <</F4 1 0 R>>>>>>",
      "endobj",
      "4 0 obj",
      "<<>> stream",
      "BT",
      "/F4 10 Tf",
      "1 0 0 -1 10 10 Tm",
      "<0102> Tj",
      "ET",
      "endstream",
      "endobj",
    ].join("\n");

    expect(extractTextFromPdf(Buffer.from(pdf, "latin1"))).toBe("Hi");
  });
});
