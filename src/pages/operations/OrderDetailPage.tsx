import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchOrderById,
  transitionOrderStatus,
  submitOrderVerification,
  submitOrderStoreVerification,
  isClientRole,
  fetchOrderTimeline,
  deleteOrderBeforeDispatched,
  updateReceiverNotes,
  uploadDeliveryEvidence,
  getSignedDeliveryEvidenceUrl,
  addOrderComment,
  updateOrderComment
} from "@/lib/services";
import {
  Order,
  OrderStatus,
  VerificationStatus,
  OrderTimelineEvent,
  OrderComment,
  DeliveryEvidenceAttachment,
  Product,
  User as UserType
} from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { validOrderTransitions, deriveClientWorkflowStages, orderStatusBadgeStyles } from "@/lib/orderWorkflow";
import { canVerifyDelivery, canVerifyInventory } from "@/lib/permissions";
import { getRoleDisplay, getRoleBadgeStyle } from "@/lib/roleDisplay";
import { compressDeliveryImage } from "@/lib/imageCompression";
import { formatDateTime, formatDate } from "@/lib/dateUtils";
import {
  ArrowLeft,
  Calendar,
  User,
  Building,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  PackageCheck,
  DollarSign,
  Edit3,
  Trash2,
  Image as ImageIcon,
  MessageSquare,
  Send,
  Upload,
  X,
  Plus,
  ExternalLink,
  Eye,
  Loader2,
  FileText
} from "lucide-react";

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, tenant } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState<OrderTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Delivery Verification Modal - Individual Item Checkboxes & Evidence
  const [itemCheckboxes, setItemCheckboxes] = useState<Record<string, boolean>>({});
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<VerificationStatus>("VERIFIED");
  const [verifyComments, setVerifyComments] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<
    Array<{ file: File; previewUrl: string; originalSize: number; compressedSize: number }>
  >([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Signed URLs cache for existing delivery evidence
  const [evidenceSignedUrls, setEvidenceSignedUrls] = useState<Record<string, string>>({});
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Store / Inventory Verification Modal
  const [isStoreVerifyOpen, setIsStoreVerifyOpen] = useState(false);
  const [isStoreVerifying, setIsStoreVerifying] = useState(false);
  const [storeComments, setStoreComments] = useState("");
  const [confirmInventoryUpdated, setConfirmInventoryUpdated] = useState(false);

  // Delete Order Modal State
  const [isDeleteOrderOpen, setIsDeleteOrderOpen] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // Edit Receiver Notes Modal State
  const [isEditNotesOpen, setIsEditNotesOpen] = useState(false);
  const [editNotesValue, setEditNotesValue] = useState("");
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);

  // Operational Order Comments State
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);

  // Action message state
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadOrder = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setTimelineLoading(true);
      setTimelineError(null);
      // SECURITY: Pass tenantId, clientId, and role to verify client ownership
      const [data, timeline] = await Promise.all([
        fetchOrderById(
          id,
          tenant?.id || user?.tenantId,
          user?.clientId || user?.client?.id,
          role,
          user?.id
        ),
        fetchOrderTimeline(
          id,
          tenant?.id || user?.tenantId,
          user?.clientId || user?.client?.id,
          role,
          user?.id
        )
      ]);
      setOrder(data);
      setTimelineEvents(timeline);
      if (data?.comments) {
        setComments(data.comments);
      }
    } catch (err: any) {
      console.error("Error loading order or timeline:", err);
      setError(err?.message || "Failed to load order");
      setTimelineError(err?.message || "Unable to load order history.");
    } finally {
      setLoading(false);
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  // Load signed URLs for verification evidence attachments
  useEffect(() => {
    let isMounted = true;
    const loadSignedUrls = async () => {
      const atts = order?.verification?.attachments;
      if (!atts || !Array.isArray(atts)) return;
      const urls: Record<string, string> = {};
      for (const item of atts as DeliveryEvidenceAttachment[]) {
        if (item.path) {
          try {
            const signed = await getSignedDeliveryEvidenceUrl(item.path);
            if (signed) urls[item.path] = signed;
          } catch (e) {
            console.warn("Failed to load signed URL for evidence:", item.path, e);
          }
        }
      }
      if (isMounted) setEvidenceSignedUrls(urls);
    };
    loadSignedUrls();
    return () => {
      isMounted = false;
    };
  }, [order?.verification?.attachments]);

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
    setEvidenceFiles([]);
    setIsVerifyOpen(true);
    setActionMessage(null);
  };

  const handleEvidenceImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsCompressing(true);
    setActionMessage(null);
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
      console.error("Image compression failed:", err);
      setActionMessage({ type: "error", text: "Image compression failed: " + (err.message || "") });
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

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (!canVerifyDelivery(user)) {
      setActionMessage({
        type: "error",
        text: "Only authorized roles (Receiver, Manager, GM, MD) can verify deliveries."
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
    setUploadProgress(null);

    try {
      const responses =
        order.items?.map((item) => ({
          text: `${item.product?.name || "Item"} (Ordered Qty: ${item.quantity}, Verified Qty: ${item.quantity})`,
          checked: itemCheckboxes[item.id] || false,
          orderItemId: item.id,
          orderedQty: item.quantity,
          verifiedQty: item.quantity,
        })) || [];

      // Upload evidence files to private storage bucket if any
      const uploadedAttachments: DeliveryEvidenceAttachment[] = [];
      if (evidenceFiles.length > 0 && (order.tenantId || tenant?.id)) {
        const tenantId = order.tenantId || tenant?.id || "";
        for (let i = 0; i < evidenceFiles.length; i++) {
          setUploadProgress(`Uploading evidence photo ${i + 1} of ${evidenceFiles.length}...`);
          const att = await uploadDeliveryEvidence(evidenceFiles[i].file, tenantId, order.id);
          uploadedAttachments.push(att);
        }
      }

      await submitOrderVerification(
        order.id,
        verifyStatus,
        responses,
        verifyComments,
        uploadedAttachments.length > 0 ? uploadedAttachments : null,
        user?.id
      );

      setIsVerifyOpen(false);
      setEvidenceFiles([]);
      setActionMessage({
        type: "success",
        text: "Delivery verification successfully submitted with evidence! Awaiting store / inventory verification."
      });
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
      setUploadProgress(null);
    }
  };

  const handleStoreVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (!canVerifyInventory(user)) {
      setActionMessage({
        type: "error",
        text: "Only authorized roles (Store, Manager, GM, MD) can verify received inventory."
      });
      return;
    }

    if (!confirmInventoryUpdated) {
      setActionMessage({
        type: "error",
        text: "You must confirm that client inventory has been updated."
      });
      return;
    }

    setActionMessage(null);
    setIsStoreVerifying(true);

    try {
      await submitOrderStoreVerification(order.id, undefined, storeComments, true);
      setIsStoreVerifyOpen(false);
      setActionMessage({
        type: "success",
        text: "Store & inventory verification complete! Order verified, invoice ready for payment."
      });
      await loadOrder();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Store verification failed" });
    } finally {
      setIsStoreVerifying(false);
    }
  };



  const handleDeleteOrder = async () => {
    if (!order) return;
    setIsDeletingOrder(true);
    setActionMessage(null);
    try {
      await deleteOrderBeforeDispatched(order.id);
      setIsDeleteOrderOpen(false);
      navigate("/operations/orders", {
        state: { message: `Order ${order.orderNumber} was deleted successfully.` }
      });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to delete order" });
      setIsDeletingOrder(false);
    }
  };

  const handleSaveReceiverNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setIsUpdatingNotes(true);
    try {
      await updateReceiverNotes(order.id, editNotesValue);
      setIsEditNotesOpen(false);
      setActionMessage({ type: "success", text: "Receiver notes updated successfully." });
      await loadOrder();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update receiver notes" });
    } finally {
      setIsUpdatingNotes(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !newCommentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await addOrderComment(order.id, newCommentText.trim());
      setNewCommentText("");
      const updated = await fetchOrderById(
        order.id,
        tenant?.id || user?.tenantId,
        user?.clientId || user?.client?.id,
        role,
        user?.id
      );
      if (updated?.comments) setComments(updated.comments);
      setActionMessage({ type: "success", text: "Operational comment posted." });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to post comment" });
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
        order!.id,
        tenant?.id || user?.tenantId,
        user?.clientId || user?.client?.id,
        role,
        user?.id
      );
      if (updated?.comments) setComments(updated.comments);
      setActionMessage({ type: "success", text: "Comment updated." });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update comment" });
    } finally {
      setIsUpdatingComment(false);
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

  const isTenantAuthorized = Boolean(order) && (!tenant?.id || order.tenantId === tenant.id);

  // Authoritative action permission resolution
  const canPerformDelivery =
    Boolean(order) &&
    canVerifyDelivery(user) &&
    Boolean(user?.client?.id || user?.clientId) &&
    isTenantAuthorized &&
    order.status === "DISPATCHED" &&
    !order.deliveryVerifiedAt;

  const canPerformStoreVerify =
    Boolean(order) &&
    canVerifyInventory(user) &&
    Boolean(user?.client?.id || user?.clientId) &&
    isTenantAuthorized &&
    order.status === "DISPATCHED" &&
    Boolean(order.deliveryVerifiedAt) &&
    !order.storeVerifiedAt;

  // Edit / Delete allowed strictly before DISPATCHED for warehouse staff/owner
  const isPreDispatched = ["ISSUED", "PROCESSING", "READY_FOR_DISPATCH"].includes(order.status);
  const isWarehouseStaffOrAdmin =
    !isClientRole(role) &&
    ["SUPER_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_STAFF", "ADMIN"].includes(role || "");
  const canEditOrder = isPreDispatched && isWarehouseStaffOrAdmin;
  const canDeleteOrder = isPreDispatched && isWarehouseStaffOrAdmin;

  // Receiver notes can only be updated while DISPATCHED and before store verification
  const canEditReceiverNotes =
    Boolean(order.verification) &&
    order.status === "DISPATCHED" &&
    !order.storeVerifiedAt &&
    (isClientRole(role) || canVerifyDelivery(user) || user?.id === order.verification?.userId);

  // Any authorized user who can access the order can participate in operational comments
  const canAddComment =
    Boolean(order) &&
    (isWarehouseStaffOrAdmin || canVerifyDelivery(user) || isClientRole(role));

  const orderInvoicePaymentStatus =
    (order as any).invoices?.[0]?.paymentStatus || (order as any).invoice?.paymentStatus;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/operations/orders"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      {/* Action feedback message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            actionMessage.type === "success"
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
              : "bg-rose-950/60 border-rose-800 text-rose-300"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                {order.orderNumber}
              </h1>

              {/* Order Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                  order.status === "VERIFIED"
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                    : orderStatusBadgeStyles[order.status] || "bg-slate-800 text-slate-300 border-slate-700"
                }`}
              >
                <span className="text-[10px] text-slate-400 font-normal">Order:</span>
                {order.status === "VERIFIED" ? "Verified" : order.status.replace(/_/g, " ")}
              </span>

              {/* Delivery Verification Badge */}
              {order.deliveryVerifiedAt ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-950 text-emerald-300 border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Delivery: Verified
                </span>
              ) : order.status === "DISPATCHED" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-950 text-amber-300 border-amber-800">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Delivery: Pending
                </span>
              ) : null}

              {/* Inventory Verification Badge */}
              {order.storeVerifiedAt || (order.status === "VERIFIED" && order.verificationStatus === "VERIFIED") ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-950 text-emerald-300 border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Inventory: Verified
                </span>
              ) : order.deliveryVerifiedAt ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-950 text-blue-300 border-blue-800">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Inventory: Pending
                </span>
              ) : null}

              {/* Payment Status Badge */}
              {orderInvoicePaymentStatus && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    orderInvoicePaymentStatus === "PAID"
                      ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                      : orderInvoicePaymentStatus === "PAYMENT_PENDING"
                      ? "bg-amber-950 text-amber-300 border-amber-800"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  <span className="text-[10px] text-slate-400 font-normal">Payment:</span>
                  {orderInvoicePaymentStatus === "PAYMENT_PENDING"
                    ? "Pending"
                    : orderInvoicePaymentStatus.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-400" />
                Created: {formatDate(order.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Building className="w-4 h-4 text-indigo-400" />
                Client: {order.client?.companyName}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-400" />
                Contact:{" "}
                {order.client?.employees?.[0]?.contactPerson ||
                  order.client?.contactPerson ||
                  "N/A"}{" "}
                ({order.client?.employees?.[0]?.mobile || order.client?.mobile || "N/A"})
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canEditOrder && (
              <Link to={`/operations/orders/${order.id}/edit`}>
                <Button
                  variant="outline"
                  className="border-indigo-700/60 text-indigo-300 hover:bg-indigo-950/40 text-xs gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1" />
                  Edit Order
                </Button>
              </Link>
            )}

            {canDeleteOrder && (
              <Button
                variant="outline"
                onClick={() => setIsDeleteOrderOpen(true)}
                className="border-rose-800/80 text-rose-300 hover:bg-rose-950/40 text-xs gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete Order
              </Button>
            )}

            {canPerformDelivery && (
              <Button
                variant="primary"
                onClick={handleOpenVerifyModal}
                className="bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950 gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Verify Delivery Order
              </Button>
            )}

            {canPerformStoreVerify && (
              <Button
                variant="primary"
                onClick={() => {
                  setStoreComments("");
                  setConfirmInventoryUpdated(false);
                  setIsStoreVerifyOpen(true);
                  setActionMessage(null);
                }}
                className="bg-blue-600 hover:bg-blue-500 shadow-blue-950 gap-1.5"
              >
                <PackageCheck className="w-4 h-4 mr-1.5" />
                Verify Received / Inventory Updated
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 8-Stage Client Workflow Stepper */}
      <Card className="p-4 bg-slate-900/60 border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Order & Payment Lifecycle
          </h3>
          <span className="text-xs font-mono text-indigo-400 font-semibold">
            {order.status === "VERIFIED"
              ? orderInvoicePaymentStatus === "PAID"
                ? "Settled (PAID)"
                : "Payment Pending"
              : order.status}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {deriveClientWorkflowStages(order, orderInvoicePaymentStatus).map((stage, idx) => (
            <div
              key={stage.id}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                stage.state === "completed"
                  ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-300"
                  : stage.state === "current"
                  ? "bg-indigo-950/50 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/40 font-semibold"
                  : "bg-slate-950/40 border-slate-800 text-slate-500"
              }`}
            >
              <div className="flex items-center justify-center mb-1">
                {stage.state === "completed" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : stage.state === "current" ? (
                  <Clock className="w-4 h-4 text-indigo-400 animate-pulse" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[9px] text-slate-500">
                    {idx + 1}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium leading-tight">{stage.label}</p>
              <p className="text-[9px] text-slate-400 mt-0.5 truncate">{stage.detail || ""}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Grid: Order Items & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Line Items & Verification Record (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Order Line Items</h2>
              {canEditOrder && (
                <Link
                  to={`/operations/orders/${order.id}/edit`}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Items
                </Link>
              )}
            </div>
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

          {/* FEATURE 3: SEPARATE RECEIVER NOTES & EVIDENCE CARD */}
          {order.verification && (
            <Card className="border-emerald-900/40 bg-emerald-950/10 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-base font-semibold text-white">Receiver Delivery Notes & Evidence</h3>
                    <p className="text-xs text-slate-400">
                      Recorded on {new Date(order.verification.createdAt).toLocaleString()} • Status:{" "}
                      <span className="font-semibold text-emerald-300">{order.verification.status}</span>
                    </p>
                  </div>
                </div>
                {canEditReceiverNotes && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditNotesValue(order.verification?.comments || "");
                      setIsEditNotesOpen(true);
                    }}
                    className="text-xs border-emerald-700/60 text-emerald-300 hover:bg-emerald-950/50 gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    Edit Receiver Note
                  </Button>
                )}
              </div>

              {/* Note Content */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Receiver Verification Comments:
                </span>
                {order.verification.comments ? (
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {order.verification.comments}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No comments entered by receiver.</p>
                )}
              </div>

              {/* Delivered Items Checklist */}
              {order.verification.responses && order.verification.responses.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Delivered Inspection Checklist:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {order.verification.responses.map((resp, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-800/80 text-xs text-slate-300"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{resp.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FEATURE 5 & 6: Delivery Evidence Photo Gallery */}
              {Array.isArray(order.verification.attachments) &&
                order.verification.attachments.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      Delivery Evidence Photos ({order.verification.attachments.length}):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {(order.verification.attachments as DeliveryEvidenceAttachment[]).map(
                        (att, index) => {
                          const signedUrl = evidenceSignedUrls[att.path];
                          return (
                            <div
                              key={index}
                              onClick={() => signedUrl && setPreviewModalUrl(signedUrl)}
                              className="group relative rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden cursor-pointer hover:border-indigo-500 transition-all shadow-sm"
                            >
                              <div className="aspect-square w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                                {signedUrl ? (
                                  <img
                                    src={signedUrl}
                                    alt={att.fileName || "Delivery evidence"}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-slate-500 text-xs">
                                    <Loader2 className="w-5 h-5 animate-spin mb-1 text-slate-400" />
                                    <span>Loading...</span>
                                  </div>
                                )}
                              </div>
                              <div className="p-2 text-[10px] bg-slate-900/90 truncate border-t border-slate-800/60">
                                <p className="font-mono text-white truncate">{att.fileName}</p>
                                <p className="text-slate-400">{(att.size / 1024).toFixed(0)} KB</p>
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

          {/* FEATURE 4 & 9: SHARED OPERATIONAL COMMENTS TIMELINE */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-semibold text-white">Operational Order Comments</h3>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {comments.length} {comments.length === 1 ? "comment" : "comments"}
              </span>
            </div>

            {/* Comments List */}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 text-xs">
                  <MessageSquare className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                  <p>No operational comments yet.</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Use this timeline for replacements, missing items, customer confirmations, and delivery updates.
                  </p>
                </div>
              ) : (
                comments.map((c) => {
                  const isAuthor = user?.id === c.userId;
                  const isEditingThis = editingCommentId === c.id;

                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 hover:border-slate-700/80 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{c.authorName || "User"}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(
                              c.authorEmployeeRole || c.authorRole || "Staff"
                            )}`}
                          >
                            {c.authorEmployeeRole || c.authorRole || "Staff"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatDateTime(c.createdAt)}
                          </span>
                          {c.updatedAt && c.updatedAt !== c.createdAt && (
                            <span className="text-[9px] text-slate-500 italic">(edited)</span>
                          )}
                          {isAuthor && !isEditingThis && (
                            <button
                              onClick={() => {
                                setEditingCommentId(c.id);
                                setEditingCommentText(c.comment);
                              }}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 ml-1"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditingThis ? (
                        <form onSubmit={handleUpdateComment} className="space-y-2 pt-1">
                          <textarea
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            rows={2}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                            required
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingCommentText("");
                              }}
                              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <Button type="submit" isLoading={isUpdatingComment} className="text-xs py-1 px-3">
                              Save
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{c.comment}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Comment Box */}
            {canAddComment && (
              <form onSubmit={handleAddComment} className="pt-2 border-t border-slate-800 space-y-2">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Add operational comment (e.g. Missing item delivered, Replacement confirmed)..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    isLoading={isSubmittingComment}
                    disabled={!newCommentText.trim()}
                    className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Post Comment
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>

        {/* Order Status History Timeline (1 col) */}
        <div>
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                  Status History Timeline
                </h2>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {timelineEvents.length} {timelineEvents.length === 1 ? "event" : "events"}
              </span>
            </div>

            {timelineLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner message="Retrieving order history..." />
              </div>
            ) : timelineError ? (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{timelineError}</span>
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 text-xs">
                <Clock className="w-6 h-6 mx-auto mb-2 text-slate-500 opacity-60" />
                <p className="font-medium text-slate-300">No activity recorded for this order yet.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {timelineEvents.map((event) => {
                  let dotColor = "bg-indigo-500";
                  if (
                    event.type === "DELIVERY_VERIFIED" ||
                    event.type === "INVENTORY_VERIFIED" ||
                    event.type === "PAID"
                  ) {
                    dotColor = "bg-emerald-500";
                  } else if (event.type === "PAYMENT_PENDING" || event.type === "PROCESSING") {
                    dotColor = "bg-amber-500";
                  } else if (event.type === "DISPATCHED") {
                    dotColor = "bg-indigo-500";
                  } else if (event.type === "PAYMENT_RECORDED") {
                    dotColor = "bg-blue-500";
                  } else if (event.type === "CANCELLED") {
                    dotColor = "bg-rose-500";
                  }

                  return (
                    <div key={event.id} className="relative group">
                      <div
                        className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full ${dotColor} ring-4 ring-slate-900 transition-transform group-hover:scale-110`}
                      />

                      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white uppercase tracking-wide">
                            {event.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatDateTime(event.timestamp)}
                          </span>
                        </div>

                        {/* Person's Name and Role Badge */}
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="text-slate-400 text-[11px]">By:</span>
                          <span className="font-semibold text-slate-200 text-xs">{event.actorName}</span>
                          {event.actorRole && event.actorRole !== "System" ? (
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(
                                event.actorRole
                              )}`}
                            >
                              {event.actorRole}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-800 text-slate-400 border-slate-700">
                              System
                            </span>
                          )}
                        </div>

                        {/* Event notes if any */}
                        {event.notes && (
                          <p className="text-[11px] text-slate-400 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 mt-1 break-words">
                            "{event.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Verification Submission Modal with Delivery Evidence Photos */}
      {isVerifyOpen && (
        <Modal
          isOpen={isVerifyOpen}
          onClose={() => setIsVerifyOpen(false)}
          title="Verify Delivery Order"
          description={`Order ${order.orderNumber} — Verify delivered items and attach evidence photos`}
          maxWidth="lg"
        >
          <form onSubmit={handleVerificationSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
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

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
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
                            Ordered Qty: <strong className="text-slate-200 font-mono">{item.quantity}</strong>{" "}
                            {item.product?.unit || "PCS"}
                          </div>
                          <div>
                            Verified Qty: <strong className="text-emerald-400 font-mono">{item.quantity}</strong>{" "}
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
                  {verifiedCount} / {totalItems} items verified
                </span>
              </div>
            </div>

            {/* Receiver Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Receiver Verification Comments
              </label>
              <textarea
                value={verifyComments}
                onChange={(e) => setVerifyComments(e.target.value)}
                placeholder="Details of delivery inspection (packaging, count, condition)..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            {/* FEATURE 5, 7, 8: Image Picker, Compression, Preview */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  Delivery Evidence Photos
                </span>
                <span className="text-[11px] text-slate-400">Auto-compressed to WebP (~1MB)</span>
              </div>

              {/* Upload Input */}
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl bg-slate-950/40 cursor-pointer transition-colors">
                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs font-medium text-slate-300">Click to select photos</span>
                <span className="text-[10px] text-slate-500 mt-0.5">JPEG, PNG, WebP supported</span>
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
                <div className="flex items-center justify-center gap-2 p-3 text-xs text-indigo-300 bg-indigo-950/40 rounded-lg border border-indigo-800">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Compressing image with browser worker...</span>
                </div>
              )}

              {/* Selected Images Previews */}
              {evidenceFiles.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {evidenceFiles.map((item, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 group"
                    >
                      <img src={item.previewUrl} alt="Preview" className="w-full h-24 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeEvidenceFile(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 text-rose-400 hover:bg-rose-950 hover:text-rose-300 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="p-1.5 text-[10px] bg-slate-900/90 text-slate-300 truncate">
                        <span className="truncate block font-mono">{item.file.name}</span>
                        <span className="text-[9px] text-emerald-400">
                          {(item.compressedSize / 1024).toFixed(0)} KB WebP
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {uploadProgress && (
              <div className="flex items-center gap-2 p-3 text-xs text-indigo-300 bg-indigo-950/40 rounded-lg border border-indigo-800">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                <span>{uploadProgress}</span>
              </div>
            )}

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
                disabled={!allItemsChecked || isCompressing}
                className={
                  allItemsChecked && !isCompressing
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                }
              >
                Submit Verification Record
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Store / Inventory Verification Modal */}
      {isStoreVerifyOpen && (
        <Modal
          isOpen={isStoreVerifyOpen}
          onClose={() => setIsStoreVerifyOpen(false)}
          title="Verify Store / Inventory Update"
          description={`Order ${order.orderNumber} — Confirm that goods are received into stock and client inventory is updated.`}
          maxWidth="md"
        >
          <form onSubmit={handleStoreVerificationSubmit} className="space-y-4">
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Storekeeper Checklist
              </h4>
              <p className="text-xs text-slate-400">
                Delivery was inspected and accepted on{" "}
                {order.deliveryVerifiedAt ? formatDateTime(order.deliveryVerifiedAt) : "N/A"}.
              </p>
              <div className="pt-2">
                <label className="flex items-start gap-3 p-3 rounded-lg border bg-slate-950/40 border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmInventoryUpdated}
                    onChange={(e) => setConfirmInventoryUpdated(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white block">
                      Confirm Goods Received & Inventory Updated
                    </span>
                    <span className="text-slate-400 block mt-0.5">
                      I verify that the delivered quantities have been accepted into store and internal inventory
                      balances are updated.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Store Verification Notes (Optional)
              </label>
              <textarea
                value={storeComments}
                onChange={(e) => setStoreComments(e.target.value)}
                placeholder="Storage location, batch verification, or inventory software reference..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsStoreVerifyOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isStoreVerifying}
                disabled={!confirmInventoryUpdated}
                className={
                  confirmInventoryUpdated
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                }
              >
                Confirm & Complete Verification
              </Button>
            </div>
          </form>
        </Modal>
      )}



      {/* FEATURE 2 & 11: DELETE ORDER CONFIRMATION MODAL (PRE-DISPATCH ONLY) */}
      {isDeleteOrderOpen && (
        <Modal
          isOpen={isDeleteOrderOpen}
          onClose={() => setIsDeleteOrderOpen(false)}
          title="Confirm Delete Order"
          description="This action is permanent and cannot be undone."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Delete Order {order.orderNumber}?</span>
              </div>
              <p>
                You are about to delete order <strong className="text-white">{order.orderNumber}</strong> for client{" "}
                <strong className="text-white">{order.client?.companyName}</strong>.
              </p>
              <p>
                Current Status: <span className="font-semibold uppercase">{order.status}</span>
              </p>
              <p className="text-[11px] text-rose-400">
                All associated order items and dependent invoice records will be safely cleaned up. Deletion is
                strictly blocked once an order reaches DISPATCHED.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteOrderOpen(false)}
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

      {/* FEATURE 3: EDIT RECEIVER NOTES MODAL */}
      {isEditNotesOpen && (
        <Modal
          isOpen={isEditNotesOpen}
          onClose={() => setIsEditNotesOpen(false)}
          title="Edit Receiver Notes"
          description={`Update receiver notes for order ${order.orderNumber} before final store verification.`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveReceiverNotes} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Receiver Notes</label>
              <textarea
                value={editNotesValue}
                onChange={(e) => setEditNotesValue(e.target.value)}
                placeholder="Enter updated delivery verification notes..."
                rows={4}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditNotesOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isUpdatingNotes} className="bg-emerald-600 hover:bg-emerald-500">
                Save Receiver Notes
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
            <img src={previewModalUrl} alt="Evidence Full Preview" className="max-h-[80vh] w-auto mx-auto rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailPage;
