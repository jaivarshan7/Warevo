import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, statusTone } from "@/lib/utils";

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await prisma.order.findMany({
    where: user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" },
    include: { client: true, assignedStaff: true, invoices: true },
    orderBy: { updatedAt: "desc" }
  });
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-slate-500">Workflow-controlled orders with tenant-side authorization.</p>
      </div>
      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <input className="h-10 rounded border border-border px-3 text-sm" placeholder="Search order number" />
          <select className="h-10 rounded border border-border px-3 text-sm"><option>Status</option></select>
          <select className="h-10 rounded border border-border px-3 text-sm"><option>Verification</option></select>
          <input className="h-10 rounded border border-border px-3 text-sm" type="date" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-2">Order</th><th>Client</th><th>Status</th><th>Verification</th><th>Invoice</th><th>Total</th></tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-border">
                  <td className="py-3 font-medium"><Link href={`/dashboard/orders/${order.id}`}>{order.orderNumber}</Link></td>
                  <td>{order.client.companyName}</td>
                  <td><Badge tone={statusTone(order.status)}>{order.status}</Badge></td>
                  <td><Badge tone={statusTone(order.verificationStatus)}>{order.verificationStatus}</Badge></td>
                  <td>{order.invoices.at(0)?.invoiceNumber ?? "Not generated"}</td>
                  <td>{money(order.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
