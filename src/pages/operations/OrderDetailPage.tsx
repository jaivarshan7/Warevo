import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchOrderById,
  transitionOrderStatus,
  submitOrderVerification,
  isClientRole
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
  Clock
} from "lucide-react";

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role, tenant } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verification Modal - Individual Item Checkboxes
  const [itemCheckboxes, setItemCheckboxes] = useState<Record<string, boolean>>({});
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<VerificationStatus>("VERIFIED");
  const [verifyComments, setVerifyComments] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Warehouse Transition
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Generic action message state for verification/dispatch feedback
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadOrder = async () => {
    if (!id) return;
    try {
      setLoading(true);
      // SECURITY: Pass tenantId, clientId, and role to verify client ownership
      const data = await fetchOrderById(
        id,
        tenant?.id || user?.tenantId,
        user?.clientId || user?.client?.id,
        role,
        user?.id
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

  const totalItems = order?.items?.length || 0;
  const verifiedCount = order?.items?.filter((item) => itemCheckboxes[item.id]).length || 0;
  const allItemsChecked = totalItems > 0 && verifiedCount === totalItems;

  const handleToggleItemCheckbox = (itemId: string, checked: boolean) => {
    setItemCheckboxes((prev) => ({
      ...prev,
      [itemId]: checked,
    }));
  };

  const handleOpenVerifyModal = () => {
    if (!order || order.verificationStatus === "VERIFIED") return;
    const initial: Record<string, boolean> = {};
    order.items?.forEach((item) => {
      initial[item.id] = false;
    });
    setItemCheckboxes(initial);
    setVerifyComments("");
    setVerifyStatus("VERIFIED");
    setIsVerifyOpen(true);
    setActionMessage(null);
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const currentEmpRole = user?.clientEmployee?.employeeRole || user?.client?.employeeRole;
    if (role === "CLIENT" && currentEmpRole !== "RECEIVER") {
      setActionMessage({
        type: "error",
        text: "Only client receivers can verify deliveries."
      });
      return;
    }

    if (order.status !== "DISPATCHED") {
      setActionMessage({
        type: "error",
        text: "Order must be dispatched before delivery verification."
      });
      setIsVerifyOpen(false);
      return;
    }

    if (!allItemsChecked) {
      setActionMessage({
        type: "error",
        text: `All ${totalItems} order items must be physically verified and checked before submission.`
      });
      return;
    }

    setActionMessage(null);
    setIsVerifying(true);

    try {
      const responses =
        order.items?.map((item) => ({
          text: `${item.product?.name || "Item"} (Ordered Qty: ${item.quantity}, Verified Qty: ${item.quantity})`,
          checked: itemCheckboxes[item.id] || false,
          orderItemId: item.id,
          orderedQty: item.quantity,
          verifiedQty: item.quantity,
        })) || [];

      await submitOrderVerification(
        order.id,
        verifyStatus,
        responses,
        verifyComments,
        null,
        user?.id
      );
      setIsVerifyOpen(false);
      setActionMessage({ type: "success", text: "Verification successfully submitted!" });
      await loadOrder();
    } catch (err: any) {
      const errMsg = err?.message || "";
      if (errMsg.includes("not ready for client verification")) {
        setActionMessage({
          type: "error",
          text: "Order must be dispatched before delivery verification."
        });
      } else {
        setActionMessage({ type: "error", text: errMsg || "Verification submission failed" });
      }
    } finally {
      setIsVerifying(false);
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

  // Only CLIENT role with employeeRole === "RECEIVER" can perform delivery verification
  const isClientReceiver =
    role === "CLIENT" &&
    (user?.clientEmployee?.employeeRole === "RECEIVER" ||
      user?.client?.employeeRole === "RECEIVER");

  const isTenantAuthorized =
    Boolean(order) && (!tenant?.id || order.tenantId === tenant.id);

  // Verification is allowed ONLY when:
  // - authenticated WMS role = CLIENT
  // - client.employeeRole = RECEIVER
  // - order status = DISPATCHED
  // - order belongs to the authenticated user's authorized tenant/company
  const canVerify =
    Boolean(order) &&
    isClientReceiver &&
    Boolean(user?.client?.id) &&
    isTenantAuthorized &&
    (order.status === "DISPATCHED");

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/operations/orders"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

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
                Contact: {order.client?.employees?.[0]?.contactPerson || order.client?.contactPerson || "N/A"} ({order.client?.employees?.[0]?.mobile || order.client?.mobile || "N/A"})
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canVerify && (
              <Button
                variant="primary"
                onClick={handleOpenVerifyModal}
                className="bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950 gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Verify Delivery Order
              </Button>
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
          title="Verify Delivery Order"
          description={`Order ${order.orderNumber} — Verify each delivered item below`}
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

            {/* Individual Item Verification Checkboxes */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Delivered Items Checklist
                </span>
                <span className="text-xs font-mono font-semibold text-indigo-400">
                  {verifiedCount} / {totalItems} items verified
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {order.items?.map((item) => {
                  const isChecked = Boolean(itemCheckboxes[item.id]);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItemCheckbox(item.id, !isChecked)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer select-none transition-all flex items-start gap-3 ${
                        isChecked
                          ? "bg-indigo-950/30 border-indigo-500/60 shadow-sm"
                          : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleItemCheckbox(item.id, e.target.checked);
                        }}
                        className="mt-0.5 w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <div className="flex-1 space-y-1">
                        <span className="font-semibold text-white block text-sm">
                          {item.product?.name || "Product Item"}
                        </span>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-0.5">
                          <div>
                            Ordered Qty: <strong className="text-slate-200 font-mono">{item.quantity}</strong> {item.product?.unit || "PCS"}
                          </div>
                          <div>
                            Verified Qty: <strong className="text-emerald-400 font-mono">{item.quantity}</strong> {item.product?.unit || "PCS"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Verification Progress:</span>
                <span className="font-mono font-semibold text-indigo-400">
                  {verifiedCount} / {totalItems} items verified
                </span>
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

            {!allItemsChecked && (
              <p className="text-[11px] text-amber-400">
                Every order item must be physically verified and checked before submitting verification.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsVerifyOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isVerifying}
                disabled={!allItemsChecked}
                className={
                  allItemsChecked
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                }
              >
                Verify Delivery Order
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
