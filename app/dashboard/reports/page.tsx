import { Card } from "@/components/ui/card";
import { OrderStatusChart } from "@/components/order-status-chart";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ReportsPage() {
  const user = await requireUser();
  const orders = await prisma.order.groupBy({
    by: ["status"],
    where: user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" },
    _count: { status: true }
  });
  const data = orders.map((order) => ({ status: order.status.replaceAll("_", " "), count: order._count.status }));
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-slate-500">Order, inventory, verification, invoice, payment, receivable, and revenue reporting.</p>
      </div>
      <Card className="h-96">
        <OrderStatusChart data={data} />
      </Card>
    </section>
  );
}
