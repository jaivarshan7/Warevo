import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusTone } from "@/lib/utils";

export default async function PlatformPage() {
  await requireUser(["PLATFORM_ADMIN"]);
  const tenants = await prisma.tenant.findMany({ include: { _count: { select: { users: true, clients: true, orders: true, invoices: true } } }, orderBy: { createdAt: "desc" } });
  const auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Platform administration</h1>
        <p className="text-sm text-slate-500">Cross-tenant oversight for warehouses, users, orders, inventory, invoices, settings, and audit logs.</p>
      </div>
      <Card>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Warehouse</th><th>Status</th><th>Users</th><th>Clients</th><th>Orders</th><th>Invoices</th></tr></thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-t border-border">
                <td className="py-3 font-medium">{tenant.name}</td>
                <td><Badge tone={statusTone(tenant.status)}>{tenant.status}</Badge></td>
                <td>{tenant._count.users}</td>
                <td>{tenant._count.clients}</td>
                <td>{tenant._count.orders}</td>
                <td>{tenant._count.invoices}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <h2 className="mb-4 font-semibold">Recent audit log</h2>
        <div className="space-y-3">
          {auditLogs.map((log) => (
            <div key={log.id} className="rounded border border-border p-3 text-sm">
              <div className="font-medium">{log.action}</div>
              <div className="text-slate-500">{log.userRole} · {log.entity} · {log.createdAt.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
