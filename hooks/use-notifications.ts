"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

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

export function useNotifications({
  userId,
  initialNotifications,
  initialUnreadCount
}: {
  userId?: string | null;
  initialNotifications?: NotificationItem[];
  initialUnreadCount?: number;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications ?? []);
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount ?? 0);

  useEffect(() => {
    setNotifications(initialNotifications ?? []);
    setUnreadCount(initialUnreadCount ?? 0);
  }, [initialNotifications, initialUnreadCount]);

  useEffect(() => {
    if (!userId) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`notifications-${userId}`);

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "Notification", filter: `userId=eq.${userId}` },
      (payload) => {
        const next = payload.new as any;
        const item: NotificationItem = {
          id: next.id,
          title: next.title,
          message: next.message,
          type: next.type,
          priority: next.priority,
          actionUrl: next.actionUrl,
          read: Boolean(next.read),
          createdAt: next.createdAt
        };

        setNotifications((current) => [item, ...current]);

        if (!next.read) {
          setUnreadCount((count) => count + 1);
        }
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { notifications, unreadCount };
}
