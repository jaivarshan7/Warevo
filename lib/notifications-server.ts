import { revalidatePath } from "next/cache";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeNotification } from "@/lib/notifications";

export async function getUserNotifications(user: { id: string; role: Role; tenantId: string | null }) {
  const where = user.role === "PLATFORM_ADMIN"
    ? {}
    : { tenantId: user.tenantId ?? "", userId: user.id };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 25
  });

  return notifications.map((notification) => normalizeNotification(notification as Record<string, unknown>));
}

export async function getUnreadNotificationCount(user: { id: string; role: Role; tenantId: string | null }) {
  const where = user.role === "PLATFORM_ADMIN"
    ? { read: false }
    : { tenantId: user.tenantId ?? "", userId: user.id, read: false };

  return prisma.notification.count({ where });
}

export async function markNotificationAsRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: {
      read: true,
      readAt: new Date()
    }
  });
}

export async function markAllNotificationsAsRead(user: { id: string; role: Role; tenantId: string | null }) {
  const where = user.role === "PLATFORM_ADMIN"
    ? { read: false }
    : { tenantId: user.tenantId ?? "", userId: user.id, read: false };

  return prisma.notification.updateMany({
    where,
    data: {
      read: true,
      readAt: new Date()
    }
  });
}

export async function createAppNotification(input: {
  tenantId?: string | null;
  userId?: string | null;
  warehouseId?: string | null;
  type: string;
  title: string;
  message: string;
  priority?: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!input.tenantId) return null;

  return prisma.notification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      type: input.type as never,
      title: input.title,
      message: input.message,
      priority: input.priority ?? "normal",
      actionUrl: input.actionUrl ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      warehouseId: input.warehouseId ?? null,
      read: false
    }
  });
}

export async function notifyOrderAudience(input: {
  tenantId: string;
  clientId: string;
  orderId: string;
  type: string;
  title: string;
  message: string;
  priority?: string;
  actionUrl?: string | null;
  excludeUserId?: string;
}) {
  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: { companyName: true, companyGroupId: true },
  });
  if (!client) return [];

  const [clientUsers, warehouseUsers] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenantId: input.tenantId,
        client: {
          OR: [
            { companyName: client.companyName },
            ...(client.companyGroupId ? [{ companyGroupId: client.companyGroupId }] : []),
          ],
        },
      },
      select: { id: true },
    }),
    prisma.user.findMany({
      where: {
        tenantId: input.tenantId,
        role: { in: ["WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"] },
      },
      select: { id: true },
    }),
  ]);
  const recipientIds = [...new Set([...clientUsers, ...warehouseUsers].map((recipient) => recipient.id))]
    .filter((userId) => userId !== input.excludeUserId);

  return Promise.all(recipientIds.map((userId) => createAppNotification({
    tenantId: input.tenantId,
    userId,
    type: input.type,
    title: input.title,
    message: input.message,
    priority: input.priority,
    actionUrl: input.actionUrl,
    metadata: { orderId: input.orderId, clientId: input.clientId },
  })));
}
