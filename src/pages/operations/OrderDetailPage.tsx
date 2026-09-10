import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchOrderById,
  transitionOrderStatus,
  submitOrderVerification,
  generateInvoiceRecord
} from "@/lib/services";
import { Order, OrderStatus, VerificationStatus } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { validOrderTransitions } from "@/lib/orderWorkflow";
import {
  ArrowLeft,
  Calendar,
  User,
  Building,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Send
} from "lucide-react";

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verification Modal
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<VerificationStatus>("VERIFIED");
  const [verifyComments, setVerifyComments] = useState("");
  const [checklist, setChecklist] = useState([
    { text: "Correct product received", checked: true },
    { text: "Correct quantity received", checked: true },
    { text: "Product condition acceptable", checked: true },
    { text: "Packaging acceptable", checked: true },
    { text: "No visible damage", checked: true },
    { text: "Required delivery documents received", checked: true },
    { text: "Delivery details correct", checked: true }
  ]);
  const [isVerifying, setIsVerifying] = useState(false);

  // Invoice Generation
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadOrder = async () => {
    if (!id) return;
    try {
      setLoading(true);
      // SECURITY: Pass tenantId, clientId, and role to verify client ownership
      const data = await fetchOrderById(
        id,
        user?.tenant?.id,
        user?.client?.id,
        role
      );
      setOrder(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setIsVerifying(true);
    setInvoiceMessage(null);

    try {
      await submitOrderVerification(
        order.id,
        verifyStatus,
        checklist,
        verifyComments,
        null,
        user?.id
      );
      setIsVerifyOpen(false);
      setInvoiceMessage({ type: "success", text: "Verification successfully submitted!" });
      await loadOrder();
    } catch (err: any) {
      setInvoiceMessage({ type: "error", text: err?.message || "Verification submission failed" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGenerateInvoice = async (isFinal: boolean) => {
    if (!order) return;
    setIsGeneratingInvoice(true);
    setInvoiceMessage(null);

    try {
      const res = await generateInvoiceRecord(order.id, isFinal, user?.id, role);
      setInvoiceMessage({
        type: "success",
        text: `Successfully generated ${isFinal ? "Final" : "Draft"} Invoice ${res.invoiceNumber}!`
      });
      await loadOrder();
    } catch (err: any) {
      setInvoiceMessage({
        type: "error",
        text: err?.message || "Failed to generate invoice."
      });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading order details and timeline..." />;
  if (!order) {
    return (
      <div className="p-6 text-center">
        <p className="text-rose-400">Order not found.</p>
        <Link to="/operations/orders" className="mt-4 inline-block text-indigo-400">
          ← Back to Orders
        </Link>
      </div>
    );
  }

  const canVerify =
    ["RECEIVED", "VERIFICATION_PENDING", "DISPATCHED"].includes(order.status) &&
    (role === "CLIENT" || role === "PRODUCT_RECEIVER");

  const canGenerateInvoice =
    ["WAREHOUSE_OWNER", "ACCOUNTANT", "ACCOUNTS_TEAM", "PLATFORM_ADMIN"].includes(role);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/operations/orders"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      {/* Invoice alert message */}
      {invoiceMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            invoiceMessage.type === "success"
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
              : "bg-rose-950/60 border-rose-800 text-rose-300"
          }`}
        >
          {invoiceMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{invoiceMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                {order.orderNumber}
              </h1>
              <StatusBadge status={order.status} type="order" />
              <StatusBadge status={order.verificationStatus} type="verification" />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-400" />
                Created: {new Date(order.createdAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5">
                <Building className="w-4 h-4 text-indigo-400" />
                Client: {order.client?.companyName}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-400" />
                Contact: {order.client?.contactPerson} ({order.client?.mobile})
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canVerify && (
              <Button
                variant="primary"
                onClick={() => setIsVerifyOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Submit Verification
              </Button>
            )}

            {canGenerateInvoice && order.status !== "INVOICED" && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleGenerateInvoice(false)}
                  isLoading={isGeneratingInvoice}
                >
                  <FileText className="w-4 h-4 mr-1.5" /> Draft Invoice
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleGenerateInvoice(true)}
                  isLoading={isGeneratingInvoice}
                  title={
                    order.verificationStatus !== "VERIFIED"
                      ? "Final invoice requires VERIFIED delivery status"
                      : undefined
                  }
                >
                  <Send className="w-4 h-4 mr-1.5" /> Final Invoice
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Grid: Order Items & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Line Items (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-white mb-4">Order Line Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">GST</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(order.items || []).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-white text-xs">
                          {item.product?.name || "Product Item"}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">
                          SKU: {item.product?.sku || "N/A"}
                        </p>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-200 text-right">
                        {item.quantity} {item.product?.unit || "pcs"}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-200 text-right">
                        ₹{Number(item.unitPrice).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 text-right text-xs">
                        {item.taxRate}%
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-white text-right">
                        ₹{Number(item.total).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <div className="w-64 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-200">
                    ₹{Number(order.subtotal).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax (GST)</span>
                  <span className="font-mono text-slate-200">
                    ₹{Number(order.taxTotal).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Discount</span>
                  <span className="font-mono text-slate-200">
                    ₹{Number(order.discountTotal).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                  <span>Grand Total</span>
                  <span className="font-mono text-indigo-400">
                    ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Delivery Verification Responses if completed */}
          {order.verification && (
            <Card className="border-emerald-900/40 bg-emerald-950/10">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">Client Delivery Verification Record</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Verified on {new Date(order.verification.createdAt).toLocaleString()} by client.
              </p>
              {order.verification.comments && (
                <p className="text-xs text-slate-200 bg-slate-900/60 p-3 rounded-lg border border-slate-800 mb-3">
                  <span className="font-semibold text-slate-400">Notes:</span>{" "}
                  {order.verification.comments}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {order.verification.responses?.map((resp, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{resp.text}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Order Status History Timeline (1 col) */}
        <div>
          <Card>
            <h2 className="text-base font-semibold text-white mb-4">Status History Timeline</h2>
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {(order.statusHistory || []).map((history, idx) => (
                <div key={history.id || idx} className="relative">
                  <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-slate-900" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">
                        {history.newStatus}
                      </span>
                      {history.previousStatus && (
                        <span className="text-[10px] text-slate-500">
                          (from {history.previousStatus})
                        </span>
                      )}
                    </div>
                    {history.notes && (
                      <p className="text-xs text-slate-400 mt-1 italic">"{history.notes}"</p>
                    )}
                    <span className="text-[10px] text-slate-500 block mt-1">
                      {new Date(history.createdAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Verification Submission Modal */}
      {isVerifyOpen && (
        <Modal
          isOpen={isVerifyOpen}
          onClose={() => setIsVerifyOpen(false)}
          title="Submit Delivery Verification"
          description={`Order ${order.orderNumber} Delivery Inspection Checklist`}
          maxWidth="lg"
        >
          <form onSubmit={handleVerificationSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Inspection Outcome
              </label>
              <select
                value={verifyStatus}
                onChange={(e) => setVerifyStatus(e.target.value as VerificationStatus)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="VERIFIED">VERIFIED — Goods match specifications</option>
                <option value="PARTIALLY_VERIFIED">PARTIALLY VERIFIED — Discrepancies noted</option>
                <option value="REJECTED">REJECTED — Goods damaged or incorrect</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Mandatory Inspection Checklist
              </label>
              <div className="space-y-2">
                {checklist.map((item, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer border border-slate-700/60"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => {
                        const newChecklist = [...checklist];
                        newChecklist[idx].checked = e.target.checked;
                        setChecklist(newChecklist);
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs text-slate-200">{item.text}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Verification Comments / Evidence Details
              </label>
              <textarea
                value={verifyComments}
                onChange={(e) => setVerifyComments(e.target.value)}
                placeholder="Details of delivery inspection..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsVerifyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isVerifying}>
                Confirm & Record Verification
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
