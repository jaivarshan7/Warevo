import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(number);
}

export function statusTone(status: string): "neutral" | "green" | "amber" | "red" | "blue" {
  if (["VERIFIED", "PAID", "COMPLETED", "ACTIVE", "FINAL"].includes(status)) return "green";
  if (["REJECTED", "CANCELLED", "SUSPENDED", "OVERDUE"].includes(status)) return "red";
  if (["PENDING", "PARTIALLY_VERIFIED", "PAYMENT_PENDING", "INVOICE_PENDING"].some((part) => status.includes(part))) return "amber";
  if (["DISPATCHED", "PROCESSING", "INVOICED"].includes(status)) return "blue";
  return "neutral";
}
