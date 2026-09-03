import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { 
  Building2, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Download,
  Mail,
  Phone
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InvoiceActions } from "@/components/invoice-actions";
import { requireDashboardRoute, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStorageBucket, storageBuckets, validateFileUpload } from "@/lib/storage";
import { notifyOrderAudience } from "@/lib/notifications-server";
import { money, statusTone } from "@/lib/utils";
import { InvoiceStatus, PaymentStatus } from "@prisma/client";

async function markInvoicePaid(formData: FormData) {
  "use server";

  const invoiceId = String(formData.get("invoiceId") ?? "");
  const proofUrl = String(formData.get("proofUrl") ?? "").trim();
  const proofFile = formData.get("proofFile");
  const user = await requireUser(["ACCOUNTANT", "CLIENT_ACCOUNTANT", "WAREHOUSE_OWNER", "PLATFORM_ADMIN"]);

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: true,
      client: { select: { companyName: true, companyGroupId: true } },
    },
  });

  const linkedClient = user.role === "CLIENT_ACCOUNTANT"
    ? await prisma.client.findFirst({
        where: { userId: user.id, tenantId: user.tenantId ?? "" },
        select: { companyName: true, companyGroupId: true },
      })
    : null;
  const canPayInvoice = user.role !== "CLIENT_ACCOUNTANT"
    ? true
    : Boolean(
        linkedClient &&
        (invoice?.client.companyName === linkedClient.companyName ||
          (linkedClient.companyGroupId && invoice?.client.companyGroupId === linkedClient.companyGroupId)),
      );

  if (!invoice || (user.role !== "PLATFORM_ADMIN" && invoice.tenantId !== user.tenantId) || !canPayInvoice) {
    throw new Error("Invoice not found or unauthorized.");
  }

  let finalProofUrl = proofUrl;
  if (proofFile instanceof File && proofFile.size > 0) {
    validateFileUpload(proofFile, ["application/pdf", "image/jpeg", "image/png", "image/webp"]);
    const supabase = await ensureStorageBucket(storageBuckets.invoices);
    const extension = proofFile.name.split(".").pop() ?? "bin";
    const fileName = `payment-proofs/${invoice.id}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from(storageBuckets.invoices).upload(fileName, proofFile, {
      upsert: false,
      contentType: proofFile.type,
    });
    if (error) throw error;
    finalProofUrl = supabase.storage.from(storageBuckets.invoices).getPublicUrl(fileName).data.publicUrl;
  }

  if (!finalProofUrl) {
    throw new Error("Upload payment proof or enter a payment proof URL before marking this invoice as paid.");
  }

  await prisma.payment.create({
    data: {
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      amount: invoice.total,
      status: PaymentStatus.PAID,
      method: "BANK_TRANSFER",
      reference: `CLIENT-PAID-${invoice.invoiceNumber}`,
      proofUrl: finalProofUrl,
      paidAt: new Date(),
    },
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      paymentStatus: PaymentStatus.PAID,
      status: InvoiceStatus.FINAL,
      finalizedAt: new Date(),
    },
  });

  await notifyOrderAudience({
    tenantId: invoice.tenantId,
    clientId: invoice.clientId,
    orderId: invoice.orderId,
    type: "PAYMENT_RECEIVED",
    title: "Invoice payment received",
    message: `${invoice.invoiceNumber} was marked as paid with payment proof uploaded.`,
    priority: "high",
    actionUrl: `/dashboard/invoices/${invoice.id}`,
    excludeUserId: user.id,
  });

  revalidatePath("/dashboard/accounting");
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  redirect(`/dashboard/invoices/${invoice.id}`);
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireDashboardRoute("/dashboard/orders");
  const linkedClient = user.role === "CLIENT_ACCOUNTANT"
    ? await prisma.client.findFirst({
        where: { userId: user.id, tenantId: user.tenantId ?? "" },
        select: { companyName: true, companyGroupId: true },
      })
    : null;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      tenant: true,
      order: {
        include: {
          verification: true,
          assignedStaff: true,
        },
      },
      items: {
        include: {
          product: true,
        },
      },
      payments: true,
    },
  });

  const canViewInvoice = user.role !== "CLIENT_ACCOUNTANT"
    ? true
    : Boolean(
        linkedClient &&
        (invoice?.client.companyName === linkedClient.companyName ||
          (linkedClient.companyGroupId && invoice?.client.companyGroupId === linkedClient.companyGroupId)),
      );

  if (!invoice || (user.role !== "PLATFORM_ADMIN" && invoice.tenantId !== user.tenantId) || !canViewInvoice) {
    notFound();
  }

  const isVerified = invoice.order.verificationStatus === "VERIFIED";
  const isPartiallyVerified = invoice.order.verificationStatus === "PARTIALLY_VERIFIED";

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* Top Action Bar (hidden on print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/accounting"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Accounting
        </Link>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/orders/track`}>
            <Button variant="secondary" className="text-xs h-9">
              Track & Verify Order
            </Button>
          </Link>
          <InvoiceActions />
        </div>
      </div>

      {invoice.paymentStatus !== "PAID" && ["ACCOUNTANT", "CLIENT_ACCOUNTANT", "WAREHOUSE_OWNER", "PLATFORM_ADMIN"].includes(user.role) && (
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Mark as paid</h2>
              <p className="text-sm text-slate-500">Enter the payment proof URL and confirm the invoice is settled.</p>
            </div>
            <form action={markInvoicePaid} encType="multipart/form-data" className="flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <div className="flex-1">
                <label htmlFor="proofFile" className="mb-1 block text-xs font-semibold text-slate-700">Upload payment proof</label>
                <input id="proofFile" name="proofFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="h-10 w-full rounded border border-border bg-slate-50 px-3 py-2 text-xs focus:border-primary focus:bg-white focus:outline-none" />
                <label htmlFor="proofUrl" className="sr-only">Payment proof URL</label>
                <input
                  id="proofUrl"
                  name="proofUrl"
                  type="url"
                  placeholder="Or paste proof URL"
                  className="mt-2 h-9 w-full rounded border border-border bg-slate-50 px-3 text-xs focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>
              <Button type="submit" className="h-10 whitespace-nowrap">Paid</Button>
            </form>
          </div>
        </Card>
      )}

      {invoice.paymentStatus === "PAID" && (
        <Card className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment proof</div>
              <div className="text-sm text-slate-600">This invoice has been marked as paid.</div>
            </div>
            <div className="flex-1 sm:max-w-xl">
              <a
                href={invoice.payments.at(-1)?.proofUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex break-all text-sm font-medium text-primary underline underline-offset-2"
              >
                {invoice.payments.at(-1)?.proofUrl || "No payment proof URL recorded"}
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* Printable Invoice Sheet */}
      <div className="rounded-xl border border-border bg-white p-8 md:p-12 shadow-sm text-slate-900 print:border-none print:shadow-none print:p-0">
        {/* Header: Company Letterhead & Invoice Meta */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-border pb-8">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {invoice.tenant?.name || "Warevo Logistics"}
                </h1>
                <div className="text-xs text-slate-500">Commercial Warehouse & Distribution</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-0.5">
              <div>{invoice.tenant?.address || "Logistics Hub, Industrial Area"}</div>
              <div>GSTIN: <span className="font-mono font-semibold">{invoice.tenant?.gstNumber || "29ABCDE1234F1Z5"}</span></div>
              <div>Email: {invoice.tenant?.email || "ops@warevo.test"} · Phone: {invoice.tenant?.phone || "+91 99000 00001"}</div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="inline-block rounded bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-700">
              Tax Invoice
            </div>
            <div className="mt-2 font-mono text-xl font-bold text-primary">
              {invoice.invoiceNumber}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Date: <span className="font-semibold text-slate-700">{new Date(invoice.invoiceDate).toLocaleDateString()}</span>
            </div>
            <div className="text-xs text-slate-500">
              Ref Order: <span className="font-mono font-semibold text-slate-700">{invoice.order.orderNumber}</span>
            </div>
            <div className="mt-2 flex sm:justify-end gap-2">
              <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge>
              <Badge tone={statusTone(invoice.paymentStatus)}>{invoice.paymentStatus}</Badge>
            </div>
          </div>
        </div>

        {/* Bill To & Ship To */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 py-6 border-b border-border text-xs">
          <div>
            <span className="font-semibold uppercase tracking-wider text-slate-400">Billed To (Client):</span>
            <div className="mt-1 font-bold text-sm text-slate-900">{invoice.client.companyName}</div>
            <div className="text-slate-600 mt-1">{invoice.client.billingAddress}</div>
            <div className="text-slate-600">Contact: {invoice.client.contactPerson} ({invoice.client.mobile})</div>
            {invoice.client.gstNumber && (
              <div className="text-slate-600 font-mono mt-0.5">GSTIN: {invoice.client.gstNumber}</div>
            )}
          </div>

          <div>
            <span className="font-semibold uppercase tracking-wider text-slate-400">Shipment Destination:</span>
            <div className="mt-1 font-bold text-sm text-slate-900">{invoice.client.companyName}</div>
            <div className="text-slate-600 mt-1">{invoice.client.shippingAddress}</div>
            <div className="text-slate-600 mt-1">
              Delivery Date: {invoice.order.expectedDelivery ? new Date(invoice.order.expectedDelivery).toLocaleDateString() : "As scheduled"}
            </div>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-300 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="py-2.5">#</th>
                <th className="py-2.5">Item & SKU</th>
                <th className="py-2.5 text-center">Qty</th>
                <th className="py-2.5 text-right">Unit Rate (₹)</th>
                <th className="py-2.5 text-right">CGST (₹)</th>
                <th className="py-2.5 text-right">SGST (₹)</th>
                <th className="py-2.5 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="py-3 text-slate-400 font-mono">{index + 1}</td>
                  <td className="py-3">
                    <div className="font-semibold text-slate-900">{item.product.name}</div>
                    <div className="font-mono text-[10px] text-slate-500">{item.product.sku}</div>
                  </td>
                  <td className="py-3 text-center font-medium">{item.quantity} {item.product.unit}</td>
                  <td className="py-3 text-right">{money(item.rate)}</td>
                  <td className="py-3 text-right text-slate-600">{money(item.cgst)}</td>
                  <td className="py-3 text-right text-slate-600">{money(item.sgst)}</td>
                  <td className="py-3 text-right font-semibold text-slate-900">{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Official Verification Stamp */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 pt-6 border-t border-border">
          {/* Delivery Verification Stamp */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Delivery Verification Record:
            </div>

            {isVerified ? (
              <div className="rounded-lg border-2 border-emerald-600 bg-emerald-50/50 p-4 text-emerald-900 inline-block max-w-sm">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  CLIENT DELIVERY VERIFIED
                </div>
                <p className="text-[11px] text-emerald-700 mt-1">
                  Goods inspected, quantities cross-checked, and packaging seals verified intact by client receiving representative.
                </p>
                {invoice.order.verification?.comments && (
                  <div className="mt-2 text-[11px] text-slate-600 italic border-t border-emerald-200 pt-1">
                    "{invoice.order.verification.comments}"
                  </div>
                )}
              </div>
            ) : isPartiallyVerified ? (
              <div className="rounded-lg border-2 border-amber-500 bg-amber-50/50 p-4 text-amber-900 inline-block max-w-sm">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  PARTIALLY VERIFIED DELIVERY
                </div>
                <p className="text-[11px] text-amber-700 mt-1">
                  Delivery received with recorded variance / shortage noted by receiver.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-slate-600 inline-block max-w-sm">
                <div className="flex items-center gap-2 font-semibold text-xs text-slate-700">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Delivery Verification Pending
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Client checklist inspection pending at delivery location.
                </p>
              </div>
            )}
          </div>

          {/* Calculations Summary */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal (Tax Exclusive):</span>
              <span className="font-semibold">{money(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>CGST Total:</span>
              <span>{money(invoice.cgst)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>SGST Total:</span>
              <span>{money(invoice.sgst)}</span>
            </div>
            {Number(invoice.discountTotal) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span>-{money(invoice.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold text-slate-900">
              <span>Grand Total (INR):</span>
              <span className="text-primary font-mono">{money(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer Notes & Authorized Signatory */}
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-end text-[11px] text-slate-500 gap-4">
          <div>
            <div className="font-semibold text-slate-700">Terms & Conditions:</div>
            <div>1. Payment is due as per agreed commercial credit terms.</div>
            <div>2. Discrepancies must be recorded during digital delivery verification.</div>
          </div>

          <div className="text-center sm:text-right">
            <div className="h-10 border-b border-slate-400 w-48 mb-1" />
            <div className="font-semibold text-slate-800">Authorized Signatory</div>
            <div className="text-[10px] text-slate-400">{invoice.tenant?.name || "Warevo"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
