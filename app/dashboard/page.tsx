import { AlertTriangle, ClipboardCheck, FileText, IndianRupee, Package, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listDashboardData } from "@/lib/services";
import { money, statusTone } from "@/lib/utils";

export default async function DashboardPage() {
  const { user, orders, clients, invoices, products, notifications } = await listDashboardData();
  const activeOrders = orders.filter((order) => !["COMPLETED", "CANCELLED"].includes(order.status)).length;
  const pendingVerification = orders.filter((order) => order.verificationStatus !== "VERIFIED").length;
  const receivables = invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const lowStock = products.filter((product) => product.inventory.some((item) => item.availableQuantity <= product.reorderLevel)).length;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500">{user.role === "PLATFORM_ADMIN" ? "Platform-wide operating view." : "Tenant-isolated operating view."}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<ClipboardCheck />} label="Active orders" value={activeOrders} />
        <Metric icon={<Users />} label="Clients" value={clients} />
        <Metric icon={<FileText />} label="Receivables" value={money(receivables)} />
        <Metric icon={<AlertTriangle />} label="Low stock" value={lowStock} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent orders</h2>
            <Badge tone="amber">{pendingVerification} pending verification</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2">Order</th><th>Client</th><th>Status</th><th>Total</th></tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="py-3 font-medium">{order.orderNumber}</td>
                    <td>{order.client.companyName}</td>
                    <td><Badge tone={statusTone(order.status)}>{order.status}</Badge></td>
                    <td>{money(order.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Notifications</h2>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded border border-border p-3">
                <div className="font-medium">{notification.title}</div>
                <div className="text-sm text-slate-500">{notification.message}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded bg-teal-50 text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
      </div>
    </Card>
  );
}
