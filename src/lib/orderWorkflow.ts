import { OrderStatus, VerificationStatus, PaymentStatus } from "@/types";

// Active workflow stages strictly per WMS specification:
// ISSUED -> PROCESSING -> READY_FOR_DISPATCH -> DISPATCHED -> VERIFIED
// (PAID is not an OrderStatus; it is a PaymentStatus on Invoice)
export const ORDER_ACTIVE_WORKFLOW: OrderStatus[] = [
  "ISSUED",
  "PROCESSING",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "VERIFIED"
];

export const validOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["DISPATCHED", "PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["DISPATCHED", "CANCELLED"],
  // DISPATCHED has no generic direct status advancement - must use verification RPCs
  DISPATCHED: ["CANCELLED"],
  // Historical states preserved for DB compatibility
  RECEIVED: [],
  VERIFICATION_PENDING: [],
  VERIFIED: ["COMPLETED"],
  PARTIALLY_VERIFIED: ["PROCESSING", "CANCELLED"],
  REJECTED: ["PROCESSING", "CANCELLED"],
  INVOICE_PENDING: [],
  INVOICED: [],
  PAYMENT_PENDING: [],
  PAID: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: []
};

export function assertValidTransition(current: OrderStatus, next: OrderStatus) {
  if (!validOrderTransitions[current]?.includes(next)) {
    throw new Error(`Invalid order status transition from ${current} to ${next}.`);
  }
}

export function verificationStatusForOrderStatus(
  status: OrderStatus
): VerificationStatus | undefined {
  if (status === "VERIFIED") return "VERIFIED";
  if (status === "PARTIALLY_VERIFIED") return "PARTIALLY_VERIFIED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "VERIFICATION_PENDING") return "PENDING";
  return undefined;
}

export const orderStatusBadgeStyles: Record<OrderStatus, string> = {
  DRAFT: "bg-slate-800 text-slate-300 border-slate-700",
  ISSUED: "bg-blue-950 text-blue-300 border-blue-800",
  PROCESSING: "bg-amber-950 text-amber-300 border-amber-800",
  READY_FOR_DISPATCH: "bg-purple-950 text-purple-300 border-purple-800",
  DISPATCHED: "bg-indigo-950 text-indigo-300 border-indigo-800",
  RECEIVED: "bg-cyan-950 text-cyan-300 border-cyan-800",
  VERIFICATION_PENDING: "bg-yellow-950 text-yellow-300 border-yellow-800",
  VERIFIED: "bg-emerald-950 text-emerald-300 border-emerald-800",
  PARTIALLY_VERIFIED: "bg-orange-950 text-orange-300 border-orange-800",
  REJECTED: "bg-rose-950 text-rose-300 border-rose-800",
  INVOICE_PENDING: "bg-teal-950 text-teal-300 border-teal-800",
  INVOICED: "bg-sky-950 text-sky-300 border-sky-800",
  PAYMENT_PENDING: "bg-amber-950 text-amber-300 border-amber-800",
  PAID: "bg-green-950 text-green-300 border-green-800",
  COMPLETED: "bg-emerald-950 text-emerald-200 border-emerald-700",
  CANCELLED: "bg-red-950 text-red-300 border-red-800"
};

export const verificationBadgeStyles: Record<VerificationStatus, string> = {
  PENDING: "bg-yellow-950 text-yellow-300 border-yellow-800",
  VERIFIED: "bg-emerald-950 text-emerald-300 border-emerald-800",
  PARTIALLY_VERIFIED: "bg-orange-950 text-orange-300 border-orange-800",
  REJECTED: "bg-rose-950 text-rose-300 border-rose-800"
};

export interface WorkflowStageItem {
  id: string;
  name: string;
  state: "completed" | "current" | "pending";
  label: string;
  detail?: string;
}

/**
 * Derives the complete client workflow stages:
 * ISSUED -> PROCESSING -> READY FOR DISPATCH -> DISPATCHED -> DELIVERY VERIFIED -> INVENTORY VERIFIED -> PAYMENT PENDING -> PAID
 */
export function deriveClientWorkflowStages(
  order: {
    status: OrderStatus;
    verificationStatus?: VerificationStatus | null;
    deliveryVerifiedAt?: string | null;
    storeVerifiedAt?: string | null;
  },
  invoicePaymentStatus?: PaymentStatus | string | null
): WorkflowStageItem[] {
  const isOrderIssued = ["ISSUED", "PROCESSING", "READY_FOR_DISPATCH", "DISPATCHED", "VERIFIED", "COMPLETED"].includes(order.status);
  const isProcessing = ["PROCESSING", "READY_FOR_DISPATCH", "DISPATCHED", "VERIFIED", "COMPLETED"].includes(order.status);
  const isReadyDispatch = ["READY_FOR_DISPATCH", "DISPATCHED", "VERIFIED", "COMPLETED"].includes(order.status);
  const isDispatched = ["DISPATCHED", "VERIFIED", "COMPLETED"].includes(order.status);

  const isDeliveryVerified = Boolean(order.deliveryVerifiedAt || order.status === "VERIFIED" || order.status === "COMPLETED");
  const isStoreVerified = Boolean(order.storeVerifiedAt || (order.status === "VERIFIED" && isDeliveryVerified) || order.status === "COMPLETED");

  const effectivePaymentStatus = invoicePaymentStatus || "UNPAID";
  const isPaid = effectivePaymentStatus === "PAID";
  const isPaymentPending = isDeliveryVerified && !isPaid;

  const stages: WorkflowStageItem[] = [
    {
      id: "ISSUED",
      name: "ISSUED",
      label: "Issued",
      state: isOrderIssued ? (order.status === "ISSUED" ? "current" : "completed") : "pending"
    },
    {
      id: "PROCESSING",
      name: "PROCESSING",
      label: "Processing",
      state: isProcessing ? (order.status === "PROCESSING" ? "current" : "completed") : "pending"
    },
    {
      id: "READY_FOR_DISPATCH",
      name: "READY FOR DISPATCH",
      label: "Ready for Dispatch",
      state: isReadyDispatch ? (order.status === "READY_FOR_DISPATCH" ? "current" : "completed") : "pending"
    },
    {
      id: "DISPATCHED",
      name: "DISPATCHED",
      label: "Dispatched",
      state: isDispatched ? (order.status === "DISPATCHED" && !isDeliveryVerified ? "current" : "completed") : "pending"
    },
    {
      id: "DELIVERY_VERIFIED",
      name: "DELIVERY VERIFIED",
      label: isDeliveryVerified ? "Delivery: Verified" : "Delivery: Pending",
      state: isDeliveryVerified
        ? "completed"
        : isDispatched
        ? "current"
        : "pending"
    },
    {
      id: "INVENTORY_VERIFIED",
      name: "INVENTORY VERIFIED",
      label: isStoreVerified ? "Inventory: Verified" : "Inventory: Pending",
      state: isStoreVerified
        ? "completed"
        : isDeliveryVerified
        ? "current"
        : "pending"
    },
    {
      id: "PAYMENT_PENDING",
      name: "PAYMENT PENDING",
      label: isPaid ? "Payment: Paid" : isPaymentPending ? "Payment: Pending" : "Payment",
      state: isPaid ? "completed" : isPaymentPending ? "current" : "pending"
    },
    {
      id: "PAID",
      name: "PAID",
      label: "Paid",
      state: isPaid ? "completed" : "pending"
    }
  ];

  return stages;
}
