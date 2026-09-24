import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchPendingVerificationOrders,
  submitOrderVerification,
  fetchOrderById,
} from "@/lib/services";
import {
  Order,
  OrderStatus,
  VerificationStatus,
  ClientEmployeeRole,
} from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
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
  Clock,
  Check,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { canVerifyDelivery, canVerifyInventory } from "@/lib/permissions";

// Client status labels
const ORDER_STATUS_LABELS: Record<string, string> = {
  ISSUED: "Order Issued",
  PROCESSING: "Processing",
  READY_FOR_DISPATCH: "Ready for Dispatch",
  DISPATCHED: "Dispatched",
  VERIFIED: "Order Verified",
};

export const OrderTrackPage: React.FC = () => {
  const { user, tenant, role } = useAuth();

  // Authorization check for verification access
  const hasVerificationAccess = canVerifyDelivery(user) || canVerifyInventory(user);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Verification Modal State
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationComments, setVerificationComments] = useState("");
  const [itemCheckboxes, setItemCheckboxes] = useState<Record<string, boolean>>(
    {},
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Order already verified state
  const [alreadyVerified, setAlreadyVerified] = useState(false);

  const loadOrders = async () => {
    if (!user?.client?.id || !tenant?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const list = await fetchPendingVerificationOrders(
        user.client.id,
        tenant.id,
      );
      setOrders(list);
      if (list.length > 0 && !selectedOrderId) {
        setSelectedOrderId(list[0].id);
        setAlreadyVerified(false);
      } else if (list.length === 0 && selectedOrderId) {
        // Selected order may have been verified, clear it
        setSelectedOrderId("");
        setAlreadyVerified(true);
      }
    } catch (err) {
      console.error("Error loading pending verification orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [tenant?.id, user?.client?.id]);

  const loadOrderDetails = async (orderId: string) => {
    try {
      // SECURITY: Pass tenantId, clientId, and role to verify client ownership
      const order = await fetchOrderById(
        orderId,
        user?.tenant?.id,
        user?.client?.id,
        role,
      );
      if (order) {
        // Check if already verified
        if (order.verificationStatus === "VERIFIED") {
          setAlreadyVerified(true);
        } else {
          setAlreadyVerified(false);
          // Initialize checkboxes for all items
          const initialCheckboxes: Record<string, boolean> = {};
          order.items?.forEach((item) => {
            initialCheckboxes[item.id] = false;
          });
          setItemCheckboxes(initialCheckboxes);
        }
        setSelectedOrderId(orderId);
      } else {
        // Order not found or access denied
        console.error("Access denied to order:", orderId);
      }
    } catch (err) {
      console.error("Error loading order details:", err);
    }
  };

  const activeOrder = orders.find((o) => o.id === selectedOrderId);

  // If user doesn't have verification access (e.g., CLIENT_ACCOUNTANT), show unauthorized message
  const isUnauthorized = role === "CLIENT_ACCOUNTANT" && !hasVerificationAccess;

  // Filter orders by search
  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(term) ||
      o.client?.companyName?.toLowerCase().includes(term)
    );
  });

  // Count checked items
  const checkedCount = Object.values(itemCheckboxes).filter(Boolean).length;
  const totalItems = activeOrder?.items?.length || 0;
  const allItemsChecked = totalItems > 0 && checkedCount === totalItems;

  const handleToggleItemCheckbox = (itemId: string, checked: boolean) => {
    setItemCheckboxes((prev) => ({
      ...prev,
      [itemId]: checked,
    }));
  };

  const handleVerifyDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    if (activeOrder.verificationStatus === "VERIFIED") return;

    setIsVerifying(true);
    setActionError(null);

    try {
      // Convert item checkboxes to text-based responses for submitOrderVerification
      const responses =
        activeOrder.items?.map((item) => ({
          text: `${item.product?.name || "Item"} (Ordered Qty: ${item.quantity}, Verified Qty: ${item.quantity})`,
          checked: itemCheckboxes[item.id] || false,
          orderItemId: item.id,
          orderedQty: item.quantity,
          verifiedQty: item.quantity,
        })) || [];

      await submitOrderVerification(
        activeOrder.id,
        "VERIFIED",
        responses,
        verificationComments,
        null,
        user?.id,
      );

      setIsVerifyOpen(false);
      setSuccessMsg(`Order ${activeOrder.orderNumber} verified successfully!`);
      setVerificationComments("");
      setItemCheckboxes({});
      await loadOrders();
    } catch (err: any) {
      setActionError(err?.message || "Failed to submit verification");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOpenVerifyModal = () => {
    if (!activeOrder || activeOrder.verificationStatus === "VERIFIED") return;
    // Initialize checkboxes for all items
    const initialCheckboxes: Record<string, boolean> = {};
    activeOrder.items?.forEach((item) => {
      initialCheckboxes[item.id] = false;
    });
    setItemCheckboxes(initialCheckboxes);
    setVerificationComments("");
    setIsVerifyOpen(true);
    setActionError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-400" /> Order & Delivery
            Tracker
          </h1>
          <p className="text-sm text-slate-400">
            Track delivery status and verify received items.
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

      {/* Unauthorized state for CLIENT_ACCOUNTANT users */}
      {isUnauthorized && (
        <Card className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-950 text-rose-400 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">
            Access Denied
          </h3>
          <p className="text-sm text-slate-400">
            You do not have delivery verification permissions. Contact your company administrator or manager for access.
          </p>
        </Card>
      )}

      {loading ? (
        <LoadingSpinner message="Loading pending deliveries..." />
      ) : orders.length === 0 && alreadyVerified ? (
        <Card className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-950 text-indigo-400 mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">
            All deliveries verified
          </h3>
          <p className="text-sm text-slate-400">
            No pending deliveries waiting for verification.
          </p>
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No pending deliveries"
          description="You will see orders here once they are dispatched and ready for delivery verification."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Pending Deliveries List */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search order..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredOrders.map((order) => {
                const isSelected = order.id === activeOrder?.id;
                const verificationBadge =
                  order.verificationStatus === "PENDING" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800">
                      Verify Pending
                    </span>
                  ) : order.verificationStatus === "VERIFIED" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                      {order.verificationStatus}
                    </span>
                  );

                return (
                  <div
                    key={order.id}
                    onClick={() => loadOrderDetails(order.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? "bg-indigo-950/60 border-indigo-500 shadow-md"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono font-bold text-xs text-white">
                        {order.orderNumber}
                      </span>
                      {verificationBadge}
                    </div>
                    <div className="text-xs text-slate-300 font-medium truncate">
                      {order.client?.companyName || "Direct Client"}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {order.items?.length || 0} items
                      </span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Order Details */}
          {activeOrder && (
            <div className="lg:col-span-2 space-y-5">
              {/* Order Details Card */}
              <Card className="p-5 border border-slate-800 bg-slate-900/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white font-mono">
                        {activeOrder.orderNumber}
                      </h2>
                      {activeOrder.verificationStatus === "VERIFIED" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800">
                          Pending Verification
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Client:{" "}
                      <strong className="text-slate-200">
                        {activeOrder.client?.companyName}
                      </strong>
                      {(activeOrder.client?.employees?.[0]?.contactPerson || activeOrder.client?.contactPerson) && (
                        <span> ({activeOrder.client?.employees?.[0]?.contactPerson || activeOrder.client?.contactPerson})</span>
                      )}
                    </p>
                  </div>

                  {activeOrder.verificationStatus !== "VERIFIED" ? (
                    <Button
                      onClick={handleOpenVerifyModal}
                      disabled={!allItemsChecked}
                      className={`gap-1.5 self-start sm:self-auto ${
                        allItemsChecked
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                      }`}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Verify Delivery Order
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <div className="px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4 inline-block mr-1" />
                        Delivery Verified
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Timeline */}
                <div className="py-3">
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 z-0" />
                    {[
                      "ISSUED",
                      "PROCESSING",
                      "READY_FOR_DISPATCH",
                      "DISPATCHED",
                      "VERIFIED",
                    ].map((step, idx) => {
                      const stepMap: Record<string, number> = {
                        ISSUED: 1,
                        PROCESSING: 2,
                        READY_FOR_DISPATCH: 3,
                        DISPATCHED: 4,
                        VERIFIED: 5,
                      };
                      // Map order status to timeline position
                      const statusToStep: Record<string, number> = {
                        ISSUED: 1,
                        PROCESSING: 1,
                        READY_FOR_DISPATCH: 1,
                        DISPATCHED: 2,
                        RECEIVED: 2,
                        VERIFICATION_PENDING: 3,
                        VERIFIED: 4
                      };
                      const currentIdx = statusToStep[activeOrder.status] || 1;
                      const stepIdx = stepMap[step] || 1;
                      const isCompleted = currentIdx >= stepIdx;
                      const isCurrent = currentIdx === stepIdx;

                      return (
                        <div
                          key={step}
                          className="relative z-10 flex flex-col items-center"
                        >
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
                              <span className="text-xs font-bold">
                                {idx + 1}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-semibold mt-2 text-center max-w-[70px] leading-tight ${
                              isCompleted || isCurrent
                                ? "text-white"
                                : "text-slate-500"
                            }`}
                          >
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Item Checklist Card */}
              <Card className="p-0 overflow-hidden border border-slate-800">
                <div className="bg-slate-950/40 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Verify Delivery Order
                    </span>
                  </div>
                  <span className="text-xs font-mono text-indigo-400 font-semibold">
                    {checkedCount} / {totalItems} items verified
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {activeOrder.items?.map((item) => {
                    const isChecked = Boolean(itemCheckboxes[item.id]);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (activeOrder.verificationStatus !== "VERIFIED") {
                            handleToggleItemCheckbox(item.id, !isChecked);
                          }
                        }}
                        className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all select-none ${
                          activeOrder.verificationStatus === "VERIFIED"
                            ? "bg-slate-900/40 border-slate-800 cursor-default"
                            : isChecked
                              ? "bg-indigo-950/20 border-indigo-500/50 shadow-sm cursor-pointer"
                              : "bg-slate-900/50 border-slate-800 hover:border-slate-700 cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleItemCheckbox(item.id, e.target.checked);
                          }}
                          disabled={activeOrder.verificationStatus === "VERIFIED"}
                          className="mt-1 w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">
                            {item.product?.name || "Product Item"}
                          </p>
                          <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs text-slate-400">
                            <div>
                              Ordered Qty: <strong className="text-white font-mono">{item.quantity}</strong> {item.product?.unit || "PCS"}
                            </div>
                            <div>
                              Verified Qty: <strong className="text-emerald-400 font-mono">{item.quantity}</strong> {item.product?.unit || "PCS"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {activeOrder.items?.length === 0 && (
                    <div className="p-4 text-center text-sm text-slate-400">
                      No items in this order
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Verification Progress:</span>
                    <p className="text-sm font-bold font-mono text-indigo-400">
                      {checkedCount} / {totalItems} items verified
                    </p>
                  </div>
                  {activeOrder.verificationStatus !== "VERIFIED" && (
                    <Button
                      onClick={handleOpenVerifyModal}
                      disabled={!allItemsChecked}
                      className={`gap-1.5 w-full sm:w-auto ${
                        allItemsChecked
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                      }`}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Verify Delivery Order
                    </Button>
                  )}
                </div>
              </Card>

              {/* Client Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-4 border border-slate-800">
                  <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                    Delivery Address
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeOrder.client?.shippingAddress ||
                      activeOrder.client?.billingAddress ||
                      "N/A"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Contact: {activeOrder.client?.employees?.[0]?.contactPerson || activeOrder.client?.contactPerson || "N/A"} •{" "}
                    {activeOrder.client?.employees?.[0]?.mobile || activeOrder.client?.mobile || "N/A"}
                  </p>
                </Card>

                <Card className="p-4 border border-slate-800">
                  <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                    Order Summary
                  </div>
                  <div className="text-xs space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-mono">
                        ₹{Number(activeOrder.subtotal).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span className="font-mono">
                        ₹{Number(activeOrder.taxTotal).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-800/50">
                      <span className="font-semibold">Total:</span>
                      <span className="font-mono font-bold text-white">
                        ₹
                        {Number(activeOrder.totalAmount).toLocaleString(
                          "en-IN",
                        )}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verify Delivery Modal */}
      {isVerifyOpen && activeOrder && (
        <Modal
          isOpen={isVerifyOpen}
          onClose={() => setIsVerifyOpen(false)}
          title={`Verify Delivery: ${activeOrder.orderNumber}`}
          description="Review and confirm all items have been received in good condition."
          maxWidth="lg"
        >
          <form
            onSubmit={handleVerifyDelivery}
            className="space-y-4 max-h-[75vh] overflow-y-auto pr-1"
          >
            {actionError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {actionError}
              </div>
            )}

            {/* Item Checklist in Modal */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                <span className="font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>Verify Delivery Order</span>
                </span>
                <span className="font-mono font-semibold text-indigo-400">
                  {checkedCount} / {totalItems} items verified
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {activeOrder.items?.map((item) => {
                  const isChecked = Boolean(itemCheckboxes[item.id]);
                  return (
                    <div
                      key={item.id}
                      onClick={() =>
                        handleToggleItemCheckbox(
                          item.id,
                          !isChecked,
                        )
                      }
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
                          {item.product?.name || "Order Item"}
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
                  {checkedCount} / {totalItems} items verified
                </span>
              </div>
            </div>

            {/* Comments */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Inspection Comments (Optional)
              </label>
              <textarea
                value={verificationComments}
                onChange={(e) => setVerificationComments(e.target.value)}
                placeholder="Any notes about the delivery..."
                rows={3}
                disabled={activeOrder.verificationStatus === "VERIFIED"}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVerifyOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isVerifying}
                disabled={
                  !allItemsChecked ||
                  activeOrder.verificationStatus === "VERIFIED"
                }
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

export default OrderTrackPage;
