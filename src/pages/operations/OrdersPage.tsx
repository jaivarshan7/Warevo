import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchOrders,
  transitionOrderStatus,
  deleteOrderBeforeDispatched
} from "@/lib/services";
import { Order, OrderStatus } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { validOrderTransitions, ORDER_ACTIVE_WORKFLOW } from "@/lib/orderWorkflow";
import { formatDate } from "@/lib/dateUtils";
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Truck,
  Edit3,
  Trash2
} from "lucide-react";

export const OrdersPage: React.FC = () => {
  const { user, tenant, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Transition modal state
  const [transitioningOrder, setTransitioningOrder] = useState<Order | null>(null);
  const [targetStatus, setTargetStatus] = useState<OrderStatus | "">("");
  const [transitionNotes, setTransitionNotes] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Delete Order modal state
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  const location = useLocation();
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMsg(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadData = async () => {
    try {
      setLoading(true);
      const oList = await fetchOrders(
        tenant?.id,
        role,
        user?.clientId || user?.client?.id,
        user?.id
      );
      setOrders(oList);
    } catch (err: any) {
      console.error("Error loading orders data:", err);
      setActionError(err.message || "Failed to retrieve orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id, role, user?.id, user?.clientId, user?.client?.id]);

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitioningOrder || !targetStatus) return;
    setIsTransitioning(true);
    setActionError(null);

    try {
      await transitionOrderStatus(
        transitioningOrder.id,
        targetStatus as OrderStatus,
        transitionNotes,
        user?.id,
        role
      );
      setTransitioningOrder(null);
      setTargetStatus("");
      setTransitionNotes("");
      setSuccessMsg(`Order ${transitioningOrder.orderNumber} transitioned to ${targetStatus}`);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || "Failed to transition order");
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deletingOrder) return;
    setIsDeletingOrder(true);
    setActionError(null);
    try {
      await deleteOrderBeforeDispatched(deletingOrder.id);
      setSuccessMsg(`Order ${deletingOrder.orderNumber} deleted successfully.`);
      setDeletingOrder(null);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to delete order");
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = filterStatus === "ALL" || o.status === filterStatus;
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.client?.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Orders & Dispatch</h1>
          <p className="text-sm text-slate-400">
            Controlled order lifecycle, transition audit logs, and delivery tracking.
          </p>
        </div>

        {role !== "CLIENT" && (
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <Link to="/operations/orders/track">
              <Button variant="outline" className="gap-1.5">
                <Truck className="w-4 h-4" /> Live Delivery Tracker
              </Button>
            </Link>
            <Link to="/operations/orders/new">
              <Button className="gap-1.5 bg-indigo-600 hover:bg-indigo-500">
                <Plus className="w-4 h-4" /> Create New Order
              </Button>
            </Link>
            <Link to="/operations/orders/import">
              <Button variant="outline" className="gap-1.5 border-amber-600/40 text-amber-300 hover:bg-amber-950/30">
                <Sparkles className="w-4 h-4 text-amber-300" /> Import Invoice
              </Button>
            </Link>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by order # or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-800/80 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-auto"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="ISSUED">ISSUED</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="READY_FOR_DISPATCH">READY FOR DISPATCH</option>
              <option value="DISPATCHED">DISPATCHED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Retrieving orders..." />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            title="No orders found"
            description="Try changing your search keywords or status filter, or create a new order."
          />
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs uppercase font-semibold">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOrders.map((o) => {
                    const allowedNext = validOrderTransitions[o.status] || [];
                    const isDeliveryVerified = Boolean(o.deliveryVerifiedAt);
                    const isInventoryVerified =
                      Boolean(o.storeVerifiedAt) || (o.status === "VERIFIED" && o.verificationStatus === "VERIFIED");

                    return (
                      <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          <Link
                            to={`/operations/orders/${o.id}`}
                            className="text-indigo-400 hover:text-indigo-300 hover:underline"
                          >
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {formatDate(o.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-200 font-medium">
                          {o.client?.companyName || "Direct Client"}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={o.status} type="order" />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                isDeliveryVerified
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                  : o.verificationStatus === "REJECTED"
                                  ? "bg-rose-950 text-rose-300 border-rose-800"
                                  : "bg-slate-800/80 text-slate-400 border-slate-700/60"
                              }`}
                            >
                              {isDeliveryVerified ? "✓ Delivery" : "Delivery: Pending"}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                isInventoryVerified
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                  : "bg-slate-800/80 text-slate-400 border-slate-700/60"
                              }`}
                            >
                              {isInventoryVerified ? "✓ Inventory" : "Inventory: Pending"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-200">
                          ₹{Number(o.totalAmount).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {["ISSUED", "PROCESSING", "READY_FOR_DISPATCH"].includes(o.status) &&
                              role !== "CLIENT" && (
                                <>
                                  <Link
                                    to={`/operations/orders/${o.id}/edit`}
                                    title="Edit Order"
                                    className="p-1.5 text-xs font-semibold rounded-lg bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 transition-colors inline-flex items-center"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Link>
                                  <button
                                    onClick={() => setDeletingOrder(o)}
                                    title="Delete Order"
                                    className="p-1.5 text-xs font-semibold rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            {allowedNext.length > 0 && role !== "CLIENT" && (
                              <button
                                onClick={() => {
                                  setTransitioningOrder(o);
                                  setTargetStatus(allowedNext[0]);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 transition-colors"
                              >
                                Transition
                              </button>
                            )}
                            <Link
                              to={`/operations/orders/${o.id}`}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-slate-800/60">
              {filteredOrders.map((o) => {
                const allowedNext = validOrderTransitions[o.status] || [];
                const paymentStatus = (o as any).invoices?.[0]?.paymentStatus;
                const isDeliveryVerified = Boolean(o.deliveryVerifiedAt);
                const isInventoryVerified =
                  Boolean(o.storeVerifiedAt) || (o.status === "VERIFIED" && o.verificationStatus === "VERIFIED");

                return (
                  <div key={o.id} className="p-4 space-y-3 hover:bg-slate-800/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <Link
                          to={`/operations/orders/${o.id}`}
                          className="font-mono font-bold text-white hover:text-indigo-400 text-sm"
                        >
                          {o.orderNumber}
                        </Link>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {formatDate(o.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={o.status} type="order" />
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Client:</span>
                        <span className="font-medium text-white">{o.client?.companyName || "Direct Client"}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Amount:</span>
                        <span className="font-mono font-semibold text-white">
                          ₹{Number(o.totalAmount).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">Verification:</span>
                        <div className="flex gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              isDeliveryVerified
                                ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                : o.verificationStatus === "REJECTED"
                                ? "bg-rose-950 text-rose-300 border-rose-800"
                                : "bg-slate-800/80 text-slate-400 border-slate-700/60"
                            }`}
                          >
                            {isDeliveryVerified ? "✓ Delivery" : "Delivery: Pending"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              isInventoryVerified
                                ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                : "bg-slate-800/80 text-slate-400 border-slate-700/60"
                            }`}
                          >
                            {isInventoryVerified ? "✓ Inventory" : "Inventory: Pending"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {paymentStatus && (
                      <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-800/60">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          Payment
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                            paymentStatus === "PAID"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : paymentStatus === "PAYMENT_PENDING"
                              ? "bg-amber-950 text-amber-300 border-amber-800"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {paymentStatus === "PAYMENT_PENDING" ? "Pending" : paymentStatus.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                      {["ISSUED", "PROCESSING", "READY_FOR_DISPATCH"].includes(o.status) &&
                        role !== "CLIENT" && (
                          <>
                            <Link
                              to={`/operations/orders/${o.id}/edit`}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 transition-colors inline-flex items-center"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => setDeletingOrder(o)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      {allowedNext.length > 0 && role !== "CLIENT" && (
                        <button
                          onClick={() => {
                            setTransitioningOrder(o);
                            setTargetStatus(allowedNext[0]);
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 transition-colors"
                        >
                          Transition
                        </button>
                      )}
                      <Link
                        to={`/operations/orders/${o.id}`}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Transition Order Modal */}
      {transitioningOrder && (
        <Modal
          isOpen={Boolean(transitioningOrder)}
          onClose={() => setTransitioningOrder(null)}
          title={`Advance Order ${transitioningOrder.orderNumber}`}
          description={`Current Status: ${transitioningOrder.status}`}
          maxWidth="md"
        >
          <form onSubmit={handleTransition} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Complete Order Workflow
              </label>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {ORDER_ACTIVE_WORKFLOW.map((status) => {
                  const currentIndex = ORDER_ACTIVE_WORKFLOW.indexOf(transitioningOrder.status);
                  const statusIndex = ORDER_ACTIVE_WORKFLOW.indexOf(status);
                  const isCurrent = transitioningOrder.status === status;
                  const isCompleted = statusIndex < currentIndex;
                  const isValidNext = validOrderTransitions[transitioningOrder.status]?.includes(status);

                  const isDispatchedToVerified = transitioningOrder.status === "DISPATCHED" && status === "VERIFIED";

                  let isDisabled = false;
                  if (isCompleted) {
                    isDisabled = true;
                  } else if (!isCurrent && !isValidNext) {
                    isDisabled = true;
                  }
                  if (isDispatchedToVerified) {
                    isDisabled = true;
                  }

                  return (
                    <label
                      key={status}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isCurrent
                          ? "bg-indigo-950/60 border-indigo-600 ring-1 ring-indigo-500"
                          : isCompleted
                            ? "bg-emerald-950/30 border-emerald-800/50"
                            : isDisabled
                              ? "bg-slate-900/30 border-slate-800 opacity-50 cursor-not-allowed"
                              : "bg-slate-800/50 border-slate-700 hover:border-indigo-600 hover:bg-indigo-950/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="targetStatus"
                        value={status}
                        checked={targetStatus === status}
                        onChange={(e) => setTargetStatus(e.target.value as OrderStatus)}
                        disabled={isDisabled}
                        className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              isCurrent
                                ? "text-indigo-300"
                                : isCompleted
                                  ? "text-emerald-300"
                                  : "text-slate-300"
                            }`}
                          >
                            {status.replace(/_/g, " ")}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] rounded-full font-semibold">
                              CURRENT
                            </span>
                          )}
                          {isCompleted && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          {isValidNext && !isCurrent && (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] rounded-full font-semibold">
                              NEXT AVAILABLE
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Transition Notes / Reason
              </label>
              <textarea
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                placeholder="Optional notes regarding this status change (recorded in audit history)..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransitioningOrder(null)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isTransitioning}>
                Confirm Status Transition
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Order Confirmation Modal */}
      {deletingOrder && (
        <Modal
          isOpen={Boolean(deletingOrder)}
          onClose={() => setDeletingOrder(null)}
          title="Confirm Delete Order"
          description="This action is permanent and cannot be undone."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Delete Order {deletingOrder.orderNumber}?</span>
              </div>
              <p>
                You are about to delete order{" "}
                <strong className="text-white">{deletingOrder.orderNumber}</strong> for client{" "}
                <strong className="text-white">{deletingOrder.client?.companyName}</strong>.
              </p>
              <p>
                Current Status: <span className="font-semibold uppercase">{deletingOrder.status}</span>
              </p>
              <p className="text-[11px] text-rose-400">
                All associated order items and dependent invoice records will be safely cleaned up. Deletion
                is strictly blocked once an order reaches DISPATCHED.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingOrder(null)}
                disabled={isDeletingOrder}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDeleteOrder}
                isLoading={isDeletingOrder}
                className="bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950"
              >
                Confirm Delete Order
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
