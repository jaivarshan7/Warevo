import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ClipboardCheck, Plus, ReceiptText, ArrowRight, CheckCircle2, Clock, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getClientOrderVisibility, requireDashboardRoute, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, statusTone } from "@/lib/utils";
import { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";

async function quickGenerateInvoice(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId") ?? "");
  const user = await requireUser(["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "ACCOUNTANT"]);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order || (user.role !== "PLATFORM_ADMIN" && order.tenantId !== user.tenantId)) {
    throw new Error("Order not found or unauthorized.");
  }

  const latestInvoice = await prisma.invoice.findFirst({
    where: { tenantId: order.tenantId, invoiceNumber: { startsWith: "INV-2026-" } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const latestInvoiceNumber = Number(latestInvoice?.invoiceNumber.replace("INV-2026-", "")) || 0;
  const invoiceNumber = `INV-2026-${String(latestInvoiceNumber + 1).padStart(6, "0")}`;

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

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/accounting");
}

export default async function OrdersPage() {
  const user = await requireUser();
  if (user.role === "PRODUCT_RECEIVER") redirect("/dashboard/orders/track");
  if (user.role === "CLIENT") await requireDashboardRoute("/dashboard/orders");
  const tenantWhere = user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" };
  const orderWhere = user.role === "CLIENT" ? await getClientOrderVisibility(user) : tenantWhere;

  const orders = await prisma.order.findMany({
    where: orderWhere,
    include: {
      client: true,
      assignedStaff: true,
      invoices: {
        orderBy: { createdAt: "desc" },
      },
      items: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const totalOrders = orders.length;
  const pendingVerification = orders.filter((o) => o.verificationStatus !== "VERIFIED").length;
  const missingInvoice = orders.filter((o) => o.invoices.length === 0).length;

  return (
    <section className="space-y-6">
      {/* Header & Create Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commercial Orders</h1>
          <p className="text-sm text-slate-500">
            Order lifecycle, client verification status, product items, and invoice generation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard/orders/track">
            <Button variant="secondary" className="flex items-center gap-2 shadow-sm">
              <Truck className="h-4 w-4 text-slate-600" />
              Track & Verify
            </Button>
          </Link>
          {["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"].includes(user.role) && (
            <Link href="/dashboard/orders/new">
              <Button className="flex items-center gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Create Order
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-primary">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Orders</p>
            <h3 className="text-2xl font-bold text-slate-800">{totalOrders}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Pending Verification</p>
            <h3 className="text-2xl font-bold text-slate-800">{pendingVerification}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ReceiptText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Un-invoiced Orders</p>
            <h3 className="text-2xl font-bold text-slate-800">{missingInvoice}</h3>
          </div>
        </Card>
      </div>

      {/* Orders Table */}
      <Card className="overflow-hidden p-0 shadow-sm">
        <div className="border-b border-border bg-slate-50/70 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Order Records</h2>
              <p className="text-xs text-slate-500">All customer shipments, order numbers, and billing state.</p>
            </div>
            <Badge tone="neutral">{orders.length} orders</Badge>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-slate-300" />
            <p className="mt-3 font-medium text-slate-600">No orders found</p>
            <p className="text-sm text-slate-400">Create a new customer order to get started.</p>
            <Link href="/dashboard/orders/new" className="mt-4">
              <Button variant="secondary" className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create Order
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Order Number</th>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">Order Status</th>
                  <th className="px-6 py-3">Client Verification</th>
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">Total Amount</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => {
                  const invoice = order.invoices.at(0);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4 font-medium">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {order.items.length} item{order.items.length === 1 ? "" : "s"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{order.client.companyName}</div>
                        <div className="text-xs text-slate-500">{order.client.contactPerson}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={statusTone(order.verificationStatus)}>
                          {order.verificationStatus}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {invoice ? (
                          <div>
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {invoice.invoiceNumber}
                            </span>
                            <div className="text-xs text-slate-500">
                              {invoice.status} · {invoice.paymentStatus}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {money(order.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!invoice ? (
                          ["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "ACCOUNTANT"].includes(user.role) && (
                            <form action={quickGenerateInvoice} className="inline-block">
                              <input type="hidden" name="orderId" value={order.id} />
                              <Button
                                variant="secondary"
                                type="submit"
                                className="h-8 px-2.5 text-xs flex items-center gap-1.5"
                              >
                                <ReceiptText className="h-3.5 w-3.5" />
                                Generate Invoice
                              </Button>
                            </form>
                          )
                        ) : (
                          <Link href={`/dashboard/orders/${order.id}`}>
                            <Button
                              variant="ghost"
                              className="h-8 px-2.5 text-xs flex items-center gap-1"
                            >
                              View Details <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
