import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchInvoices,
  recordInvoicePayment,
  uploadPaymentProof,
  attachPaymentProof,
  getPaymentProofUrl
} from "@/lib/services";
import { supabase } from "@/lib/supabase";
import { Invoice, Payment } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  CircleDollarSign,
  FileText,
  CreditCard,
  FileSpreadsheet,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle
} from "lucide-react";

export const AccountingPage: React.FC = () => {
  const { tenant, user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment Recording Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("NEFT / RTGS");
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await fetchInvoices(tenant?.id, user?.clientId || user?.client?.id, role, user?.id);
      setInvoices(list);
    } catch (err) {
      console.error("Error loading accounting data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id, user?.clientId, user?.client?.id]);

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  const handleViewProof = async (paymentId: string) => {
    try {
      const signedUrl = await getPaymentProofUrl(
        paymentId,
        tenant?.id || "",
        user?.clientId || user?.client?.id,
        role
      );
      if (signedUrl) {
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } else {
        setPaymentError("Unable to access payment proof. Signed URL could not be generated.");
      }
    } catch (err) {
      console.error("Error opening proof:", err);
      setPaymentError("Failed to open payment proof.");
    }
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || isSubmittingPayment) return;
    setIsSubmittingPayment(true);
    setPaymentError(null);
    setSuccessMsg(null);

    const invoiceId = selectedInvoice.id;
    const tenantId = selectedInvoice.tenantId || tenant?.id || "";

    try {
      // 1. Record payment using existing service/RPC
      const res = await recordInvoicePayment(
        invoiceId,
        paymentAmount,
        paymentMethod,
        paymentRef || undefined,
        undefined, // proofUrl will be set after upload if file selected
        user?.id,
        role
      );

      const paymentId = res?.paymentId;

      // 2. If a proof file was selected, upload and attach it
      if (selectedFile && paymentId && tenantId) {
        let storagePath = "";
        try {
          storagePath = await uploadPaymentProof(
            invoiceId,
            paymentId,
            selectedFile,
            tenantId
          );
        } catch (uploadErr: any) {
          console.error("Proof upload error:", uploadErr);
          setPaymentError(
            `Payment recorded, but proof upload failed: ${uploadErr?.message || "Upload error"}`
          );
          await loadData();
          setIsSubmittingPayment(false);
          return;
        }

        // 3. Attach proofUrl to Payment record with tenant/invoice scoping
        try {
          await attachPaymentProof(paymentId, invoiceId, tenantId, storagePath);
        } catch (attachErr: any) {
          console.error("Proof attach error:", attachErr);
          // Clean up the uploaded storage file so orphaned file does not linger
          try {
            await supabase.storage.from("payment-proofs").remove([storagePath]);
          } catch (cleanupErr) {
            console.warn("Failed to clean up storage file after attach failure:", cleanupErr);
          }
          setPaymentError("Payment was recorded, but the payment proof could not be attached.");
          await loadData();
          setIsSubmittingPayment(false);
          return;
        }
      }

      setIsPaymentOpen(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccessMsg(
        `Payment of ₹${paymentAmount.toLocaleString("en-IN")} recorded for ${selectedInvoice.invoiceNumber}!`
      );
      await loadData();
    } catch (err: any) {
      setPaymentError(err?.message || "Failed to record payment");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Flatten all payments
  const allPayments: Array<Payment & { invoiceNumber?: string; clientName?: string }> = [];
  invoices.forEach((inv) => {
    (inv.payments || []).forEach((p) => {
      allPayments.push({
        ...p,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client?.companyName
      });
    });
  });

  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.total), 0);
  const totalCollected = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOutstanding = Math.max(0, totalInvoiced - totalCollected);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Accounting & Invoices</h1>
          <p className="text-sm text-slate-400">
            GST invoices, automated tax calculations, payments, and document imports.
          </p>
        </div>

        {["WAREHOUSE_OWNER", "ACCOUNTANT", "ACCOUNTS_TEAM", "PLATFORM_ADMIN"].includes(role) && (
          <Button
            onClick={() => {
              const payableUnpaid = invoices.find(
                (i) => i.paymentStatus !== "PAID" && Boolean(i.order?.deliveryVerifiedAt)
              );
              const unpaid = payableUnpaid || invoices.find((i) => i.paymentStatus !== "PAID");
              if (unpaid) {
                setSelectedInvoice(unpaid);
                setPaymentAmount(Number(unpaid.total));
              }
              setIsPaymentOpen(true);
            }}
            className="gap-1.5 self-start sm:self-auto"
          >
            <CreditCard className="w-4 h-4" /> Record Payment
          </Button>
        )}
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: "overview", label: "Overview", icon: CircleDollarSign },
          { id: "invoices", label: "Invoices", count: invoices.length, icon: FileText },
          { id: "payments", label: "Payments", count: allPayments.length, icon: CreditCard },
          { id: "imports", label: "Imports", icon: FileSpreadsheet }
        ]}
        activeTab={activeTab}
        onChange={handleTabChange}
      />

      {loading ? (
        <LoadingSpinner message="Calculating financials..." />
      ) : activeTab === "overview" ? (
        /* Overview Tab */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-indigo-900/40 bg-gradient-to-br from-indigo-950/40 to-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Total Invoiced
              </p>
              <p className="text-3xl font-bold text-white mt-1 font-mono">
                ₹{totalInvoiced.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-slate-500 mt-2">{invoices.length} invoices generated</p>
            </Card>

            <Card className="border-emerald-900/40 bg-gradient-to-br from-emerald-950/40 to-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Total Collected
              </p>
              <p className="text-3xl font-bold text-white mt-1 font-mono">
                ₹{totalCollected.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-slate-500 mt-2">{allPayments.length} recorded payments</p>
            </Card>

            <Card className="border-amber-900/40 bg-gradient-to-br from-amber-950/40 to-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Outstanding Balance
              </p>
              <p className="text-3xl font-bold text-white mt-1 font-mono">
                ₹{totalOutstanding.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                {invoices.filter((i) => i.paymentStatus !== "PAID").length} unpaid invoices
              </p>
            </Card>
          </div>

          <Card>
            <h2 className="text-base font-semibold text-white mb-4">Recent Invoices</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.slice(0, 5).map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-mono font-bold text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-xs">
                        {inv.client?.companyName}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-xs">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-white text-right">
                        ₹{Number(inv.total).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={inv.status} type="invoice" />
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={inv.paymentStatus} type="payment" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : activeTab === "invoices" ? (
        /* Invoices Tab */
        <Card className="p-0 overflow-hidden">
          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices found"
              description="Invoices are generated from verified commercial orders."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs uppercase font-semibold">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">CGST</th>
                    <th className="py-3 px-4 text-right">SGST</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 font-medium">
                        {inv.client?.companyName}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        ₹{Number(inv.subtotal).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400 text-xs">
                        ₹{Number(inv.cgst).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400 text-xs">
                        ₹{Number(inv.sgst).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        ₹{Number(inv.total).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={inv.status} type="invoice" />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={inv.paymentStatus} type="payment" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {inv.paymentStatus !== "PAID" && (
                          Boolean(inv.order?.deliveryVerifiedAt) ? (
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setPaymentAmount(Number(inv.total));
                                setIsPaymentOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 transition-colors cursor-pointer"
                            >
                              Pay
                            </button>
                          ) : (
                            <button
                              disabled
                              title="Payment is available after delivery verification."
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800/40 text-slate-500 border border-slate-700/40 cursor-not-allowed"
                            >
                              Pay
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : activeTab === "payments" ? (
        /* Payments Tab */
        <Card className="p-0 overflow-hidden">
          {allPayments.length === 0 ? (
            <EmptyState
              title="No payments recorded"
              description="Payments recorded against invoices will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs uppercase font-semibold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-white">
                        {p.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 text-xs">{p.clientName}</td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-200">
                        {p.method}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                        {p.reference || "—"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-right">
                        ₹{Number(p.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {p.proofUrl ? (
                          <button
                            type="button"
                            onClick={() => handleViewProof(p.id)}
                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer underline text-xs"
                          >
                            View Receipt <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        /* Imports Tab */
        <Card className="p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="p-4 bg-slate-800/50 rounded-2xl inline-block text-indigo-400">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white">Invoice PDF & CSV Import</h2>
            <p className="text-xs text-slate-400">
              Upload electronic supplier invoices or bills. Text extraction automatically parses
              line items, taxes, and matches existing SKUs.
            </p>
            <div className="p-4 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-900/50">
              <input
                type="file"
                accept=".pdf,.csv,.json"
                className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Record Payment Modal */}
      {isPaymentOpen && (
        <Modal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          title="Record Client Invoice Payment"
          description="Atomic payment transaction with balance settlement"
          maxWidth="md"
        >
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
            {paymentError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {paymentError}
              </div>
            )}

            {selectedInvoice && !Boolean(selectedInvoice.order?.deliveryVerifiedAt) && (
              <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-800 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Payment is available after delivery verification.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Target Invoice
              </label>
              <select
                value={selectedInvoice?.id || ""}
                onChange={(e) => {
                  const found = invoices.find((i) => i.id === e.target.value);
                  setSelectedInvoice(found || null);
                  if (found) setPaymentAmount(Number(found.total));
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                required
              >
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — {inv.client?.companyName} (₹{inv.total}) [
                    {inv.paymentStatus}]
                    {!inv.order?.deliveryVerifiedAt ? " — (Pending Delivery Verification)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono text-right"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="NEFT / RTGS">NEFT / RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="NetBanking">NetBanking</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Transaction Reference / UTR #
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. UTR20260904000123"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Payment Proof / Receipt
              </label>
              <p className="text-[11px] text-slate-400 mb-1.5">
                Optional — JPG, PNG or PDF, max 10 MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
                    const validExts = [".jpg", ".jpeg", ".png", ".pdf"];
                    const hasValidExt = validExts.some((ext) =>
                      file.name.toLowerCase().endsWith(ext)
                    );
                    if (!validTypes.includes(file.type) && !hasValidExt) {
                      setPaymentError("Please select a JPG, PNG, or PDF file.");
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      return;
                    }
                    if (file.size > 10 * 1024 * 1024) {
                      setPaymentError("File size exceeds 10 MB limit.");
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      return;
                    }
                    setPaymentError(null);
                    setSelectedFile(file);
                  } else {
                    setSelectedFile(null);
                  }
                }}
                disabled={isSubmittingPayment}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
              />
              {selectedFile && (
                <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-emerald-400">
                  <span className="truncate max-w-[280px]">Selected: {selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-slate-400 hover:text-rose-400 text-xs ml-2 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isSubmittingPayment}
                disabled={isSubmittingPayment || !Boolean(selectedInvoice?.order?.deliveryVerifiedAt)}
              >
                Confirm Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
