import { describe, expect, it } from "vitest";
import { OrderStatus, PaymentStatus } from "@/src/types";
import { assertValidTransition, deriveClientWorkflowStages, ORDER_ACTIVE_WORKFLOW } from "@/src/lib/orderWorkflow";
import { canAccessRoute as canAccessDashboardRoute, canAccessTenant, hasPermission, hasClientPermission, canVerifyDelivery, canVerifyInventory, canRecordPayment } from "@/src/lib/permissions";
import { parseInvoiceText as parseReactInvoiceText } from "@/src/lib/invoiceParser";

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

  it("limits dashboard routes by role and client employee role", () => {
    expect(canAccessDashboardRoute("CLIENT", "/dashboard", "RECEIVER")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT", "/operations/orders", "RECEIVER")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT", "/accounting", "RECEIVER")).toBe(false);

    expect(canAccessDashboardRoute("CLIENT", "/dashboard", "STORE")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT", "/operations/orders", "STORE")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT", "/accounting", "STORE")).toBe(false);

    expect(canAccessDashboardRoute("CLIENT", "/dashboard", "ACCOUNT")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT", "/accounting", "ACCOUNT")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT", "/operations/orders", "ACCOUNT")).toBe(false);

    expect(canAccessDashboardRoute("CLIENT", "/dashboard", "MANAGER")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT", "/operations/orders", "MANAGER")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT", "/accounting", "MANAGER")).toBe(true);

    expect(canAccessDashboardRoute("WAREHOUSE_STAFF", "/operations/orders")).toBe(true);
    expect(canAccessDashboardRoute("WAREHOUSE_STAFF", "/accounting")).toBe(false);
    expect(canAccessDashboardRoute("CLIENT_ACCOUNTANT", "/accounting")).toBe(true);
    expect(canAccessDashboardRoute("CLIENT_ACCOUNTANT", "/operations/orders")).toBe(false);
  });
});

