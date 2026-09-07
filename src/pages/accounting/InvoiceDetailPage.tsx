import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchInvoiceById, uploadPaymentProofFile, markInvoiceAsPaid } from "@/lib/services";
import { Invoice } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Building2,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  Upload,
  Check,
  ExternalLink,
  ShieldCheck,
  Truck,
  CreditCard
} from "lucide-react";

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [proofUrl, setProofUrl] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadInvoice = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fetchInvoiceById(id);
      setInvoice(data);
    } catch (err) {
      console.error("Error loading invoice:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setIsMarkingPaid(true);
    setActionError(null);
    setSuccessMsg(null);

    try {
      let finalProofUrl = proofUrl.trim();
      if (proofFile) {
        finalProofUrl = await uploadPaymentProofFile(proofFile, invoice.id);
      }

      if (!finalProofUrl) {
        setActionError("Please upload a payment proof receipt or enter a verification reference URL.");
        setIsMarkingPaid(false);
        return;
      }

      await markInvoiceAsPaid(invoice.id, finalProofUrl, user?.id);
      setSuccessMsg("Invoice settled! Status updated to PAID and payment record logged.");
      setProofFile(null);
      setProofUrl("");
      await loadInvoice();
    } catch (err: any) {
      setActionError(err?.message || "Failed to mark invoice as paid");
    } finally {
      setIsMarkingPaid(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Retrieving commercial tax invoice..." />;
  }

  if (!invoice) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-white">Invoice Not Found</h2>
        <p className="text-sm text-slate-400">
          The requested tax invoice could not be located in your organization records.
        </p>
        <Link to="/accounting/invoices">
          <Button variant="outline">Return to Invoices</Button>
        </Link>
      </div>
    );
  }

  const isVerified = invoice.order?.verificationStatus === "VERIFIED";
  const isPartiallyVerified = invoice.order?.verificationStatus === "PARTIALLY_VERIFIED";
  const canMarkPaid = invoice.paymentStatus !== "PAID" && role !== "CLIENT";

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* Top Action Bar (hidden on print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/accounting/invoices"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </Link>

        <div className="flex items-center gap-2">
          {invoice.orderId && (
            <Link to="/operations/orders/track">
              <Button variant="outline" size="sm" className="text-xs gap-1">
                <Truck className="w-3.5 h-3.5 text-indigo-400" /> Track Shipment
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="text-xs gap-1"
          >
            <Printer className="w-3.5 h-3.5" /> Print Tax Invoice
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2 print:hidden">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2 print:hidden">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Payment Settlement Card */}
      {canMarkPaid && (
        <Card className="p-4 border-indigo-900/50 bg-slate-900/80 print:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-400" /> Settle Invoice & Upload Payment Proof
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Record bank transfer transaction receipt to transition invoice to PAID.
              </p>
            </div>

            <form onSubmit={handleMarkPaid} className="flex w-full max-w-xl flex-col sm:flex-row items-end gap-2">
              <div className="flex-1 w-full space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Upload Receipt / Bank UTR URL
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-indigo-300 hover:file:bg-slate-700"
                  />
                  <input
                    type="text"
                    placeholder="Or enter UTR reference..."
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>
              </div>
              <Button type="submit" isLoading={isMarkingPaid} className="h-8 whitespace-nowrap text-xs">
                Mark as Paid
              </Button>
            </form>
          </div>
        </Card>
      )}

      {invoice.paymentStatus === "PAID" && (
        <Card className="p-4 border-emerald-900/40 bg-emerald-950/20 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Payment Settled
              </span>
              <p className="text-xs text-slate-300 mt-0.5">
                This invoice has been reconciled and paid in full.
              </p>
            </div>
            {invoice.payments && invoice.payments.length > 0 && invoice.payments[0].proofUrl && (
              <a
                href={invoice.payments[0].proofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1"
              >
                View Payment Proof Document <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </Card>
      )}

      {/* Printable Tax Invoice Document */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-8 md:p-12 shadow-xl text-slate-100 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        {/* Header: Company Letterhead & Invoice Meta */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-800 print:border-slate-300 pb-8">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800 print:border-none">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white print:text-black">
                  {invoice.tenant?.name || "Warevo Logistics Enterprise"}
                </h1>
                <div className="text-xs text-slate-400 print:text-slate-600">Commercial Warehouse & Distribution</div>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-400 print:text-slate-600 space-y-0.5">
              <div>{invoice.tenant?.address || "Logistics Hub, Industrial Corridor"}</div>
              <div>
                GSTIN: <span className="font-mono font-semibold text-slate-200 print:text-black">{invoice.tenant?.gstNumber || "29ABCDE1234F1Z5"}</span>
              </div>
              <div>Email: ops@warevo.test · Support: +91 99000 00001</div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="inline-block rounded bg-indigo-950/80 border border-indigo-800 text-indigo-300 print:bg-slate-100 print:text-black px-3 py-1 text-xs font-bold uppercase tracking-wider">
              Tax Invoice
            </div>
            <div className="mt-2 font-mono text-xl font-bold text-indigo-400 print:text-black">
              {invoice.invoiceNumber}
            </div>
            <div className="mt-1 text-xs text-slate-400 print:text-slate-600">
              Date: <span className="font-semibold text-slate-200 print:text-black">{new Date(invoice.invoiceDate).toLocaleDateString()}</span>
            </div>
            {invoice.order?.orderNumber && (
              <div className="text-xs text-slate-400 print:text-slate-600">
                Ref Order: <span className="font-mono font-semibold text-slate-200 print:text-black">{invoice.order.orderNumber}</span>
              </div>
            )}
            <div className="mt-2 flex sm:justify-end gap-2">
              <StatusBadge status={invoice.status} type="invoice" />
              <StatusBadge status={invoice.paymentStatus} type="invoice" />
            </div>
          </div>
        </div>

        {/* Bill To & Ship To */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 py-6 border-b border-slate-800 print:border-slate-300 text-xs">
          <div>
            <span className="font-semibold uppercase tracking-wider text-slate-400 print:text-slate-600">
              Billed To (Customer):
            </span>
            <div className="mt-1 font-bold text-sm text-white print:text-black">
              {invoice.client?.companyName}
            </div>
            <div className="text-slate-300 print:text-slate-700 mt-1">
              {invoice.client?.billingAddress}
            </div>
            <div className="text-slate-400 print:text-slate-600">
              Contact: {invoice.client?.contactPerson} ({invoice.client?.mobile})
            </div>
            {invoice.client?.gstNumber && (
              <div className="text-slate-400 print:text-slate-600 font-mono mt-0.5">
                GSTIN: {invoice.client.gstNumber}
              </div>
            )}
          </div>

          <div>
            <span className="font-semibold uppercase tracking-wider text-slate-400 print:text-slate-600">
              Shipment Destination:
            </span>
            <div className="mt-1 font-bold text-sm text-white print:text-black">
              {invoice.client?.companyName}
            </div>
            <div className="text-slate-300 print:text-slate-700 mt-1">
              {invoice.client?.shippingAddress || invoice.client?.billingAddress}
            </div>
            <div className="text-slate-400 print:text-slate-600 mt-1">
              Place of Supply: Inter-State / Intra-State (GST Slabs Applied)
            </div>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 print:border-slate-300 text-[10px] font-semibold uppercase text-slate-400 print:text-slate-600">
              <tr>
                <th className="py-2.5">#</th>
                <th className="py-2.5">Item Description & SKU</th>
                <th className="py-2.5 text-center">Qty</th>
                <th className="py-2.5 text-right">Unit Rate (₹)</th>
                <th className="py-2.5 text-right">CGST (₹)</th>
                <th className="py-2.5 text-right">SGST (₹)</th>
                <th className="py-2.5 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
              {invoice.items?.map((item, index) => (
                <tr key={item.id}>
                  <td className="py-3 text-slate-500 print:text-slate-600 font-mono">{index + 1}</td>
                  <td className="py-3">
                    <div className="font-semibold text-white print:text-black">{item.product?.name || "Product"}</div>
                    <div className="font-mono text-[10px] text-slate-400 print:text-slate-600">{item.product?.sku}</div>
                  </td>
                  <td className="py-3 text-center font-medium text-slate-200 print:text-black">
                    {item.quantity} {item.product?.unit || "PCS"}
                  </td>
                  <td className="py-3 text-right font-mono text-slate-300 print:text-black">
                    ₹{Number(item.rate).toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-mono text-slate-400 print:text-slate-600">
                    ₹{Number(item.cgst).toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-mono text-slate-400 print:text-slate-600">
                    ₹{Number(item.sgst).toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-white print:text-black">
                    ₹{Number(item.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Official Verification Stamp */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 pt-6 border-t border-slate-800 print:border-slate-300">
          {/* Delivery Verification Stamp */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 print:text-slate-600 mb-2">
              Official Delivery Verification Stamp:
            </div>

            {isVerified ? (
              <div className="rounded-xl border-2 border-emerald-600 bg-emerald-950/40 print:bg-emerald-50 p-4 text-emerald-200 print:text-emerald-900 inline-block max-w-sm">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-400 print:text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  OFFICIALLY VERIFIED & ACCEPTED
                </div>
                <p className="text-[11px] text-emerald-300 print:text-emerald-700 mt-1">
                  Goods inspected, quantities cross-checked, and packaging seals verified intact by authorized client receiver.
                </p>
                {invoice.order?.verification?.comments && (
                  <div className="mt-2 text-[11px] text-slate-400 print:text-slate-600 italic border-t border-emerald-800/60 print:border-emerald-200 pt-1">
                    "{invoice.order.verification.comments}"
                  </div>
                )}
              </div>
            ) : isPartiallyVerified ? (
              <div className="rounded-xl border-2 border-amber-500 bg-amber-950/40 print:bg-amber-50 p-4 text-amber-200 print:text-amber-900 inline-block max-w-sm">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-400 print:text-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  PARTIALLY VERIFIED DELIVERY
                </div>
                <p className="text-[11px] text-amber-300 print:text-amber-700 mt-1">
                  Delivery received with recorded variance or damage noted during inspection.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 print:border-slate-300 bg-slate-800/40 print:bg-slate-50 p-4 text-slate-400 print:text-slate-600 inline-block max-w-sm">
                <div className="flex items-center gap-2 font-semibold text-xs text-slate-300 print:text-slate-700">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Delivery Verification Pending
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Cargo checklist inspection awaiting confirmation at client receiving dock.
                </p>
              </div>
            )}
          </div>

          {/* Calculations Summary */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400 print:text-slate-600">
              <span>Subtotal (Tax Exclusive):</span>
              <span className="font-semibold text-slate-200 print:text-black">
                ₹{Number(invoice.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-slate-400 print:text-slate-600">
              <span>CGST Total:</span>
              <span>₹{Number(invoice.cgst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-400 print:text-slate-600">
              <span>SGST Total:</span>
              <span>₹{Number(invoice.sgst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            {Number(invoice.discountTotal) > 0 && (
              <div className="flex justify-between text-emerald-400 print:text-emerald-700">
                <span>Discount:</span>
                <span>-₹{Number(invoice.discountTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-800 print:border-slate-300 pt-2 text-base font-bold text-white print:text-black">
              <span>Grand Total (INR):</span>
              <span className="font-mono text-indigo-400 print:text-black">
                ₹{Number(invoice.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Signatures Footer */}
        <div className="grid grid-cols-2 gap-8 pt-12 text-xs text-slate-400 print:text-slate-600">
          <div>
            <div className="border-t border-slate-700 print:border-slate-300 pt-2 font-semibold">
              Authorized Signatory (Warehouse Dispatch)
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Warevo Logistics Enterprise</p>
          </div>
          <div className="text-right">
            <div className="border-t border-slate-700 print:border-slate-300 pt-2 font-semibold">
              Receiver Seal & Signature
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">{invoice.client?.companyName}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
