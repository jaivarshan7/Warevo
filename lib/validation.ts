import { z } from "zod";

export const createClientSchema = z.object({
  companyName: z.string().min(2),
  contactPerson: z.string().min(2),
  mobile: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  gstNumber: z.string().optional(),
  billingAddress: z.string().min(4),
  shippingAddress: z.string().min(4)
});

export const transitionOrderSchema = z.object({
  orderId: z.string().min(1),
  nextStatus: z.enum([
    "ISSUED",
    "PROCESSING",
    "READY_FOR_DISPATCH",
    "DISPATCHED",
    "RECEIVED",
    "VERIFICATION_PENDING",
    "VERIFIED",
    "PARTIALLY_VERIFIED",
    "REJECTED",
    "INVOICE_PENDING",
    "INVOICED",
    "PAYMENT_PENDING",
    "PAID",
    "COMPLETED",
    "CANCELLED"
  ]),
  notes: z.string().optional()
});

export const verificationSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["VERIFIED", "PARTIALLY_VERIFIED", "REJECTED"]),
  responses: z.array(z.object({ itemId: z.string().optional(), text: z.string(), checked: z.boolean(), comment: z.string().optional() })),
  comments: z.string().optional(),
  attachments: z.array(z.object({ name: z.string(), url: z.string().url(), type: z.string() })).optional()
});

export const invoiceSchema = z.object({
  orderId: z.string().min(1),
  final: z.boolean().default(false)
});
