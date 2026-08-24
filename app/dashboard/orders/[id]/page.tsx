import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoice } from "@/lib/services";
import { money, statusTone } from "@/lib/utils";

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const order = await prisma.order.findUnique({
    where: { id },
    include: { client: true, items: { include: { product: true } }, statusHistory: { orderBy: { createdAt: "asc" } }, verification: true, invoices: true }
  });
  if (!order || (user.role !== "PLATFORM_ADMIN" && order.tenantId !== user.tenantId)) notFound();

  async function finalizeInvoiceAction() {
    "use server";
    await generateInvoice({ orderId: id, final: true });
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
          <p className="text-sm text-slate-500">{order.client.companyName}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone={statusTone(order.status)}>{order.status}</Badge>
          <Badge tone={statusTone(order.verificationStatus)}>{order.verificationStatus}</Badge>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <h2 className="mb-4 font-semibold">Items</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">SKU</th><th>Product</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-3">{item.product.sku}</td>
                  <td>{item.product.name}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-5 text-right text-lg font-semibold">{money(order.totalAmount)}</div>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Invoice control</h2>
          <p className="mb-4 text-sm text-slate-600">
            Final invoice generation is enforced by the server action and will fail unless client verification is VERIFIED.
          </p>
          <form action={finalizeInvoiceAction}>
            <Button disabled={order.verificationStatus !== "VERIFIED"}>Generate final invoice</Button>
          </form>
          {order.invoices.map((invoice) => (
            <div key={invoice.id} className="mt-3 rounded border border-border p-3 text-sm">
              <div className="font-medium">{invoice.invoiceNumber}</div>
              <div className="text-slate-500">{invoice.status} · {invoice.paymentStatus}</div>
            </div>
          ))}
        </Card>
      </div>
      <Card>
        <h2 className="mb-4 font-semibold">Timeline</h2>
        <div className="space-y-3">
          {order.statusHistory.map((entry) => (
            <div key={entry.id} className="flex gap-3">
              <div className="mt-1 h-3 w-3 rounded-full bg-primary" />
              <div>
                <div className="font-medium">{entry.previousStatus ?? "CREATED"} to {entry.newStatus}</div>
                <div className="text-sm text-slate-500">{entry.createdAt.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
