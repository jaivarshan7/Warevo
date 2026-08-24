import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ClientsPage() {
  const user = await requireUser(["WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "ACCOUNTANT", "CLIENT", "PLATFORM_ADMIN"]);
  const clients = await prisma.client.findMany({
    where: user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" },
    include: { orders: true },
    orderBy: { companyName: "asc" }
  });
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-slate-500">Client records are owner/moderator-created; no self-registration path is exposed.</p>
      </div>
      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <input className="h-10 rounded border border-border px-3 text-sm" placeholder="Company, contact, mobile" />
          <select className="h-10 rounded border border-border px-3 text-sm"><option>Status</option></select>
          <input className="h-10 rounded border border-border px-3 text-sm" placeholder="GST number" />
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Company</th><th>Contact</th><th>Mobile</th><th>GST</th><th>Status</th><th>Orders</th></tr></thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-t border-border">
                <td className="py-3 font-medium">{client.companyName}</td>
                <td>{client.contactPerson}</td>
                <td>{client.mobile}</td>
                <td>{client.gstNumber}</td>
                <td><Badge tone={client.status === "ACTIVE" ? "green" : "neutral"}>{client.status}</Badge></td>
                <td>{client.orders.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
