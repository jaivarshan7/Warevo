import { Activity } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditLogTable } from "@/components/audit-log-table";

export default async function ChangeLogPage() {
  const user = await requireUser();

  if (!user.tenantId && user.role !== "PLATFORM_ADMIN") {
    throw new Error("Tenant context required.");
  }

  const logs = await prisma.auditLog.findMany({
    where: user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? null },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-primary">
          <Activity className="h-5 w-5" />
          <h1 className="text-2xl font-semibold">Change log</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500">Recent operational changes for your tenant and the users who made them.</p>
      </div>

      <div className="rounded border border-border bg-white p-4">
        <AuditLogTable logs={logs.map((log) => ({
          id: log.id,
          action: log.action,
          entity: log.entity,
          userRole: String(log.userRole),
          createdAt: log.createdAt,
          previousValue: (log.previousValue as Record<string, unknown>) ?? null,
          newValue: (log.newValue as Record<string, unknown>) ?? null
        }))} />
      </div>
    </section>
  );
}
