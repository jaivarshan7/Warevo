import { revalidatePath } from "next/cache";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeNotification } from "@/lib/notifications";

export async function getUserNotifications(user: { id: string; role: Role; tenantId: string | null }) {
  const where = user.role === "PLATFORM_ADMIN"
    ? {}
    : {
        OR: [
          { userId: user.id },
          { tenantId: user.tenantId ?? "" }
        ]
      };

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
    : {
        OR: [
          { userId: user.id, read: false },
          { tenantId: user.tenantId ?? "", read: false }
        ]
      };

  return prisma.notification.count({ where });
}

export async function markNotificationAsRead(id: string) {
  const notification = await prisma.notification.update({
    where: { id },
    data: {
      read: true,
      readAt: new Date()
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  return notification;
}

export async function markAllNotificationsAsRead(user: { id: string; role: Role; tenantId: string | null }) {
  const where = user.role === "PLATFORM_ADMIN"
    ? { read: false }
    : {
        OR: [
          { userId: user.id, read: false },
          { tenantId: user.tenantId ?? "", read: false }
        ]
      };

  const result = await prisma.notification.updateMany({
    where,
    data: {
      read: true,
      readAt: new Date()
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  return result;
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
