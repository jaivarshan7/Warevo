import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" },
    orderBy: { createdAt: "desc" }
  });
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-slate-500">In-app notification center designed for later email, SMS, and WhatsApp delivery channels.</p>
      </div>
      <div className="grid gap-3">
        {notifications.map((item) => (
          <Card key={item.id} className="flex items-start gap-3">
            <Bell className="mt-1 h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">{item.title}</h2>
                <Badge tone={item.read ? "neutral" : "blue"}>{item.read ? "READ" : "UNREAD"}</Badge>
              </div>
              <p className="text-sm text-slate-500">{item.message}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
