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

export const ORDER_LIFECYCLE_STEPS: OrderStatus[] = [
  "ISSUED",
  "PROCESSING",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "VERIFIED"
];

export interface OrderProgressStepInfo {
  step: OrderStatus;
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

/**
 * Authoritative check for whether an order has completed delivery verification
 * (by client, warehouse override, or completion).
 */
export function isOrderDeliveryVerified(order?: {
  status?: string | null;
  deliveryVerifiedAt?: string | null;
  verification?: any;
  verificationStatus?: string | null;
} | null): boolean {
  if (!order) return false;
  const v = Array.isArray(order.verification) ? order.verification[0] : order.verification;
  return Boolean(
    order.deliveryVerifiedAt ||
    order.status === "VERIFIED" ||
    order.status === "COMPLETED" ||
    (v && (v.status === "VERIFIED" || v.status === "PARTIALLY_VERIFIED")) ||
    order.verificationStatus === "VERIFIED" ||
    order.verificationStatus === "PARTIALLY_VERIFIED"
  );
}

/**
 * Authoritative Order Lifecycle Progress calculation.
 * Lifecycle: ISSUED -> PROCESSING -> READY_FOR_DISPATCH -> DISPATCHED -> VERIFIED
 *
 * If: order.status = ISSUED: ISSUED ✓, others pending
 * If: order.status = PROCESSING: ISSUED ✓, PROCESSING ✓, others pending
 * If: order.status = READY_FOR_DISPATCH: ISSUED ✓, PROCESSING ✓, READY ✓, others pending
 * If: order.status = DISPATCHED & delivery not verified:
 *     ISSUED ✓, PROCESSING ✓, READY ✓, DISPATCHED ✓ (active), VERIFIED ○
 * If: delivery verification is complete (by client or warehouse override):
 *     all five steps completed (✓), VERIFIED ✓
 */
export function getOrderProgressSteps(
  orderStatus: OrderStatus | string,
  isDeliveryVerified: boolean = false
): OrderProgressStepInfo[] {
  const isCompletedOrVerified = isDeliveryVerified || orderStatus === "VERIFIED" || orderStatus === "COMPLETED";

  const statusIndexMap: Record<string, number> = {
    DRAFT: -1,
    ISSUED: 0,
    PROCESSING: 1,
    READY_FOR_DISPATCH: 2,
    DISPATCHED: 3,
    RECEIVED: 3,
    VERIFICATION_PENDING: 3,
    VERIFIED: 4,
    COMPLETED: 4
  };

  let highestStageIndex = statusIndexMap[orderStatus] ?? -1;

  // If order status is DISPATCHED, progress index must be at least DISPATCHED = stage 3 (0-indexed: stage 4 of 5)
  if (orderStatus === "DISPATCHED" && highestStageIndex < 3) {
    highestStageIndex = 3;
  }

  // If delivery verification is complete, highest stage is VERIFIED = stage 4 (0-indexed: stage 5 of 5)
  if (isCompletedOrVerified) {
    highestStageIndex = 4;
  }

  const labels: Record<string, string> = {
    ISSUED: "ISSUED",
    PROCESSING: "PROCESSING",
    READY_FOR_DISPATCH: "READY",
    DISPATCHED: "DISPATCHED",
    VERIFIED: "VERIFIED"
  };

  return ORDER_LIFECYCLE_STEPS.map((step, idx) => {
    const isCompleted = highestStageIndex >= idx;
    // Current active state:
    // If verified: stage 4 (VERIFIED) is active
    // If not verified: highest completed stage is active (e.g. DISPATCHED)
    const isCurrent = isCompletedOrVerified ? idx === 4 : idx === highestStageIndex;
    return {
      step,
      label: labels[step] || step,
      isCompleted,
      isCurrent
    };
  });
}

/**
 * Convenience helper accepting an order directly.
 * Evaluates both order.status and persisted delivery verification state.
 */
export function getDeliveryProgress(order?: {
  status: OrderStatus | string;
  deliveryVerifiedAt?: string | null;
  verification?: any;
  verificationStatus?: string | null;
} | null): OrderProgressStepInfo[] {
  if (!order) {
    return getOrderProgressSteps("ISSUED", false);
  }
  const verified = isOrderDeliveryVerified(order);
  return getOrderProgressSteps(order.status, verified);
}
