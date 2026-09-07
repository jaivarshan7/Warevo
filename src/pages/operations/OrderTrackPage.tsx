import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchOrders,
  fetchClients,
  fetchProducts,
  submitDetailedOrderVerification,
  transitionOrderStatus
} from "@/lib/services";
import { Order, OrderStatus, VerificationStatus } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Truck,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Package,
  Calendar,
  Building2,
  FileText,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check
} from "lucide-react";
import { Link } from "react-router-dom";

const timelineSteps = [
  { key: "ISSUED", label: "Order Issued", desc: "Order confirmed in ERP" },
  { key: "PROCESSING", label: "Processing", desc: "Picking & warehouse packing" },
  { key: "DISPATCHED", label: "Dispatched", desc: "In transit with logistics carrier" },
  { key: "RECEIVED", label: "Delivered", desc: "Arrived at customer dock" },
  { key: "VERIFIED", label: "Verified", desc: "Physical delivery inspection passed" },
  { key: "INVOICED", label: "Invoiced", desc: "Tax invoice signed & settled" }
];

export const OrderTrackPage: React.FC = () => {
  const { user, tenant, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Verification Modal State
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verificationDecision, setVerificationDecision] = useState<"VERIFIED" | "PARTIALLY_VERIFIED" | "REJECTED">("VERIFIED");
  const [inspectionComments, setInspectionComments] = useState("");
  const [itemReceipts, setItemReceipts] = useState<Record<string, { received: number; damaged: number }>>({});
  const [checklistResponses, setChecklistResponses] = useState<Array<{ text: string; checked: boolean }>>([
    { text: "Physical package seals intact with no unauthorized tampering", checked: true },
    { text: "Delivery vehicle temperature / storage conditions satisfactory", checked: true },
    { text: "Item count and SKU labels match accompanying Tax Invoice / Delivery Challan", checked: true },
    { text: "Zero evident transit damage or liquid leakage", checked: true }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const list = await fetchOrders(tenant?.id, role, user?.client?.id);
      setOrders(list);
      if (list.length > 0 && !selectedOrderId) {
        setSelectedOrderId(list[0].id);
      }
    } catch (err) {
      console.error("Error loading orders for tracker:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [tenant?.id, role, user?.client?.id]);

  const activeOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(term) ||
      o.client?.companyName?.toLowerCase().includes(term)
    );
  });

  const getStepIndex = (status: OrderStatus) => {
    const map: Record<string, number> = {
      DRAFT: 0,
      ISSUED: 1,
      PROCESSING: 2,
      READY_FOR_DISPATCH: 2,
      DISPATCHED: 3,
      RECEIVED: 4,
      VERIFICATION_PENDING: 4,
      VERIFIED: 5,
      INVOICE_PENDING: 5,
      INVOICED: 6,
      PAID: 6,
      COMPLETED: 6
    };
    return map[status] ?? 1;
  };

  const handleOpenVerifyModal = () => {
    if (!activeOrder) return;
    const initialReceipts: Record<string, { received: number; damaged: number }> = {};
    activeOrder.items?.forEach((it) => {
      initialReceipts[it.id] = { received: it.quantity, damaged: 0 };
    });
    setItemReceipts(initialReceipts);
    setVerificationDecision("VERIFIED");
    setInspectionComments("");
    setIsVerifyOpen(true);
  };

  const handleDispatch = async () => {
    if (!activeOrder || activeOrder.status !== "READY_FOR_DISPATCH") return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await transitionOrderStatus(activeOrder.id, "DISPATCHED", "Dispatched by warehouse team", user?.id, role);
      setSuccessMsg(`Order ${activeOrder.orderNumber} dispatched successfully.`);
      await loadOrders();
    } catch (err: any) {
      setActionError(err?.message || "Failed to dispatch order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiptChange = (itemId: string, field: "received" | "damaged", val: number) => {
    setItemReceipts((prev) => ({
      ...prev,
      [itemId]: {
        received: field === "received" ? val : (prev[itemId]?.received ?? 0),
        damaged: field === "damaged" ? val : (prev[itemId]?.damaged ?? 0)
      }
    }));
  };

  const toggleChecklistItem = (idx: number) => {
    setChecklistResponses((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      await submitDetailedOrderVerification({
        orderId: activeOrder.id,
        status: verificationDecision,
        comments: inspectionComments,
        responses: checklistResponses,
        itemReceivedMap: itemReceipts,
        userId: user?.id,
        userRole: role
      });

      setIsVerifyOpen(false);
      setSuccessMsg(`Order ${activeOrder.orderNumber} verification submitted as ${verificationDecision}!`);
      await loadOrders();
    } catch (err: any) {
      setActionError(err?.message || "Failed to submit verification");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-400" /> Live Order & Delivery Tracker
          </h1>
          <p className="text-sm text-slate-400">
            Real-time fulfillment milestones, delivery inspection checklists, and verification stamps.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link to="/operations/orders">
            <Button variant="outline" className="text-xs">
              Back to Orders
            </Button>
          </Link>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading active shipments..." />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No active orders"
          description="Create commercial orders to begin tracking physical delivery milestones."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Shipment Selector */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search shipment / order..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredOrders.map((o) => {
                const isSelected = o.id === activeOrder?.id;
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? "bg-indigo-950/60 border-indigo-500 shadow-md"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-bold text-xs text-white">
                        {o.orderNumber}
                      </span>
                      <StatusBadge status={o.status} type="order" />
                    </div>
                    <div className="text-xs text-slate-300 font-medium truncate">
                      {o.client?.companyName || "Direct Client"}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                      <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        ₹{Number(o.totalAmount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Order Details & Milestone Timeline */}
          {activeOrder && (
            <div className="lg:col-span-2 space-y-5">
              {/* Milestone Tracker Card */}
              <Card className="p-5 border border-slate-800 bg-slate-900/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white font-mono">
                        {activeOrder.orderNumber}
                      </h2>
                      <StatusBadge status={activeOrder.status} type="order" />
                      <StatusBadge status={activeOrder.verificationStatus} type="verification" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Client: <strong className="text-slate-200">{activeOrder.client?.companyName}</strong> ({activeOrder.client?.contactPerson})
                    </p>
                  </div>

                  {role === "WAREHOUSE_OWNER" || role === "WAREHOUSE_STAFF" ? (
                    activeOrder.status === "READY_FOR_DISPATCH" && (
                      <Button
                        onClick={handleDispatch}
                        isLoading={isSubmitting}
                        className="gap-1.5 self-start sm:self-auto bg-indigo-600 hover:bg-indigo-500"
                      >
                        <Truck className="w-4 h-4" /> Dispatch Order
                      </Button>
                    )
                  ) : activeOrder.verificationStatus !== "VERIFIED" && (
                    <Button
                      onClick={handleOpenVerifyModal}
                      className="gap-1.5 self-start sm:self-auto bg-emerald-600 hover:bg-emerald-500"
                    >
                      <ClipboardCheck className="w-4 h-4" /> Inspect & Verify Delivery
                    </Button>
                  )}
                </div>

                {/* Visual Timeline */}
                <div className="py-3">
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 z-0" />
                    {timelineSteps.map((step, idx) => {
                      const currentIdx = getStepIndex(activeOrder.status);
                      const isCompleted = currentIdx > idx;
                      const isCurrent = currentIdx === idx + 1;

                      return (
                        <div key={step.key} className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition ${
                              isCompleted
                                ? "bg-emerald-600 border-emerald-400 text-white"
                                : isCurrent
                                ? "bg-indigo-600 border-indigo-400 text-white animate-pulse"
                                : "bg-slate-900 border-slate-700 text-slate-500"
                            }`}
                          >
                            {isCompleted ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <span className="text-xs font-bold">{idx + 1}</span>
                            )}
                          </div>
                          <span
                            className={`text-[11px] font-semibold mt-2 text-center max-w-[80px] leading-tight ${
                              isCompleted || isCurrent ? "text-white" : "text-slate-500"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Order Items Table */}
              <Card className="p-0 overflow-hidden border border-slate-800">
                <div className="bg-slate-950/40 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Shipment Line Items ({activeOrder.items?.length || 0})
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    Total: ₹{Number(activeOrder.totalAmount).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Item & SKU</th>
                        <th className="py-2.5 px-4 text-right">Ordered</th>
                        <th className="py-2.5 px-4 text-right">Unit Price</th>
                        <th className="py-2.5 px-4 text-right">GST %</th>
                        <th className="py-2.5 px-4 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activeOrder.items?.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-semibold text-white">
                            {it.product?.name || "Product Item"}
                            <div className="text-[10px] font-mono text-slate-500">
                              SKU: {it.product?.sku || "N/A"}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-200">
                            {it.quantity} {it.product?.unit || "PCS"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">
                            ₹{Number(it.unitPrice).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">
                            {it.taxRate}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            ₹{Number(it.total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Delivery Destination and Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-4 border border-slate-800">
                  <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                    Delivery Coordinates
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeOrder.client?.shippingAddress || activeOrder.client?.billingAddress || "Direct Delivery"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Contact: {activeOrder.client?.contactPerson} ({activeOrder.client?.mobile})
                  </p>
                </Card>

                <Card className="p-4 border border-slate-800">
                  <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                    Commercial Invoicing Link
                  </div>
                  <p className="text-xs text-slate-400">
                    Official Tax Invoice generation & payment proof upload:
                  </p>
                  <div className="mt-3">
                    <Link
                      to={`/operations/orders/${activeOrder.id}`}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                    >
                      View Order Details & Invoices <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Item-Level Delivery Inspection & Verification Modal */}
      {isVerifyOpen && activeOrder && (
        <Modal
          isOpen={isVerifyOpen}
          onClose={() => setIsVerifyOpen(false)}
          title={`Delivery Verification: ${activeOrder.orderNumber}`}
          description="Document physical cargo inspection, received vs. damaged quantities, and audit compliance checklist."
          maxWidth="lg"
        >
          <form onSubmit={handleSubmitVerification} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {actionError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {actionError}
              </div>
            )}

            {/* Decision Radio Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Verification Verdict *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setVerificationDecision("VERIFIED")}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    verificationDecision === "VERIFIED"
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-md"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                  <span className="text-xs font-bold block">VERIFIED</span>
                  <span className="text-[10px] text-slate-400">100% Intact</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVerificationDecision("PARTIALLY_VERIFIED")}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    verificationDecision === "PARTIALLY_VERIFIED"
                      ? "bg-amber-950/80 border-amber-500 text-amber-300 shadow-md"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                  <span className="text-xs font-bold block">PARTIAL</span>
                  <span className="text-[10px] text-slate-400">Damaged/Missing</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVerificationDecision("REJECTED")}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    verificationDecision === "REJECTED"
                      ? "bg-rose-950/80 border-rose-500 text-rose-300 shadow-md"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <XCircle className="w-4 h-4 mx-auto mb-1 text-rose-400" />
                  <span className="text-xs font-bold block">REJECTED</span>
                  <span className="text-[10px] text-slate-400">Refused Cargo</span>
                </button>
              </div>
            </div>

            {/* Checklist Checkboxes */}
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Standard Delivery Inspection Checklist</span>
              </div>
              <div className="space-y-1.5">
                {checklistResponses.map((item, idx) => (
                  <label
                    key={idx}
                    onClick={() => toggleChecklistItem(idx)}
                    className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer hover:text-white select-none"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => {}}
                      className="mt-0.5 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>{item.text}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Item Counts: Received vs Damaged */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Item-Level Physical Count Verification
              </label>
              <div className="space-y-2">
                {activeOrder.items?.map((it) => {
                  const receipt = itemReceipts[it.id] || { received: it.quantity, damaged: 0 };
                  return (
                    <div
                      key={it.id}
                      className="grid grid-cols-12 gap-2 p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl items-center"
                    >
                      <div className="col-span-6">
                        <p className="text-xs font-semibold text-white truncate">
                          {it.product?.name}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500">
                          Ordered: {it.quantity} {it.product?.unit}
                        </p>
                      </div>

                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-400 block">Received</label>
                        <input
                          type="number"
                          min="0"
                          max={it.quantity}
                          value={receipt.received}
                          onChange={(e) =>
                            handleReceiptChange(it.id, "received", parseInt(e.target.value, 10) || 0)
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-right"
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="text-[10px] text-rose-400 block">Damaged</label>
                        <input
                          type="number"
                          min="0"
                          value={receipt.damaged}
                          onChange={(e) =>
                            handleReceiptChange(it.id, "damaged", parseInt(e.target.value, 10) || 0)
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-rose-400 font-mono text-right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inspector Comments */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Inspection Remarks / Delivery Notes
              </label>
              <textarea
                value={inspectionComments}
                onChange={(e) => setInspectionComments(e.target.value)}
                placeholder="Discrepancy notes, damaged carton serial numbers, receiver signature details..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsVerifyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Submit Official Inspection
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
