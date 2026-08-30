import { ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const user = await requireUser();

  const sections = [
    { title: "Account settings", visible: true },
    { title: "Profile preferences", visible: true },
    { title: "Notification preferences", visible: true },
    { title: "Appearance preferences", visible: true },
    { title: "Warehouse settings", visible: ["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR"].includes(user.role) },
    { title: "Platform settings", visible: user.role === "PLATFORM_ADMIN" }
  ].filter((section) => section.visible);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">Role-aware preferences and account controls for the current session.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.title} className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span className="font-medium">{section.title}</span>
              </div>
              {section.title === "Platform settings" && <Badge tone="blue">Admin</Badge>}
            </div>
            <div className="text-sm text-slate-500">This section is available to the current role and tenant scope.</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" /> Access scope
        </div>
        <div className="mt-3 text-sm text-slate-600">Current role: <strong>{user.role}</strong> · Tenant: <strong>{user.tenantId ?? "Platform"}</strong></div>
        <div className="mt-4">
          <Link href="/dashboard/change-log" className="inline-flex items-center rounded border border-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            View recent change log
          </Link>
        </div>
      </Card>
    </section>
  );
}
