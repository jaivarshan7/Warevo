import { describe, expect, it } from "vitest";
import { getRoleDisplay, getRoleBadgeStyle } from "@/src/lib/roleDisplay";
import { orderStatusBadgeStyles } from "@/src/lib/orderWorkflow";
import { OrderTimelineEvent } from "@/src/types";

describe("Order Status Display & Badges", () => {
  it("formats order status without underscores", () => {
    const formatText = (text: string, type: string = "order", label?: string) => {
      if (label) return label;
      if (type === "order" && text === "VERIFIED") {
        return "INVENTORY VERIFIED";
      }
      return text.replace(/_/g, " ");
    };

    expect(formatText("ISSUED")).toBe("ISSUED");
    expect(formatText("READY_FOR_DISPATCH")).toBe("READY FOR DISPATCH");
    expect(formatText("DISPATCHED")).toBe("DISPATCHED");
    expect(formatText("VERIFIED")).toBe("INVENTORY VERIFIED");
    expect(formatText("VERIFIED", "order", "VERIFIED")).toBe("VERIFIED");
  });

  it("provides distinct badge styling for all stages", () => {
    expect(orderStatusBadgeStyles["ISSUED"]).toContain("text-blue-300");
    expect(orderStatusBadgeStyles["PROCESSING"]).toContain("text-amber-300");
    expect(orderStatusBadgeStyles["READY_FOR_DISPATCH"]).toContain("text-purple-300");
    expect(orderStatusBadgeStyles["DISPATCHED"]).toContain("text-indigo-300");
    expect(orderStatusBadgeStyles["VERIFIED"]).toContain("text-emerald-300");
  });
});

describe("Timeline Actor & Role Resolution", () => {
  it("displays client employee roles with granular prefix", () => {
    expect(
      getRoleDisplay({ role: "CLIENT", clientEmployee: { employeeRole: "RECEIVER" } })
    ).toBe("CLIENT / RECEIVER");

    expect(
      getRoleDisplay({ role: "CLIENT", clientEmployee: { employeeRole: "STORE" } })
    ).toBe("CLIENT / STORE");

    expect(
      getRoleDisplay({ role: "CLIENT", clientEmployee: { employeeRole: "ACCOUNT" } })
    ).toBe("CLIENT / ACCOUNT");

    expect(
      getRoleDisplay({ role: "CLIENT", clientEmployee: { employeeRole: "MANAGER" } })
    ).toBe("CLIENT / MANAGER");

    expect(
      getRoleDisplay({ role: "CLIENT", clientEmployee: { employeeRole: "GM" } })
    ).toBe("CLIENT / GM");

    expect(
      getRoleDisplay({ role: "CLIENT", clientEmployee: { employeeRole: "MD" } })
    ).toBe("CLIENT / MD");
  });

  it("displays warehouse staff and owner roles correctly", () => {
    expect(getRoleDisplay("WAREHOUSE_OWNER")).toBe("WAREHOUSE OWNER");
    expect(getRoleDisplay("WAREHOUSE_STAFF")).toBe("WAREHOUSE STAFF");
    expect(getRoleDisplay("ACCOUNTANT")).toBe("ACCOUNTANT");
  });

  it("never outputs PRODUCT_RECEIVER", () => {
    const roles = ["RECEIVER", "STORE", "ACCOUNT", "MANAGER", "GM", "MD"];
    roles.forEach((r) => {
      const display = getRoleDisplay({ role: "CLIENT", clientEmployee: { employeeRole: r as any } });
      expect(display).not.toContain("PRODUCT_RECEIVER");
    });
  });
});

describe("Unified Timeline Chronology & Event Structure", () => {
  it("sorts events in chronological order and preserves actor identity", () => {
    const mockEvents: OrderTimelineEvent[] = [
      {
        id: "ev-4",
        type: "INVENTORY_VERIFIED",
        title: "Inventory Verified",
        timestamp: "2026-09-25T08:37:19.959Z",
        actorName: "kenzo",
        actorRole: "CLIENT / STORE",
        notes: "Store inventory verified and received into stock."
      },
      {
        id: "ev-1",
        type: "ISSUED",
        title: "Order Created",
        timestamp: "2026-09-25T08:15:10.726Z",
        actorName: "alex",
        actorRole: "WAREHOUSE OWNER",
        notes: "Initial order created"
      },
      {
        id: "ev-3",
        type: "DELIVERY_VERIFIED",
        title: "Delivery Verified",
        timestamp: "2026-09-25T08:17:26.669Z",
        actorName: "ash",
        actorRole: "CLIENT / RECEIVER",
        notes: "Delivered goods inspected and verified by client receiver."
      },
      {
        id: "ev-2",
        type: "DISPATCHED",
        title: "Dispatched",
        timestamp: "2026-09-25T08:15:15.461Z",
        actorName: "alex",
        actorRole: "WAREHOUSE OWNER",
        notes: null
      },
      {
        id: "ev-5",
        type: "PAYMENT_PENDING",
        title: "Payment Pending",
        timestamp: "2026-09-25T08:37:19.959Z",
        actorName: "System",
        actorRole: "System",
        notes: "Invoice #000029 set to Payment Pending upon store verification."
      },
      {
        id: "ev-6",
        type: "PAYMENT_RECORDED",
        title: "Payment Recorded",
        timestamp: "2026-09-25T09:00:28.172Z",
        actorName: "maxi",
        actorRole: "CLIENT / ACCOUNT",
        notes: "Payment of ₹212,400 recorded via BANK_TRANSFER."
      },
      {
        id: "ev-7",
        type: "PAID",
        title: "Paid",
        timestamp: "2026-09-25T09:00:28.172Z",
        actorName: "System",
        actorRole: "System",
        notes: "Invoice #000029 fully settled."
      }
    ];

    mockEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Verify chronological order
    expect(mockEvents[0].title).toBe("Order Created");
    expect(mockEvents[0].actorName).toBe("alex");
    expect(mockEvents[0].actorRole).toBe("WAREHOUSE OWNER");

    expect(mockEvents[1].title).toBe("Dispatched");
    expect(mockEvents[1].actorName).toBe("alex");

    expect(mockEvents[2].title).toBe("Delivery Verified");
    expect(mockEvents[2].actorName).toBe("ash");
    expect(mockEvents[2].actorRole).toBe("CLIENT / RECEIVER");

    expect(mockEvents[3].title).toBe("Inventory Verified");
    expect(mockEvents[3].actorName).toBe("kenzo");
    expect(mockEvents[3].actorRole).toBe("CLIENT / STORE");

    expect(mockEvents[4].title).toBe("Payment Pending");
    expect(mockEvents[4].actorName).toBe("System");

    expect(mockEvents[5].title).toBe("Payment Recorded");
    expect(mockEvents[5].actorName).toBe("maxi");
    expect(mockEvents[5].actorRole).toBe("CLIENT / ACCOUNT");

    expect(mockEvents[6].title).toBe("Paid");
    expect(mockEvents[6].actorName).toBe("System");
  });
});