describe("order state machine", () => {
  it("defines active OrderStatus workflow strictly without PAID", () => {
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

  it("accepts configured forward transitions", () => {
    expect(() => assertValidTransition("ISSUED" as OrderStatus, "PROCESSING" as OrderStatus)).not.toThrow();
    expect(() => assertValidTransition("PROCESSING" as OrderStatus, "READY_FOR_DISPATCH" as OrderStatus)).not.toThrow();
    expect(() => assertValidTransition("READY_FOR_DISPATCH" as OrderStatus, "DISPATCHED" as OrderStatus)).not.toThrow();
  });

  it("rejects arbitrary jumps", () => {
    expect(() => assertValidTransition("DRAFT" as OrderStatus, "INVOICED" as OrderStatus)).toThrow("Invalid order status transition");
  });
});

describe("client workflow stages", () => {
  it("derives correct 8-step workflow progression from DISPATCHED to PAID", () => {
    // 1. Order dispatched, pending delivery verification
    const orderDispatched = {
      status: "DISPATCHED" as OrderStatus,
      verificationStatus: "PENDING" as any,
      deliveryVerifiedAt: null,
      storeVerifiedAt: null
    };
    const stages1 = deriveClientWorkflowStages(orderDispatched, "UNPAID");
    const deliveryStage1 = stages1.find((s) => s.id === "DELIVERY_VERIFIED");
    const storeStage1 = stages1.find((s) => s.id === "INVENTORY_VERIFIED");
    const paymentStage1 = stages1.find((s) => s.id === "PAID");

    expect(deliveryStage1?.state).toBe("current");
    expect(storeStage1?.state).toBe("pending");
    expect(paymentStage1?.state).toBe("pending");

    // 2. Delivery verified, store pending
    const orderDeliveryVerified = {
      status: "DISPATCHED" as OrderStatus,
      verificationStatus: "VERIFIED" as any,
      deliveryVerifiedAt: "2026-09-24T10:00:00Z",
      storeVerifiedAt: null
    };
    const stages2 = deriveClientWorkflowStages(orderDeliveryVerified, "UNPAID");
    const deliveryStage2 = stages2.find((s) => s.id === "DELIVERY_VERIFIED");
    const storeStage2 = stages2.find((s) => s.id === "INVENTORY_VERIFIED");
    expect(deliveryStage2?.state).toBe("completed");
    expect(storeStage2?.state).toBe("current");

    // 3. Store verified, payment pending
    const orderStoreVerified = {
      status: "VERIFIED" as OrderStatus,
      verificationStatus: "VERIFIED" as any,
      deliveryVerifiedAt: "2026-09-24T10:00:00Z",
      storeVerifiedAt: "2026-09-24T11:00:00Z"
    };
    const stages3 = deriveClientWorkflowStages(orderStoreVerified, "PAYMENT_PENDING");
    const paymentPendingStage = stages3.find((s) => s.id === "PAYMENT_PENDING");
    const paidStage3 = stages3.find((s) => s.id === "PAID");
    expect(paymentPendingStage?.state).toBe("current");
    expect(paidStage3?.state).toBe("pending");

    // 4. Fully settled
    const stages4 = deriveClientWorkflowStages(orderStoreVerified, "PAID");
    const paidStage4 = stages4.find((s) => s.id === "PAID");
    expect(paidStage4?.state).toBe("completed");
  });
});

describe("invoice parser", () => {
  it("extracts products from the flattened Pure Aura PDF layout", () => {
    const parsed = parseReactInvoiceText([
      "Tax Invoice PURE AURA ENTERPRISES",
      "Bill To PSS Multiplex - Tenkasi 510 RAILWAY FEEDER ROAD TENKASI",
      "Contact No. : 9344890042 GSTIN : 33AAYFP5618B1Z4",
      "Invoice Details Invoice No. : 2324 Date : 17-08-2026",
      "# Item Name HSN Quantity Unit Price/ Unit",
      "1 Acid - HCL - 1 Liter 2907122 0 10 Btl ₹ 42.37 ₹ 42.37",
      "2 Hand wash Dispenser 3924909 0 5 Pcs ₹ 180.00 ₹ 180.00",
      "3 Wooden Stirrer - 110 mm (450pcs/packet) 4419 30 Pac ₹ 60.00 ₹ 60.00",
      "Total 145",
      "For: PURE AURA ENTERPRISES Authorized Signatory"
    ].join(" "));

    expect(parsed.items).toHaveLength(3);
    expect(parsed.items[0]).toMatchObject({ name: "Acid - HCL - 1 Liter", quantity: 10, unitPrice: 42.37, hsn: "29071220" });
    expect(parsed.items[2]).toMatchObject({ name: "Wooden Stirrer - 110 mm (450pcs/packet)", quantity: 30, unitPrice: 60 });
  });

  it("extracts flattened GST invoice rows with numeric item names", () => {
    const text = [
      "Invoice No.: 2438 Date: 29-08-2026 Bill To SRI KAUVERY MEDICAL CARE",
      "# Item Name HSN Quantity Unit Price/ Unit Taxable Price/ Unit Taxable Amount CGST SGST Final Rate Amount",
      "1 Carbon Sheet 100 Pcs ₹ 2.00 ₹ 2.00 ₹ 200.00 ₹ 18.00 (9.0%) ₹ 18.00 (9.0%) ₹ 2.36 ₹ 236.00",
      "2 Cello Tape - 1 inch - Brown 10 Pcs ₹ 22.00 ₹ 22.00 ₹ 220.00 ₹ 19.80 (9.0%) ₹ 19.80 (9.0%) ₹ 25.96 ₹ 259.60",
      "3 Packing Tape - 1 inch - Transparent 15 Pcs ₹ 22.00 ₹ 22.00 ₹ 330.00 ₹ 29.70 (9.0%) ₹ 29.70 (9.0%) ₹ 25.96 ₹ 389.40",
      "4 Cello Tape - 2 inch - Brown 40 Pcs ₹ 30.00 ₹ 30.00 ₹ 1,200.00 ₹ 108.00 (9.0%) ₹ 108.00 (9.0%) ₹ 35.40 ₹ 1,416.00",
      "5 Fevi Stick (8 Gms) 15 Pcs ₹ 20.00 ₹ 20.00 ₹ 300.00 ₹ 27.00 (9.0%) ₹ 27.00 (9.0%) ₹ 23.60 ₹ 354.00",
      "6 Blue Pen (Elkos Branded) 300 Pcs ₹ 4.80 ₹ 4.80 ₹ 1,440.00 ₹ 129.60 (9.0%) ₹ 129.60 (9.0%) ₹ 5.66 ₹ 1,699.20",
      "7 stapler Pin - Small 50 Pcs ₹ 6.50 ₹ 6.50 ₹ 325.00 ₹ 29.25 (9.0%) ₹ 29.25 (9.0%) ₹ 7.67 ₹ 383.50",
      "Total 530 ₹ 4,015.00 ₹ 361.35 ₹ 361.35 ₹ 4,737.70",
    ].join(" ");

    const parsed = parseReactInvoiceText(text);
    expect(parsed.items).toHaveLength(7);
    expect(parsed.items[1]).toMatchObject({ name: "Cello Tape - 1 inch - Brown", quantity: 10, unitPrice: 22, gstRate: 18 });
    expect(parsed.items[5]).toMatchObject({ name: "Blue Pen (Elkos Branded)", quantity: 300, unitPrice: 4.8 });
  });
});
