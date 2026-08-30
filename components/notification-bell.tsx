"use client";

import { Bell, CheckCheck, ChevronRight, Clock3, Dot, Flame, Info, Package, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildInitials, getRelativeTimeLabel } from "@/lib/notifications";

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

export function NotificationBell({ notifications, unreadCount }: { notifications: NotificationItem[]; unreadCount: number }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const visibleNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-h-5 min-w-5 rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-slate-900/20 md:hidden" />
          <div ref={panelRef} className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,23rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl md:absolute md:left-auto md:top-12 md:right-0 md:translate-x-0 md:translate-y-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-semibold">Notifications</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-700">Close</button>
            </div>

            <div className="max-h-[22rem] overflow-y-auto p-2">
              {visibleNotifications.length === 0 ? (
                <div className="flex min-h-24 flex-col items-center justify-center gap-2 px-4 py-6 text-center text-sm text-slate-500">
                  <Info className="h-5 w-5 text-slate-400" />
                  No notifications yet.
                </div>
              ) : (
                visibleNotifications.map((item) => (
                  <NotificationItemRow key={item.id} item={item} onClick={() => setOpen(false)} />
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
              <Link href="/dashboard/notifications?markAll=1" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 rounded px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as read
              </Link>
              <Link href="/dashboard/notifications" className="inline-flex items-center gap-1 text-xs font-medium text-primary" onClick={() => setOpen(false)}>
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationItemRow({ item, onClick }: { item: NotificationItem; onClick: () => void }) {
  const icon = item.type.includes("ORDER") ? <Package className="h-3.5 w-3.5" /> : item.type.includes("INVOICE") ? <ShieldAlert className="h-3.5 w-3.5" /> : item.type.includes("PAYMENT") ? <Flame className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />;
  const initials = buildInitials(item.title);

  return (
    <Link
      href={item.actionUrl || "/dashboard/notifications"}
      onClick={onClick}
      className="flex gap-3 rounded-lg border border-transparent p-2.5 transition hover:bg-slate-50 hover:border-slate-200"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-800">{item.title}</div>
            <div className="mt-1 text-xs text-slate-500">{item.message}</div>
          </div>
          {!item.read && <Dot className="h-5 w-5 text-primary" />}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {getRelativeTimeLabel(item.createdAt)}</span>
          <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 uppercase text-slate-600">{item.priority ?? "normal"}</span>
        </div>
      </div>
      <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-600">{initials}</div>
    </Link>
  );
}
