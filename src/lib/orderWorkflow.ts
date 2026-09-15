import { OrderStatus, VerificationStatus } from "@/types";

export const validOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["DISPATCHED"],
  // DISPATCHED has no generic transitions - must use verification RPC
  DISPATCHED: [],
  // RECEIVED and VERIFICATION_PENDING are historical only - not available for new transitions
  RECEIVED: [],
  VERIFICATION_PENDING: [],
  VERIFIED: ["INVOICE_PENDING"],
  PARTIALLY_VERIFIED: ["PROCESSING", "CANCELLED"],
  REJECTED: ["PROCESSING", "CANCELLED"],
  INVOICE_PENDING: ["INVOICED"],
  INVOICED: ["PAYMENT_PENDING"],
  PAYMENT_PENDING: ["PAID"],
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
