import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, MailCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { buildNotificationActionUrl } from "@/lib/notifications";
import { markAllNotificationsAsRead, markNotificationAsRead } from "@/lib/notifications-server";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ markAll?: string; markId?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  if (params.markAll === "1") {
    await markAllNotificationsAsRead(user);
    redirect("/dashboard/notifications");
  }

  if (params.markId) {
    await markNotificationAsRead(params.markId);
    redirect("/dashboard/notifications");
  }

  const notifications = await prisma.notification.findMany({
    where: user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" },
    orderBy: { createdAt: "desc" }
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-slate-500">In-app notification center designed for later email, SMS, and WhatsApp delivery channels.</p>
        </div>
        <form action={buildNotificationActionUrl({ markAll: true })} method="GET">
          <Button type="submit" variant="secondary" className="h-10 gap-2">
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        </form>
      </div>

      <div className="grid gap-3">
        {notifications.length === 0 ? (
          <Card className="p-6 text-sm text-slate-500">
            <div className="flex items-center gap-2 font-medium text-slate-700"><Bell className="h-4 w-4 text-primary" /> You are all caught up.</div>
            <div className="mt-2">There are no notifications for your current role and tenant scope.</div>
          </Card>
        ) : notifications.map((item) => (
          <Card key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-primary">
                <MailCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-medium text-slate-800">{item.title}</h2>
                  <Badge tone={item.read ? "neutral" : "blue"}>{item.read ? "READ" : "UNREAD"}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{item.message}</p>
                <div className="mt-2 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!item.read && (
                <form action={buildNotificationActionUrl({ id: item.id })} method="GET">
                  <Button type="submit" variant="ghost" className="h-9 px-2 text-xs">
                    Mark as read
                  </Button>
                </form>
              )}
              {item.actionUrl && (
                <Link href={item.actionUrl} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Open <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
