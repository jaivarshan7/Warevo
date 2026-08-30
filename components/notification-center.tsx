"use client";

import { NotificationBell } from "@/components/notification-bell";
import { useNotifications } from "@/hooks/use-notifications";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  priority?: string | null;
  actionUrl?: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationCenter({
  userId,
  initialNotifications,
  initialUnreadCount
}: {
  userId: string;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const { notifications, unreadCount } = useNotifications({
    userId,
    initialNotifications,
    initialUnreadCount
  });

  return <NotificationBell notifications={notifications} unreadCount={unreadCount} />;
}
