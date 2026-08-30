import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Activity, Boxes, Building2, ClipboardCheck, FileText, LayoutDashboard, Menu, PackageSearch, Shield, Truck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NotificationCenter } from "@/components/notification-center";
import { UserProfileMenu } from "@/components/user-profile-menu";
import { getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications-server";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ClipboardCheck },
  { href: "/dashboard/orders/track", label: "Track & Verify", icon: Truck },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/accounting", label: "Accounting", icon: FileText },
  { href: "/dashboard/reports", label: "Reports", icon: PackageSearch },
  { href: "/dashboard/change-log", label: "Change log", icon: Activity },
  { href: "/platform", label: "Platform", icon: Shield }
];

async function signOut() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete("demo-user-id");
  cookieStore.delete("demo-user-email");
  cookieStore.delete("demo-user-mobile");
  redirect("/login");
}

export async function AppShell({ children, user }: { children: React.ReactNode; user: { id: string; role: string; name: string; email?: string | null; mobile?: string | null; tenantId?: string | null; avatarUrl?: string | null } }) {
  const notifications = await getUserNotifications({ id: user.id, role: user.role as any, tenantId: user.tenantId ?? null });
  const unreadCount = await getUnreadNotificationCount({ id: user.id, role: user.role as any, tenantId: user.tenantId ?? null });

  return (
    <div className="min-h-screen bg-slate-50">
      <div id="app-shell-backdrop" className="fixed inset-0 z-30 hidden bg-slate-900/40 lg:hidden" />
      <div className="lg:grid lg:grid-cols-[260px_1fr]">
        <aside id="app-shell-sidebar" className="fixed inset-y-0 left-0 z-40 w-[260px] -translate-x-full border-r border-border bg-white shadow-lg transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none">
          <div className="flex h-16 items-center gap-3 border-b border-border px-5">
            <Building2 className="h-7 w-7 text-primary" />
            <div>
              <div className="font-semibold">WarehouseOS</div>
              <div className="text-xs text-slate-500">Multi-tenant WMS</div>
            </div>
          </div>
          <nav className="grid gap-1 p-3">
            {nav.map((item) => {
              const Icon = item.icon;
              if (item.href === "/platform" && user.role !== "PLATFORM_ADMIN") return null;
              if (user.role === "CLIENT" && !["/dashboard", "/dashboard/orders", "/dashboard/orders/track"].includes(item.href)) return null;
              if (item.href === "/dashboard/clients" && user.role === "WAREHOUSE_STAFF") return null;
              if (item.href === "/dashboard/accounting" && user.role === "WAREHOUSE_STAFF") return null;
              return (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur-sm">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-5">
              <div className="flex items-center gap-3">
                <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 lg:hidden" data-mobile-sidebar-toggle>
                  <Menu className="h-4 w-4" />
                </button>
                <div className="hidden text-sm text-slate-500 sm:block">Commercial warehouse operations</div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Badge>{user.role}</Badge>
                <NotificationCenter
                  userId={user.id}
                  initialNotifications={notifications.map((notification) => ({
                    id: notification.id,
                    title: notification.title,
                    message: notification.message,
                    type: String(notification.type),
                    priority: notification.priority,
                    actionUrl: notification.actionUrl ?? "/dashboard/notifications",
                    read: Boolean(notification.read),
                    createdAt: notification.createdAt
                  }))}
                  initialUnreadCount={Number(unreadCount)}
                />
                <UserProfileMenu user={{
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  avatarUrl: user.avatarUrl ?? null
                }} />
              </div>
            </div>
          </header>
          <div className="p-4 sm:p-5 lg:p-8">{children}</div>
        </main>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        (() => {
          const sidebar = document.getElementById('app-shell-sidebar');
          const backdrop = document.getElementById('app-shell-backdrop');
          const toggles = document.querySelectorAll('[data-mobile-sidebar-toggle]');
          const close = () => {
            sidebar?.classList.add('-translate-x-full');
            backdrop?.classList.add('hidden');
          };
          const open = () => {
            sidebar?.classList.remove('-translate-x-full');
            backdrop?.classList.remove('hidden');
          };
          toggles.forEach((button) => button.addEventListener('click', () => {
            if (sidebar?.classList.contains('-translate-x-full')) open(); else close();
          }));
          backdrop?.addEventListener('click', close);
          if (window.matchMedia('(min-width: 1024px)').matches) {
            sidebar?.classList.remove('-translate-x-full');
            backdrop?.classList.add('hidden');
          }
        })();
      ` }} />
    </div>
  );
}
