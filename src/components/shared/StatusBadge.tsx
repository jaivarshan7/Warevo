import React from "react";
import { OrderStatus, VerificationStatus, InvoiceStatus, PaymentStatus } from "@/types";
import { orderStatusBadgeStyles, verificationBadgeStyles } from "@/lib/orderWorkflow";

interface StatusBadgeProps {
  status: OrderStatus | VerificationStatus | InvoiceStatus | PaymentStatus | string;
  type?: "order" | "verification" | "invoice" | "payment";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = "order" }) => {
  let style = "bg-slate-800 text-slate-300 border-slate-700";

  if (type === "order" && orderStatusBadgeStyles[status as OrderStatus]) {
    style = orderStatusBadgeStyles[status as OrderStatus];
  } else if (type === "verification" && verificationBadgeStyles[status as VerificationStatus]) {
    style = verificationBadgeStyles[status as VerificationStatus];
  } else if (type === "invoice") {
    switch (status) {
      case "FINAL":
        style = "bg-emerald-950 text-emerald-300 border-emerald-800";
        break;
      case "SENT":
        style = "bg-blue-950 text-blue-300 border-blue-800";
        break;
      case "DRAFT":
        style = "bg-slate-800 text-slate-300 border-slate-700";
        break;
      case "CANCELLED":
        style = "bg-rose-950 text-rose-300 border-rose-800";
        break;
    }
  } else if (type === "payment") {
    switch (status) {
      case "PAID":
        style = "bg-emerald-950 text-emerald-300 border-emerald-800";
        break;
      case "PARTIALLY_PAID":
        style = "bg-amber-950 text-amber-300 border-amber-800";
        break;
      case "UNPAID":
        style = "bg-slate-800 text-slate-300 border-slate-700";
        break;
      case "OVERDUE":
        style = "bg-rose-950 text-rose-300 border-rose-800";
        break;
    }
  }

  const formatText = (text: string) => {
    return text.replace(/_/g, " ");
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${style}`}
    >
      {formatText(status)}
    </span>
  );
};
