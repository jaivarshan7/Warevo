import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchPendingVerificationOrders,
  submitOrderVerification,
  fetchOrderById,
  uploadDeliveryEvidence,
  getSignedDeliveryEvidenceUrl,
  getOrderComments,
  addOrderComment,
  updateOrderComment
} from "@/lib/services";
import {
  Order,
  OrderStatus,
  VerificationStatus,
  ClientEmployeeRole,
  OrderComment,
  DeliveryEvidenceAttachment
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
  PackageCheck,
  Upload,
  X,
  Image as ImageIcon,
  MessageSquare,
  Send,
  Loader2,
  Edit3
} from "lucide-react";
import { Link } from "react-router-dom";
import { canVerifyDelivery, canVerifyInventory } from "@/lib/permissions";
import { getRoleBadgeStyle } from "@/lib/roleDisplay";
import { compressDeliveryImage } from "@/lib/imageCompression";
import { formatTime } from "@/lib/dateUtils";

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
  const [itemCheckboxes, setItemCheckboxes] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delivery Evidence State (in modal)
  const [evidenceFiles, setEvidenceFiles] = useState<
    Array<{ file: File; previewUrl: string; originalSize: number; compressedSize: number }>
  >([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Order detail & comments
  const [activeOrderFull, setActiveOrderFull] = useState<Order | null>(null);
  const [evidenceSignedUrls, setEvidenceSignedUrls] = useState<Record<string, string>>({});
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);

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
        await loadOrderDetails(list[0].id);
      } else if (list.length === 0 && selectedOrderId) {
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
        user?.tenant?.id || tenant?.id,
        user?.client?.id || user?.clientId,
        role,
        user?.id
      );
      if (order) {
        setActiveOrderFull(order);
        if (order.comments) {
          setComments(order.comments);
        }
        if (order.verificationStatus === "VERIFIED") {
          setAlreadyVerified(true);
        } else {
          setAlreadyVerified(false);
          const initialCheckboxes: Record<string, boolean> = {};
          order.items?.forEach((item) => {
            initialCheckboxes[item.id] = false;
          });
          setItemCheckboxes(initialCheckboxes);
        }
        setSelectedOrderId(orderId);
      } else {
        console.error("Access denied to order:", orderId);
      }
    } catch (err) {
      console.error("Error loading order details:", err);
    }
  };

  // Load signed URLs for verification evidence attachments
  useEffect(() => {
    let isMounted = true;
    const loadSignedUrls = async () => {
      const atts = activeOrderFull?.verification?.attachments;
      if (!atts || !Array.isArray(atts)) return;
      const urls: Record<string, string> = {};
      for (const item of atts as DeliveryEvidenceAttachment[]) {
        if (item.path) {
          try {
            const signed = await getSignedDeliveryEvidenceUrl(item.path);
            if (signed) urls[item.path] = signed;
          } catch (e) {
            console.warn("Failed to load signed URL for evidence in track page:", item.path, e);
          }
        }
      }
      if (isMounted) setEvidenceSignedUrls(urls);
    };
    loadSignedUrls();
    return () => {
      isMounted = false;
    };
  }, [activeOrderFull?.verification?.attachments]);

  const activeOrder = activeOrderFull || orders.find((o) => o.id === selectedOrderId);

  // If user doesn't have verification access (neither delivery nor inventory verification), show unauthorized message
  const isUnauthorized = !hasVerificationAccess;

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

  const handleEvidenceImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsCompressing(true);
    setActionError(null);
    try {
      for (const file of files) {
        const compressed = await compressDeliveryImage(file);
        const previewUrl = URL.createObjectURL(compressed);
        setEvidenceFiles((prev) => [
          ...prev,
          {
            file: compressed,
            previewUrl,
            originalSize: file.size,
            compressedSize: compressed.size
          }
        ]);
      }
    } catch (err: any) {
      console.error("Track page image compression failed:", err);
      setActionError("Image compression failed: " + (err.message || ""));
    } finally {
      setIsCompressing(false);
      if (e.target) e.target.value = "";
    }
  };

  const removeEvidenceFile = (index: number) => {
    setEvidenceFiles((prev) => {
      const item = prev[index];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleVerifyDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    if (activeOrder.verificationStatus === "VERIFIED") return;

    setIsVerifying(true);
    setActionError(null);
    setUploadProgress(null);

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

      // Upload evidence files to private storage bucket if any
      const uploadedAttachments: DeliveryEvidenceAttachment[] = [];
      const tenantId = activeOrder.tenantId || tenant?.id || "";
      if (evidenceFiles.length > 0 && tenantId) {
        for (let i = 0; i < evidenceFiles.length; i++) {
          setUploadProgress(`Uploading evidence photo ${i + 1} of ${evidenceFiles.length}...`);
          const att = await uploadDeliveryEvidence(evidenceFiles[i].file, tenantId, activeOrder.id);
          uploadedAttachments.push(att);
        }
      }

      await submitOrderVerification(
        activeOrder.id,
        "VERIFIED",
        responses,
        verificationComments,
        uploadedAttachments.length > 0 ? uploadedAttachments : null,
        user?.id,
      );

      setIsVerifyOpen(false);
      setEvidenceFiles([]);
      setSuccessMsg(`Order ${activeOrder.orderNumber} verified successfully with evidence!`);
      setVerificationComments("");
      setItemCheckboxes({});
      await loadOrders();
      if (selectedOrderId) {
        await loadOrderDetails(selectedOrderId);
      }
    } catch (err: any) {
      setActionError(err?.message || "Failed to submit verification");
    } finally {
      setIsVerifying(false);
      setUploadProgress(null);
    }
  };

  const handleOpenVerifyModal = () => {
    if (!activeOrder || activeOrder.verificationStatus === "VERIFIED") return;
    const initialCheckboxes: Record<string, boolean> = {};
    activeOrder.items?.forEach((item) => {
      initialCheckboxes[item.id] = false;
    });
    setItemCheckboxes(initialCheckboxes);
    setVerificationComments("");
    setEvidenceFiles([]);
    setIsVerifyOpen(true);
    setActionError(null);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !newCommentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await addOrderComment(activeOrder.id, newCommentText.trim());
      setNewCommentText("");
      const updated = await fetchOrderById(
        activeOrder.id,
        tenant?.id || user?.tenantId,
        user?.clientId || user?.client?.id,
        role,
        user?.id
      );
      if (updated?.comments) setComments(updated.comments);
      setSuccessMsg("Comment posted to timeline.");
    } catch (err: any) {
      setActionError(err.message || "Failed to post comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleUpdateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommentId || !editingCommentText.trim()) return;
    setIsUpdatingComment(true);
    try {
      await updateOrderComment(editingCommentId, editingCommentText.trim());
      setEditingCommentId(null);
      setEditingCommentText("");
      const updated = await fetchOrderById(
        activeOrder!.id,
        tenant?.id || user?.tenantId,
        user?.clientId || user?.client?.id,
        role,
        user?.id
      );
      if (updated?.comments) setComments(updated.comments);
      setSuccessMsg("Comment updated.");
    } catch (err: any) {
      setActionError(err.message || "Failed to update comment");
    } finally {
      setIsUpdatingComment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-400" /> Order & Delivery Tracker
          </h1>
          <p className="text-sm text-slate-400">
            Track delivery status, verify received items, attach evidence, and collaborate.
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
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Unauthorized state for CLIENT_ACCOUNTANT users */}
      {isUnauthorized && (
        <Card className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-950 text-rose-400 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">Access Denied</h3>
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
          <h3 className="text-base font-semibold text-white mb-2">All deliveries verified</h3>
          <p className="text-sm text-slate-400">No pending deliveries waiting for verification.</p>
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
              {filteredOrders.map((o) => {
                const isSelected = o.id === activeOrder?.id;
                const verificationBadge =
                  o.verificationStatus === "PENDING" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800">
                      Delivery Pending
                    </span>
                  ) : o.verificationStatus === "VERIFIED" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Delivery Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                      {o.verificationStatus}
                    </span>
                  );

                return (
                  <div
                    key={o.id}
                    onClick={() => loadOrderDetails(o.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? "bg-indigo-950/60 border-indigo-500 shadow-md"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono font-bold text-xs text-white">{o.orderNumber}</span>
                      {verificationBadge}
                    </div>
                    <div className="text-xs text-slate-300 font-medium truncate">
                      {o.client?.companyName || "Direct Client"}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {o.items?.length || 0} items
                      </span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        ₹{Number(o.totalAmount).toLocaleString("en-IN")}
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
                      <h2 className="text-xl font-bold text-white font-mono">{activeOrder.orderNumber}</h2>
                      {activeOrder.verificationStatus === "VERIFIED" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Delivery Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800">
                          Pending Delivery Verification
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Client: <strong className="text-slate-200">{activeOrder.client?.companyName}</strong>
                      {(activeOrder.client?.employees?.[0]?.contactPerson ||
                        activeOrder.client?.contactPerson) && (
                        <span>
                          {" "}
                          (
                          {activeOrder.client?.employees?.[0]?.contactPerson ||
                            activeOrder.client?.contactPerson}
                          )
                        </span>
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

                {/* Stepper */}
                <div className="py-3">
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 z-0" />
                    {["ISSUED", "PROCESSING", "READY_FOR_DISPATCH", "DISPATCHED", "VERIFIED"].map(
                      (step, idx) => {
                        const stepMap: Record<string, number> = {
                          ISSUED: 1,
                          PROCESSING: 2,
                          READY_FOR_DISPATCH: 3,
                          DISPATCHED: 4,
                          VERIFIED: 5,
                        };
                        const statusToStep: Record<string, number> = {
                          ISSUED: 1,
                          PROCESSING: 1,
                          READY_FOR_DISPATCH: 1,
                          DISPATCHED: 2,
                          RECEIVED: 2,
                          VERIFICATION_PENDING: 3,
                          VERIFIED: 4,
                        };
                        const currentIdx = statusToStep[activeOrder.status] || 1;
                        const stepIdx = stepMap[step] || 1;
                        const isCompleted = currentIdx >= stepIdx;
                        const isCurrent = currentIdx === stepIdx;

                        return (
                          <div key={step} className="relative z-10 flex flex-col items-center">
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
                              className={`text-[10px] font-semibold mt-2 text-center max-w-[70px] leading-tight ${
                                isCompleted || isCurrent ? "text-white" : "text-slate-500"
                              }`}
                            >
                              {step}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </Card>

              {/* Item Checklist Card */}
              <Card className="p-0 overflow-hidden border border-slate-800">
                <div className="bg-slate-950/40 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Verify Delivery Order Checklist
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
                              Ordered Qty:{" "}
                              <strong className="text-white font-mono">{item.quantity}</strong>{" "}
                              {item.product?.unit || "PCS"}
                            </div>
                            <div>
                              Verified Qty:{" "}
                              <strong className="text-emerald-400 font-mono">{item.quantity}</strong>{" "}
                              {item.product?.unit || "PCS"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {activeOrder.items?.length === 0 && (
                    <div className="p-4 text-center text-sm text-slate-400">No items in this order</div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Verification Progress:</span>
                    <p className="text-sm font-bold font-mono text-indigo-400">
                      {checkedCount} / {totalItems} items verified
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeOrder.verificationStatus !== "VERIFIED" && canVerifyDelivery(user) && (
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
                    {Boolean(
                      activeOrder.deliveryVerifiedAt || activeOrder.verificationStatus === "VERIFIED"
                    ) &&
                      !activeOrder.storeVerifiedAt &&
                      canVerifyInventory(user) && (
                        <Link
                          to={`/operations/orders/${activeOrder.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-sm shadow-blue-950"
                        >
                          <PackageCheck className="w-4 h-4" />
                          Verify Store Inventory →
                        </Link>
                      )}
                  </div>
                </div>
              </Card>

              {/* FEATURE 3 & 5: Receiver Notes & Delivery Evidence Display */}
              {activeOrderFull?.verification && (
                <Card className="border border-emerald-900/40 bg-emerald-950/10 space-y-3">
                  <div className="flex items-center gap-2 border-b border-emerald-900/40 pb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Receiver Notes & Evidence</h3>
                  </div>

                  {activeOrderFull.verification.comments && (
                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-200">
                      <span className="font-semibold text-slate-400 block mb-1">Receiver Notes:</span>
                      {activeOrderFull.verification.comments}
                    </div>
                  )}

                  {Array.isArray(activeOrderFull.verification.attachments) &&
                    activeOrderFull.verification.attachments.length > 0 && (
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> Evidence Photos:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(activeOrderFull.verification.attachments as DeliveryEvidenceAttachment[]).map(
                            (att, idx) => {
                              const signedUrl = evidenceSignedUrls[att.path];
                              return (
                                <div
                                  key={idx}
                                  onClick={() => signedUrl && setPreviewModalUrl(signedUrl)}
                                  className="group relative rounded-lg border border-slate-800 bg-slate-950 overflow-hidden cursor-pointer hover:border-indigo-500 transition-all"
                                >
                                  <div className="aspect-square bg-slate-950 flex items-center justify-center">
                                    {signedUrl ? (
                                      <img
                                        src={signedUrl}
                                        alt={att.fileName}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                    ) : (
                                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                                    )}
                                  </div>
                                  <div className="p-1 text-[9px] bg-slate-900 text-slate-400 truncate">
                                    {att.fileName}
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}
                </Card>
              )}

              {/* FEATURE 4 & 9: Operational Comments Timeline */}
              <Card className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-semibold text-white">Operational Order Timeline</h3>
                  </div>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {comments.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-4">No operational comments yet.</p>
                  ) : (
                    comments.map((c) => {
                      const isAuthor = user?.id === c.userId;
                      const isEditingThis = editingCommentId === c.id;

                      return (
                        <div
                          key={c.id}
                          className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white">{c.authorName || "User"}</span>
                              <span
                                className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(
                                  c.authorEmployeeRole || c.authorRole || "Staff"
                                )}`}
                              >
                                {c.authorEmployeeRole || c.authorRole || "Staff"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <span>{formatTime(c.createdAt)}</span>
                              {isAuthor && !isEditingThis && (
                                <button
                                  onClick={() => {
                                    setEditingCommentId(c.id);
                                    setEditingCommentText(c.comment);
                                  }}
                                  className="text-indigo-400 hover:text-indigo-300 ml-1"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>

                          {isEditingThis ? (
                            <form onSubmit={handleUpdateComment} className="space-y-1.5 pt-1">
                              <textarea
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                rows={2}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white"
                                required
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingCommentId(null)}
                                  className="px-2 py-0.5 text-xs text-slate-400"
                                >
                                  Cancel
                                </button>
                                <Button type="submit" isLoading={isUpdatingComment} className="text-xs py-0.5 px-2">
                                  Save
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <p className="text-slate-200 whitespace-pre-wrap">{c.comment}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Comment Input */}
                <form onSubmit={handleAddComment} className="pt-2 border-t border-slate-800 flex gap-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Add comment (e.g. 2 damaged boxes replaced)..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <Button
                    type="submit"
                    isLoading={isSubmittingComment}
                    disabled={!newCommentText.trim()}
                    className="text-xs px-3 bg-indigo-600 hover:bg-indigo-500"
                  >
                    <Send className="w-3 h-3" />
                  </Button>
                </form>
              </Card>

              {/* Client Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-4 border border-slate-800">
                  <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                    Delivery Address
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeOrder.client?.shippingAddress || activeOrder.client?.billingAddress || "N/A"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Contact:{" "}
                    {activeOrder.client?.employees?.[0]?.contactPerson ||
                      activeOrder.client?.contactPerson ||
                      "N/A"}{" "}
                    •{" "}
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
                        ₹{Number(activeOrder.totalAmount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verify Delivery Modal with Image Evidence Upload */}
      {isVerifyOpen && activeOrder && (
        <Modal
          isOpen={isVerifyOpen}
          onClose={() => setIsVerifyOpen(false)}
          title={`Verify Delivery: ${activeOrder.orderNumber}`}
          description="Review delivered items, attach evidence photos, and confirm delivery."
          maxWidth="lg"
        >
          <form onSubmit={handleVerifyDelivery} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
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
                  <span>Verify Delivery Order Checklist</span>
                </span>
                <span className="font-mono font-semibold text-indigo-400">
                  {checkedCount} / {totalItems} items verified
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {activeOrder.items?.map((item) => {
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
                          {item.product?.name || "Order Item"}
                        </span>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-0.5">
                          <div>
                            Ordered Qty:{" "}
                            <strong className="text-slate-200 font-mono">{item.quantity}</strong>{" "}
                            {item.product?.unit || "PCS"}
                          </div>
                          <div>
                            Verified Qty:{" "}
                            <strong className="text-emerald-400 font-mono">{item.quantity}</strong>{" "}
                            {item.product?.unit || "PCS"}
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
                placeholder="Any notes about the delivery condition, missing parts, or confirmation..."
                rows={3}
                disabled={activeOrder.verificationStatus === "VERIFIED"}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Evidence Photo Upload */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  Delivery Evidence Photos
                </span>
                <span className="text-[11px] text-slate-400">Auto-compressed WebP (~1MB)</span>
              </div>

              <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl bg-slate-950/40 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs font-medium text-slate-300">Click to select photos</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleEvidenceImageSelect}
                  className="hidden"
                  disabled={isCompressing}
                />
              </label>

              {isCompressing && (
                <div className="flex items-center justify-center gap-2 p-2.5 text-xs text-indigo-300 bg-indigo-950/40 rounded-lg border border-indigo-800">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Compressing photos in background worker...</span>
                </div>
              )}

              {evidenceFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {evidenceFiles.map((item, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 group"
                    >
                      <img src={item.previewUrl} alt="Preview" className="w-full h-20 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeEvidenceFile(idx)}
                        className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/80 text-rose-400 hover:bg-rose-950"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="p-1 text-[9px] bg-slate-900/90 text-slate-300 truncate">
                        {(item.compressedSize / 1024).toFixed(0)} KB WebP
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {uploadProgress && (
              <div className="flex items-center gap-2 p-2.5 text-xs text-indigo-300 bg-indigo-950/40 rounded-lg border border-indigo-800">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                <span>{uploadProgress}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsVerifyOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isVerifying}
                disabled={!allItemsChecked || activeOrder.verificationStatus === "VERIFIED" || isCompressing}
                className={
                  allItemsChecked && !isCompressing
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

      {/* Evidence Full-Screen Lightbox Modal */}
      {previewModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewModalUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 p-2">
            <button
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/80 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewModalUrl}
              alt="Evidence Full Preview"
              className="max-h-[80vh] w-auto mx-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderTrackPage;
