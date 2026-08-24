import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, statusTone } from "@/lib/utils";

export default async function AccountingPage() {
  const user = await requireUser(["WAREHOUSE_OWNER", "ACCOUNTANT", "CLIENT", "PLATFORM_ADMIN"]);
  const invoices = await prisma.invoice.findMany({
    where: user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" },
    include: { client: true, order: true, payments: true },
    orderBy: { createdAt: "desc" }
  });
  const receivable = invoices.filter((invoice) => invoice.paymentStatus !== "PAID").reduce((sum, invoice) => sum + Number(invoice.total), 0);
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Accounting</h1>
        <p className="text-sm text-slate-500">Invoices, payments, GST, receivables, and downloadable PDFs.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><div className="text-sm text-slate-500">Outstanding</div><div className="mt-2 text-2xl font-semibold">{money(receivable)}</div></Card>
        <Card><div className="text-sm text-slate-500">Invoices</div><div className="mt-2 text-2xl font-semibold">{invoices.length}</div></Card>
        <Card><div className="text-sm text-slate-500">Paid</div><div className="mt-2 text-2xl font-semibold">{invoices.filter((item) => item.paymentStatus === "PAID").length}</div></Card>
      </div>
      <Card>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Invoice</th><th>Order</th><th>Client</th><th>Status</th><th>Payment</th><th>Total</th></tr></thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-border">
                <td className="py-3 font-medium">{invoice.invoiceNumber}</td>
                <td>{invoice.order.orderNumber}</td>
                <td>{invoice.client.companyName}</td>
                <td><Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge></td>
                <td><Badge tone={statusTone(invoice.paymentStatus)}>{invoice.paymentStatus}</Badge></td>
                <td>{money(invoice.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
