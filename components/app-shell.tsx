import Link from "next/link";
import { Boxes, Building2, ClipboardCheck, FileText, LayoutDashboard, PackageSearch, ReceiptText, Shield, Users } from "lucide-react";
import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ClipboardCheck },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/accounting", label: "Accounting", icon: FileText },
  { href: "/dashboard/invoice-import", label: "Invoice Import", icon: ReceiptText },
  { href: "/dashboard/reports", label: "Reports", icon: PackageSearch },
  { href: "/platform", label: "Platform", icon: Shield }
];

export function AppShell({ children, role, name }: { children: React.ReactNode; role: Role; name: string }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-r border-border bg-white">
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
            if (item.href === "/platform" && role !== "PLATFORM_ADMIN") return null;
            if (item.href.includes("accounting") && !["WAREHOUSE_OWNER", "ACCOUNTANT", "CLIENT"].includes(role)) return null;
            if (item.href.includes("invoice-import") && !["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "ACCOUNTANT"].includes(role)) return null;
            if (item.href.includes("clients") && role === "WAREHOUSE_STAFF") return null;
            return (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main>
        <header className="flex min-h-16 items-center justify-between border-b border-border bg-white px-5">
          <div className="text-sm text-slate-500">Commercial warehouse operations</div>
          <div className="flex items-center gap-3">
            <Badge>{role}</Badge>
            <span className="text-sm font-medium">{name}</span>
          </div>
        </header>
        <div className="p-5 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
