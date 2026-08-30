import type { Role } from "@prisma/client";

export type NormalizedNotification = {
  id: string;
  tenantId: string;
  userId?: string | null;
  orderId?: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  isRead?: boolean;
  actionUrl?: string | null;
  priority?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  readAt?: string | null;
  warehouseId?: string | null;
};

export function buildInitials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function buildNotificationActionUrl({ markAll, id }: { markAll?: boolean; id?: string }) {
  const params = new URLSearchParams();

  if (markAll) {
    params.set("markAll", "1");
  } else if (id) {
    params.set("markId", id);
  }

  const query = params.toString();
  return query ? `/dashboard/notifications?${query}` : "/dashboard/notifications";
}

export function getRelativeTimeLabel(timestamp: string | Date) {
  const value = new Date(timestamp);
  const diffMinutes = Math.max(0, Math.round((Date.now() - value.getTime()) / 60000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return value.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function getNotificationTone(type: string) {
  if (["LOW_STOCK", "OUT_OF_STOCK", "PAYMENT_OVERDUE", "VERIFICATION_REQUIRED", "WAREHOUSE_ALERT"].includes(type)) return "red";
  if (["ORDER_CREATED", "ORDER_UPDATED", "PRODUCT_ADDED", "INVOICE_CREATED", "PAYMENT_RECEIVED"].includes(type)) return "green";
  if (["ORDER_READY", "E_WAY_BILL_PROCESSING", "INVOICE_UPLOADED", "SYSTEM_ACTIVITY"].includes(type)) return "amber";
  return "blue";
}

export function normalizeNotification(input: Record<string, unknown>): NormalizedNotification {
  const createdAt = input.createdAt instanceof Date ? input.createdAt.toISOString() : String(input.createdAt ?? new Date().toISOString());
  const read = Boolean(input.read ?? input.isRead ?? false);

  return {
    id: String(input.id ?? ""),
    tenantId: String(input.tenantId ?? ""),
    userId: typeof input.userId === "string" ? input.userId : null,
    orderId: typeof input.orderId === "string" ? input.orderId : null,
    type: String(input.type ?? "SYSTEM_ACTIVITY"),
    title: String(input.title ?? "Warehouse update"),
    message: String(input.message ?? "You have a new notification."),
    read,
    isRead: read,
    actionUrl: typeof input.actionUrl === "string" ? input.actionUrl : null,
    priority: typeof input.priority === "string" ? input.priority : "normal",
    metadata: (input.metadata && typeof input.metadata === "object" ? (input.metadata as Record<string, unknown>) : null),
    createdAt,
    readAt: input.readAt ? String(input.readAt) : null,
    warehouseId: typeof input.warehouseId === "string" ? input.warehouseId : null
  };
}

