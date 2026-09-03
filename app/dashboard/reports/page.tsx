import { Card } from "@/components/ui/card";
import { OrderStatusChart } from "@/components/order-status-chart";
import { requireDashboardRoute } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReportSummary } from "@/lib/reporting";
import { money } from "@/lib/utils";

export default async function ReportsPage() {
  const user = await requireDashboardRoute("/dashboard/reports");
  const where = user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" };

  const [orders, invoices, products] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" }
    }),
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" }
    }),
    prisma.product.findMany({
      where,
      include: { inventory: true }
    })
  ]);

  const summary = buildReportSummary(
    orders.map((order) => ({ status: order.status, totalAmount: order.totalAmount })),
    invoices.map((invoice) => ({ total: invoice.total })),
    products.map((product) => ({ inventory: product.inventory, reorderLevel: product.reorderLevel }))
  );

  const groupedOrders = await prisma.order.groupBy({
    by: ["status"],
    where,
    _count: { status: true }
  });
  const data = groupedOrders.map((order) => ({ status: order.status.replaceAll("_", " "), count: order._count.status }));

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-slate-500">Order, inventory, verification, invoice, payment, receivable, and revenue reporting.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Revenue" value={money(summary.totalRevenue)} detail="Gross order value" />
        <SummaryCard title="Receivables" value={money(summary.receivables)} detail="Outstanding invoice value" />
        <SummaryCard title="Verification pending" value={String(summary.verificationPending)} detail="Awaiting client checks" />
        <SummaryCard title="Low stock items" value={String(summary.lowStockItems)} detail="Below reorder threshold" />
      </div>

      <Card className="h-96">
        <OrderStatusChart data={data} />
      </Card>
    </section>
  );
}

function SummaryCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{detail}</div>
    </Card>
  );
}
