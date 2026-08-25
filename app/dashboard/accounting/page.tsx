import Link from "next/link";
import { revalidatePath } from "next/cache";
import { FileText, Plus, ReceiptText, CheckCircle2, IndianRupee, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, statusTone } from "@/lib/utils";
import { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";

async function createInvoiceAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId") ?? "");
  const user = await requireUser(["WAREHOUSE_OWNER", "ACCOUNTANT", "PLATFORM_ADMIN"]);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order || (user.role !== "PLATFORM_ADMIN" && order.tenantId !== user.tenantId)) {
    throw new Error("Order not found or unauthorized.");
  }

  const invoiceCount = await prisma.invoice.count({ where: { tenantId: order.tenantId } });
  const invoiceNumber = `INV-2026-${String(invoiceCount + 1).padStart(6, "0")}`;

  await prisma.invoice.create({
    data: {
      tenantId: order.tenantId,
      orderId: order.id,
      clientId: order.clientId,
      invoiceNumber,
      status: InvoiceStatus.DRAFT,
      paymentStatus: PaymentStatus.UNPAID,
      subtotal: order.subtotal,
      cgst: new Prisma.Decimal(order.taxTotal).div(2),
      sgst: new Prisma.Decimal(order.taxTotal).div(2),
      igst: 0,
      discountTotal: order.discountTotal,
      total: order.totalAmount,
      items: {
        create: order.items.map((item) => {
          const divisor = new Prisma.Decimal(200).add(item.taxRate.mul(2));
          const splitTax = new Prisma.Decimal(item.total).mul(item.taxRate).div(divisor);
          return {
            productId: item.productId,
            quantity: item.quantity,
            rate: item.unitPrice,
            discount: item.discount,
            cgst: splitTax,
            sgst: splitTax,
            igst: 0,
            total: item.total,
          };
        }),
      },
    },
  });

  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/orders");
}

export default async function AccountingPage() {
  const user = await requireUser(["WAREHOUSE_OWNER", "ACCOUNTANT", "CLIENT", "PLATFORM_ADMIN"]);
  const tenantWhere = user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" };

  const [invoices, unInvoicedOrders] = await Promise.all([
    prisma.invoice.findMany({
      where: tenantWhere,
      include: { client: true, order: true, payments: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: {
        ...tenantWhere,
        invoices: {
          none: {},
        },
      },
      include: { client: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const receivable = invoices
    .filter((invoice) => invoice.paymentStatus !== "PAID")
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);

  const paidTotal = invoices
    .filter((invoice) => invoice.paymentStatus === "PAID")
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commercial Invoices & Accounting</h1>
          <p className="text-sm text-slate-500">
            GST compliant invoices, receivables, tax splits (CGST/SGST), and payment tracking.
          </p>
        </div>

        <Link href="/dashboard/orders/new">
          <Button className="flex items-center gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Create Order & Invoice
          </Button>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Outstanding Receivables
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-600">{money(receivable)}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Invoiced Count
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-800">{invoices.length}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-primary">
              <FileText className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Settled / Paid Invoices
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600">
                {invoices.filter((item) => item.paymentStatus === "PAID").length}
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Un-invoiced Orders Quick Generator */}
      {unInvoicedOrders.length > 0 && ["WAREHOUSE_OWNER", "ACCOUNTANT", "PLATFORM_ADMIN"].includes(user.role) && (
        <Card className="p-5 bg-teal-50/40 border-teal-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" />
                Generate Invoices for Existing Orders
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {unInvoicedOrders.length} order(s) are awaiting invoice generation.
              </p>
            </div>

            <form action={createInvoiceAction} className="flex items-center gap-2">
              <select
                name="orderId"
                required
                className="h-9 rounded border border-border bg-white px-3 text-xs focus:border-primary focus:outline-none"
              >
                {unInvoicedOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} ({o.client.companyName}) — {money(o.totalAmount)}
                  </option>
                ))}
              </select>
              <Button type="submit" className="h-9 text-xs flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Generate
              </Button>
            </form>
          </div>
        </Card>
      )}

      {/* Invoices Table */}
      <Card className="overflow-hidden p-0 shadow-sm">
        <div className="border-b border-border bg-slate-50/70 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Commercial Invoices</h2>
              <p className="text-xs text-slate-500">Tax invoices with itemized CGST/SGST breakdown.</p>
            </div>
            <Badge tone="neutral">{invoices.length} invoices</Badge>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-slate-300" />
            <p className="mt-3 font-medium text-slate-600">No invoices issued yet</p>
            <p className="text-sm text-slate-400">Generate an invoice from an order or create a new order.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Invoice Number</th>
                  <th className="px-6 py-3">Related Order</th>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">Invoice Status</th>
                  <th className="px-6 py-3">Payment Status</th>
                  <th className="px-6 py-3 text-right">Invoice Total</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-mono font-semibold">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="text-primary hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/orders/${invoice.order.id}`}
                        className="font-mono text-xs hover:underline text-slate-700 font-medium"
                      >
                        {invoice.order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {invoice.client.companyName}
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={statusTone(invoice.paymentStatus)}>{invoice.paymentStatus}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      {money(invoice.total)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/dashboard/invoices/${invoice.id}`}>
                        <Button variant="secondary" className="h-8 px-2.5 text-xs flex items-center gap-1.5 ml-auto">
                          <FileText className="h-3.5 w-3.5" />
                          View & Print
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
