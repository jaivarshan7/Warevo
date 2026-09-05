import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchInvoices, recordInvoicePayment } from "@/lib/services";
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
  AlertCircle
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
  const [proofUrl, setProofUrl] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await fetchInvoices(tenant?.id, user?.client?.id);
      setInvoices(list);
    } catch (err) {
      console.error("Error loading accounting data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id, user?.client?.id]);

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setIsSubmittingPayment(true);
    setPaymentError(null);
    setSuccessMsg(null);

    try {
      await recordInvoicePayment(
        selectedInvoice.id,
        paymentAmount,
        paymentMethod,
        paymentRef,
        proofUrl || undefined,
        user?.id,
        role
      );
      setIsPaymentOpen(false);
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
              const unpaid = invoices.find((i) => i.paymentStatus !== "PAID");
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
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPaymentAmount(Number(inv.total));
                              setIsPaymentOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 transition-colors"
                          >
                            Pay
                          </button>
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
                          <a
                            href={p.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                          >
                            View Receipt <ExternalLink className="w-3 h-3" />
                          </a>
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
                Payment Proof / Receipt URL (Optional)
              </label>
              <input
                type="url"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://... receipt image or document"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmittingPayment}>
                Confirm Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
