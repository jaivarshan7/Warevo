import { useState, useEffect, useCallback } from "react";
import { Notification } from "@/types";
import { fetchUserNotifications, markNotificationRead } from "@/lib/services";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export function useNotifications() {
  const { user, tenant } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      const list = await fetchUserNotifications(tenant?.id, user?.id, user?.client?.id);
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.read).length);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, tenant?.id]);

  useEffect(() => {
    loadNotifications();

    // Unique channel per hook instance to prevent "cannot add postgres_changes callbacks after subscribe()"
    const channelName = `notif_sub_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase.channel(channelName);

    try {
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "Notification" },
          (payload) => {
            const newNotif = payload.new as Notification;
            if (
              (!newNotif.tenantId || newNotif.tenantId === tenant?.id) &&
              (!newNotif.userId || newNotif.userId === user?.id)
            ) {
              setNotifications((prev) => [newNotif, ...prev]);
              setUnreadCount((c) => c + 1);
            }
          }
        )
        .subscribe();
    } catch (subErr) {
      console.warn("Realtime notification subscription warning:", subErr);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotifications, user?.id, tenant?.id]);

  const markAsRead = async (id: string) => {
    try {
      const result = await markNotificationRead(id, tenant?.id || "", user?.client?.id);
      // Only update UI if the operation succeeded (result is not null)
      if (result) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    refresh: loadNotifications,
    markAsRead
  };
}
