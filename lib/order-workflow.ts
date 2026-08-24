import { OrderStatus, VerificationStatus } from "@prisma/client";

export const validOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["DISPATCHED"],
  DISPATCHED: ["RECEIVED"],
  RECEIVED: ["VERIFICATION_PENDING"],
  VERIFICATION_PENDING: ["VERIFIED", "PARTIALLY_VERIFIED", "REJECTED"],
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
  if (!validOrderTransitions[current].includes(next)) {
    throw new Error(`Invalid order status transition from ${current} to ${next}.`);
  }
}

export function verificationStatusForOrderStatus(status: OrderStatus): VerificationStatus | undefined {
  if (status === "VERIFIED") return "VERIFIED";
  if (status === "PARTIALLY_VERIFIED") return "PARTIALLY_VERIFIED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "VERIFICATION_PENDING") return "PENDING";
  return undefined;
}
