import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchPendingVerificationOrders,
  submitOrderVerification,
  fetchOrderById,
  uploadDeliveryEvidence,
  addDeliveryEvidence,
  getSignedDeliveryEvidenceUrl,
  getOrderComments,
  addOrderComment,
  updateOrderComment,
  isClientRole
} from "@/lib/services";
import {
  Order,
  OrderStatus,
  VerificationStatus,
  OrderComment,
  DeliveryEvidenceAttachment,
  ItemVerificationStatus,
  VerificationItemResponse
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
  Plus,
  ShieldAlert,
  Tag
} from "lucide-react";
import { Link } from "react-router-dom";
import { canVerifyDelivery, canVerifyInventory } from "@/lib/permissions";
import { getRoleBadgeStyle } from "@/lib/roleDisplay";
import { compressDeliveryImage } from "@/lib/imageCompression";
import { formatTime, formatDateTime } from "@/lib/dateUtils";
import { getOrderProgressSteps, getDeliveryProgress, isOrderDeliveryVerified } from "@/lib/orderWorkflow";

// Quick suggestion chips for item-level verification notes
const QUICK_ITEM_NOTES = [
  "Missing item delivered",
  "Damaged item replaced",
  "Short quantity confirmed",
  "Replacement supplied",
  "Client accepted replacement",
  "Item missing at delivery"
];

const ITEM_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Verified: { bg: "bg-emerald-950/60", text: "text-emerald-400", border: "border-emerald-800" },
  Missing: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-800" },
  Damaged: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-800" },
  Replaced: { bg: "bg-blue-950/60", text: "text-blue-400", border: "border-blue-800" },
  Other: { bg: "bg-slate-800/60", text: "text-slate-300", border: "border-slate-700" },
  VERIFIED: { bg: "bg-emerald-950/60", text: "text-emerald-400", border: "border-emerald-800" },
  MISSING: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-800" },
  DAMAGED: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-800" },
  REPLACED: { bg: "bg-blue-950/60", text: "text-blue-400", border: "border-blue-800" },
  OTHER: { bg: "bg-slate-800/60", text: "text-slate-300", border: "border-slate-700" }
};

interface ItemVerificationState {
  checked: boolean;
  status: ItemVerificationStatus;
  notes: string;
}

export const OrderTrackPage: React.FC = () => {
  const { user, tenant, role } = useAuth();

  // Role and verification access
  const isWarehouseUser = ["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"].includes(role);
  const hasVerificationAccess = canVerifyDelivery(user) || canVerifyInventory(user);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "PENDING" | "VERIFIED">("ALL");

  // Verification Modal State
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationComments, setVerificationComments] = useState("");
  const [itemStates, setItemStates] = useState<Record<string, ItemVerificationState>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delivery Evidence State (in verification modal)
  const [evidenceFiles, setEvidenceFiles] = useState<
    Array<{ file: File; previewUrl: string; originalSize: number; compressedSize: number }>
  >([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Additional Warehouse Evidence Upload Modal State
  const [isWarehouseUploadOpen, setIsWarehouseUploadOpen] = useState(false);
  const [warehouseFiles, setWarehouseFiles] = useState<
    Array<{ file: File; previewUrl: string; originalSize: number; compressedSize: number }>
  >([]);
  const [isCompressingWarehouse, setIsCompressingWarehouse] = useState(false);
  const [isUploadingWarehouse, setIsUploadingWarehouse] = useState(false);

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
  const [tabCounts, setTabCounts] = useState<{ all: number; pending: number; verified: number }>({
    all: 0,
    pending: 0,
    verified: 0
  });

  const isDeliveryVerified = isOrderDeliveryVerified;

  const loadOrders = async () => {
    if (!tenant?.id) {
      setLoading(false);
      return;
    }
    if (isClientRole(role) && !user?.client?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const allList = await fetchPendingVerificationOrders(
        user?.client?.id || null,
        tenant.id,
        role,
        "ALL"
      );

      const pendingOrders = allList.filter((o) => !isDeliveryVerified(o));
      const verifiedOrders = allList.filter((o) => isDeliveryVerified(o));

      setTabCounts({
        all: allList.length,
        pending: pendingOrders.length,
        verified: verifiedOrders.length
      });

      const currentList =
        filterTab === "PENDING"
          ? pendingOrders
          : filterTab === "VERIFIED"
          ? verifiedOrders
          : allList;

      setOrders(currentList);

      if (currentList.length > 0) {
        const nextId =
          selectedOrderId && currentList.some((o) => o.id === selectedOrderId)
            ? selectedOrderId
            : currentList[0].id;
        setSelectedOrderId(nextId);
        const activeItem = currentList.find((o) => o.id === nextId) || currentList[0];
        setAlreadyVerified(isDeliveryVerified(activeItem));
        await loadOrderDetails(nextId);
      } else {
        setSelectedOrderId("");
        setAlreadyVerified(false);
        setActiveOrderFull(null);
      }
    } catch (err) {
      console.error("Error loading delivery tracking orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [tenant?.id, user?.client?.id, filterTab]);

  const loadOrderDetails = async (orderId: string) => {
    try {
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
        setAlreadyVerified(isDeliveryVerified(order));
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

  // If user doesn't have verification access, show unauthorized card
  const isUnauthorized = !hasVerificationAccess;

  // Filter orders by search
  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(term) ||
      o.client?.companyName?.toLowerCase().includes(term)
    );
  });

  // Count verified items
  const totalItems = activeOrder?.items?.length || 0;
  const checkedCount = Object.values(itemStates).filter((s) => s.checked).length;
  const allItemsChecked = totalItems > 0 && checkedCount === totalItems;

  const handleToggleItemCheckbox = (itemId: string, checked: boolean) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { status: "Verified", notes: "" }),
        checked
      }
    }));
  };

  const handleItemStatusChange = (itemId: string, status: ItemVerificationStatus) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { checked: true, notes: "" }),
        checked: true,
        status
      }
    }));
  };

  const handleItemNotesChange = (itemId: string, notes: string) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { checked: true, status: "Verified" }),
        notes
      }
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

  const handleWarehouseImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsCompressingWarehouse(true);
    setActionError(null);
    try {
      for (const file of files) {
        const compressed = await compressDeliveryImage(file);
        const previewUrl = URL.createObjectURL(compressed);
        setWarehouseFiles((prev) => [
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
      console.error("Warehouse evidence compression failed:", err);
      setActionError("Image compression failed: " + (err.message || ""));
    } finally {
      setIsCompressingWarehouse(false);
      if (e.target) e.target.value = "";
    }
  };

  const removeWarehouseFile = (index: number) => {
    setWarehouseFiles((prev) => {
      const item = prev[index];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleVerifyDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    if (isDeliveryVerified(activeOrder)) return;

    setIsVerifying(true);
    setActionError(null);
    setUploadProgress(null);

    try {
      const isOverride = isWarehouseUser;
      const source = isOverride ? "WAREHOUSE" : "CLIENT";

      // Convert item checklist with status and notes
      const responses: VerificationItemResponse[] =
        activeOrder.items?.map((item) => {
          const state = itemStates[item.id] || { checked: true, status: "Verified", notes: "" };
          return {
            text: `${item.product?.name || "Item"} - ${state.status}${state.notes ? `: ${state.notes}` : ""} (Ordered: ${item.quantity}, Verified: ${item.quantity})`,
            checked: state.checked,
            orderItemId: item.id,
            productId: item.productId,
            productName: item.product?.name,
            orderedQty: item.quantity,
            verifiedQty: item.quantity,
            status: state.status,
            notes: state.notes
          };
        }) || [];

      // Upload evidence files to private storage bucket if any
      const uploadedAttachments: DeliveryEvidenceAttachment[] = [];
      const tenantId = activeOrder.tenantId || tenant?.id || "";
      if (evidenceFiles.length > 0 && tenantId) {
        for (let i = 0; i < evidenceFiles.length; i++) {
          setUploadProgress(`Uploading evidence photo ${i + 1} of ${evidenceFiles.length}...`);
          const att = await uploadDeliveryEvidence(
            evidenceFiles[i].file,
            tenantId,
            activeOrder.id,
            source,
            user?.id,
            role
          );
          uploadedAttachments.push(att);
        }
      }

      await submitOrderVerification(
        activeOrder.id,
        "VERIFIED",
        responses,
        verificationComments,
        uploadedAttachments.length > 0 ? uploadedAttachments : null,
        user?.id
      );

      setIsVerifyOpen(false);
      setEvidenceFiles([]);
      setSuccessMsg(
        isOverride
          ? `Order ${activeOrder.orderNumber} verification completed via Warehouse Override!`
          : `Order ${activeOrder.orderNumber} verified successfully!`
      );
      setVerificationComments("");
      setItemStates({});
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

  const handleUploadWarehouseEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || warehouseFiles.length === 0) return;
    setIsUploadingWarehouse(true);
    setActionError(null);

    try {
      const tenantId = activeOrder.tenantId || tenant?.id || "";
      const uploadedAtts: DeliveryEvidenceAttachment[] = [];

      for (let i = 0; i < warehouseFiles.length; i++) {
        const att = await uploadDeliveryEvidence(
          warehouseFiles[i].file,
          tenantId,
          activeOrder.id,
          "WAREHOUSE",
          user?.id,
          role
        );
        uploadedAtts.push(att);
      }

      await addDeliveryEvidence(activeOrder.id, uploadedAtts, "WAREHOUSE");

      setIsWarehouseUploadOpen(false);
      setWarehouseFiles([]);
      setSuccessMsg(`Added ${uploadedAtts.length} warehouse evidence photo(s) to order ${activeOrder.orderNumber}`);
      await loadOrderDetails(activeOrder.id);
    } catch (err: any) {
      console.error("Failed to add warehouse evidence:", err);
      setActionError(err?.message || "Failed to upload warehouse evidence");
    } finally {
      setIsUploadingWarehouse(false);
    }
  };

  const handleOpenVerifyModal = () => {
    if (!activeOrder || isDeliveryVerified(activeOrder)) return;
    const initialStates: Record<string, ItemVerificationState> = {};
    activeOrder.items?.forEach((item) => {
      initialStates[item.id] = {
        checked: true,
        status: "Verified",
        notes: ""
      };
    });
    setItemStates(initialStates);
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

  // Separate evidence into Client and Warehouse
  const allAttachments = (activeOrderFull?.verification?.attachments || []) as DeliveryEvidenceAttachment[];
  const clientEvidence = Array.isArray(allAttachments)
    ? allAttachments.filter((att) => att.source === "CLIENT" || (!att.source && !att.uploaderRole?.includes("WAREHOUSE")))
    : [];
  const warehouseEvidence = Array.isArray(allAttachments)
    ? allAttachments.filter(
        (att) =>
          att.source === "WAREHOUSE" ||
          att.source === "WAREHOUSE_OVERRIDE" ||
          (att.uploaderRole && att.uploaderRole.includes("WAREHOUSE"))
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-400" /> Live Delivery Tracker
          </h1>
          <p className="text-sm text-slate-400">
            {isWarehouseUser
              ? "Monitor dispatched deliveries, record warehouse verification overrides, and manage evidence."
              : "Track delivery status, verify received items, attach evidence, and collaborate."}
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

      {/* Unauthorized state */}
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
        <LoadingSpinner message="Loading deliveries..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Dispatched Deliveries List */}
          <div className="space-y-3">
            {/* Filter Tabs - Always visible: All Dispatched -> Pending Verification -> Verified */}
            <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs gap-1">
              <button
                type="button"
                onClick={() => setFilterTab("ALL")}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                  filterTab === "ALL"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>All Dispatched</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    filterTab === "ALL"
                      ? "bg-indigo-800 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {tabCounts.all}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("PENDING")}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                  filterTab === "PENDING"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Pending Verification</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    filterTab === "PENDING"
                      ? "bg-indigo-800 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {tabCounts.pending}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("VERIFIED")}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                  filterTab === "VERIFIED"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Verified</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    filterTab === "VERIFIED"
                      ? "bg-indigo-800 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {tabCounts.verified}
                </span>
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search order or client..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredOrders.length === 0 ? (
                <div className="p-6 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/80 text-slate-400">
                    {filterTab === "PENDING" ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : filterTab === "VERIFIED" ? (
                      <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <Package className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-white">
                    {filterTab === "PENDING"
                      ? "No pending verifications"
                      : filterTab === "VERIFIED"
                      ? "No verified deliveries yet"
                      : "No dispatched deliveries"}
                  </h4>
                  <p className="text-[11px] text-slate-400 whitespace-pre-line">
                    {filterTab === "PENDING"
                      ? "All dispatched deliveries have been verified."
                      : filterTab === "VERIFIED"
                      ? "Verified deliveries will appear here after client\nor warehouse verification."
                      : "Dispatched orders will appear here."}
                  </p>
                </div>
              ) : (
                filteredOrders.map((o) => {
                  const isSelected = o.id === activeOrder?.id;
                  const isVerified = isDeliveryVerified(o);
                  const isOverride = o.verification?.source === "WAREHOUSE_OVERRIDE";

                  const verificationBadge = !isVerified ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800">
                      Pending Verification
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        isOverride
                          ? "bg-amber-950/70 text-amber-300 border-amber-800"
                          : "bg-emerald-950 text-emerald-400 border-emerald-800"
                      }`}
                    >
                      {isOverride ? "Warehouse Override" : "Client Verified"}
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
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Order Details */}
          {activeOrder ? (
            <div className="lg:col-span-2 space-y-5">
              {/* Order Details Header Card */}
              <Card className="p-5 border border-slate-800 bg-slate-900/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-white font-mono">{activeOrder.orderNumber}</h2>
                      {isDeliveryVerified(activeOrder) ? (
                        activeOrder.verification?.source === "WAREHOUSE_OVERRIDE" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-800">
                            <ShieldAlert className="w-3 h-3 text-amber-400" />
                            WAREHOUSE OVERRIDE VERIFIED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            CLIENT VERIFIED
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800">
                          PENDING DELIVERY VERIFICATION
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

                  {/* Actions for Verification */}
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {!isDeliveryVerified(activeOrder) ? (
                      canVerifyDelivery(user) && (
                        <Button
                          onClick={handleOpenVerifyModal}
                          className={`gap-1.5 ${
                            isWarehouseUser
                              ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950"
                          }`}
                        >
                          <ClipboardCheck className="w-4 h-4" />
                          {isWarehouseUser ? "Verify Delivery (Warehouse Override)" : "Verify Delivery Order"}
                        </Button>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          {activeOrder.verification?.source === "WAREHOUSE_OVERRIDE"
                            ? "Verified by Warehouse"
                            : "Verified by Client"}
                        </div>
                        {isWarehouseUser && (
                          <Button
                            variant="outline"
                            onClick={() => setIsWarehouseUploadOpen(true)}
                            className="text-xs gap-1.5 border-indigo-700/50 text-indigo-300 hover:bg-indigo-950/40"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Add Warehouse Evidence
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Stepper */}
                <div className="py-3">
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 z-0" />
                    {getDeliveryProgress(activeOrder).map((stepInfo) => (
                      <div key={stepInfo.step} className="relative z-10 flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition ${
                            stepInfo.isCompleted
                              ? "bg-emerald-600 border-emerald-400 text-white"
                              : stepInfo.isCurrent
                              ? "bg-indigo-600 border-indigo-400 text-white animate-pulse"
                              : "bg-slate-900 border-slate-700 text-slate-500"
                          }`}
                        >
                          {stepInfo.isCompleted ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-semibold mt-2 text-center max-w-[70px] leading-tight ${
                            stepInfo.isCompleted || stepInfo.isCurrent ? "text-white" : "text-slate-500"
                          }`}
                        >
                          {stepInfo.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Order Items & Delivery Verification Status Card (No duplicate checkboxes) */}
              <Card className="p-0 overflow-hidden border border-slate-800">
                <div className="bg-slate-950/40 px-5 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Order Items & Delivery Status
                    </span>
                  </div>
                  <span className="text-xs font-mono text-indigo-400 font-semibold">
                    {activeOrder.items?.length || 0} items
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {activeOrder.items?.map((item) => {
                    const matchedResponse = activeOrder.verification?.responses?.find(
                      (vi: VerificationItemResponse) => vi.orderItemId === item.id || vi.productId === item.productId
                    );
                    const isVerified = isDeliveryVerified(activeOrder);
                    const statusText = (matchedResponse?.status as ItemVerificationStatus) || "Verified";

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border bg-slate-900/50 border-slate-800 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-white">
                                {item.product?.name || "Product Item"}
                              </p>
                              {isVerified ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                    ITEM_STATUS_COLORS[statusText]?.bg || "bg-emerald-950"
                                  } ${
                                    ITEM_STATUS_COLORS[statusText]?.text || "text-emerald-400"
                                  } ${
                                    ITEM_STATUS_COLORS[statusText]?.border || "border-emerald-800"
                                  }`}
                                >
                                  {statusText}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-amber-950/60 text-amber-400 border-amber-800/80">
                                  Pending Verification
                                </span>
                              )}
                            </div>

                            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-400">
                              <div>
                                SKU: <strong className="text-slate-300 font-mono">{item.product?.sku || "N/A"}</strong>
                              </div>
                              <div>
                                Ordered Qty:{" "}
                                <strong className="text-white font-mono">{item.quantity}</strong>{" "}
                                {item.product?.unit || "PCS"}
                              </div>
                              <div>
                                Unit Price:{" "}
                                <strong className="text-slate-300 font-mono">₹{Number(item.unitPrice || 0).toLocaleString("en-IN")}</strong>
                              </div>
                              <div>
                                Line Total:{" "}
                                <strong className="text-emerald-400 font-mono">
                                  ₹{Number(item.total || item.unitPrice * item.quantity || 0).toLocaleString("en-IN")}
                                </strong>
                              </div>
                            </div>

                            {matchedResponse?.notes && (
                              <div className="mt-2 text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-lg p-2">
                                <span className="text-slate-500 font-medium mr-1.5">Verification Note:</span>
                                {matchedResponse.notes}
                              </div>
                            )}
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
                    <span className="text-xs text-slate-400 font-medium">Delivery Verification:</span>
                    <p className="text-sm font-bold">
                      {isDeliveryVerified(activeOrder) ? (
                        <span className="text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          {activeOrder.verification?.source === "WAREHOUSE_OVERRIDE"
                            ? "Verified by Warehouse"
                            : "Verified by Client"}
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          Pending Delivery Verification
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isDeliveryVerified(activeOrder) && canVerifyDelivery(user) && (
                      <Button
                        onClick={handleOpenVerifyModal}
                        className={`gap-1.5 w-full sm:w-auto ${
                          isWarehouseUser
                            ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950"
                        }`}
                      >
                        <ClipboardCheck className="w-4 h-4" />
                        {isWarehouseUser ? "Verify Delivery (Warehouse Override)" : "Verify Delivery Order"}
                      </Button>
                    )}
                    {isDeliveryVerified(activeOrder) &&
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

              {/* Receiver Notes & Evidence Display (Client Evidence vs Warehouse Evidence) */}
              {activeOrderFull?.verification && (
                <Card className="border border-slate-800 bg-slate-900/90 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold text-white">Delivery Verification Summary</h3>
                        <p className="text-[11px] text-slate-400">
                          Recorded on {formatDateTime(activeOrderFull.verification.createdAt)} • Status:{" "}
                          <span className="font-semibold text-emerald-300">
                            {activeOrderFull.verification.status}
                          </span>
                        </p>
                        {(() => {
                          const vUser = activeOrderFull.verification.user;
                          let displayName = vUser?.name;
                          const isUuid = displayName && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(displayName);
                          if ((!displayName || isUuid) && user && (user.id === activeOrderFull.verification.userId || user.supabaseUserId === activeOrderFull.verification.userId)) {
                            displayName = user.name;
                          }
                          if (!displayName || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(displayName)) {
                            displayName = activeOrderFull.verification.source === "WAREHOUSE_OVERRIDE" ? "Warehouse Staff" : "Client User";
                          }
                          const roleLabel = activeOrderFull.verification.verifiedByRole?.replace(/_/g, " ") || vUser?.role?.replace(/_/g, " ") || (activeOrderFull.verification.source === "WAREHOUSE_OVERRIDE" ? "WAREHOUSE OWNER" : "CLIENT");
                          return (
                            <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-400">By:</span>
                              <strong className="text-white font-medium">{displayName}</strong>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase font-semibold">
                                {roleLabel}
                              </span>
                            </p>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeOrderFull.verification.source === "WAREHOUSE_OVERRIDE" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          Warehouse Override ({activeOrderFull.verification.verifiedByRole || "Staff"})
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                          Client Verified
                        </span>
                      )}

                      {/* Standalone Add Warehouse Evidence Button */}
                      {isWarehouseUser && (
                        <Button
                          variant="outline"
                          onClick={() => setIsWarehouseUploadOpen(true)}
                          className="text-xs gap-1 border-indigo-700/60 text-indigo-300 hover:bg-indigo-950/50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Warehouse Evidence
                        </Button>
                      )}
                    </div>
                  </div>

                  {activeOrderFull.verification.comments && (
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-200">
                      <span className="font-semibold text-slate-400 block mb-1">Verification Comments:</span>
                      {activeOrderFull.verification.comments}
                    </div>
                  )}

                  {/* 2E: CLIENT EVIDENCE PHOTOS */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> Client Evidence ({clientEvidence.length}):
                      </span>
                    </div>

                    {clientEvidence.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-2 bg-slate-950/30 rounded-lg">
                        No client evidence uploaded.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {clientEvidence.map((att, idx) => {
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
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2E: WAREHOUSE EVIDENCE PHOTOS */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-400" /> Warehouse Evidence ({warehouseEvidence.length}):
                      </span>
                    </div>

                    {warehouseEvidence.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-2 bg-slate-950/30 rounded-lg">
                        No warehouse evidence uploaded yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {warehouseEvidence.map((att, idx) => {
                          const signedUrl = evidenceSignedUrls[att.path];
                          return (
                            <div
                              key={idx}
                              onClick={() => signedUrl && setPreviewModalUrl(signedUrl)}
                              className="group relative rounded-lg border border-amber-900/50 bg-slate-950 overflow-hidden cursor-pointer hover:border-amber-500 transition-all"
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
                              <div className="p-1 text-[9px] bg-slate-900 text-amber-300 truncate">
                                {att.fileName}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Operational Comments Timeline */}
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

              {/* Client Information & Summary */}
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
          ) : (
            <div className="lg:col-span-2">
              <Card className="p-12 text-center border border-slate-800 bg-slate-900/50 flex flex-col items-center justify-center min-h-[350px]">
                <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 mb-3">
                  <Package className="w-7 h-7" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  {filterTab === "PENDING"
                    ? "No pending verifications"
                    : filterTab === "VERIFIED"
                    ? "No verified deliveries yet"
                    : "No dispatched deliveries"}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm whitespace-pre-line">
                  {filterTab === "PENDING"
                    ? "All dispatched deliveries have been verified."
                    : filterTab === "VERIFIED"
                    ? "Verified deliveries will appear here after client\nor warehouse verification."
                    : "Dispatched orders will appear here."}
                </p>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Verify Delivery Modal (Client Verification OR Warehouse Override) */}
      {isVerifyOpen && activeOrder && (
        <Modal
          isOpen={isVerifyOpen}
          onClose={() => setIsVerifyOpen(false)}
          title={
            isWarehouseUser
              ? `Warehouse Delivery Override: ${activeOrder.orderNumber}`
              : `Verify Delivery: ${activeOrder.orderNumber}`
          }
          description={
            isWarehouseUser
              ? "Record authorized warehouse verification override, update item conditions, and attach warehouse evidence."
              : "Review delivered items, attach evidence photos, and confirm delivery acceptance."
          }
          maxWidth="lg"
        >
          <form onSubmit={handleVerifyDelivery} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {actionError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {actionError}
              </div>
            )}

            {isWarehouseUser && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/80 text-xs text-amber-200 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 font-semibold block">Warehouse Override Action</strong>
                  <span>
                    You are performing an authorized warehouse delivery override on behalf of{" "}
                    <strong>{user?.name || "Warehouse Staff"}</strong>. This action will be recorded in the
                    official audit log as a warehouse verification override.
                  </span>
                </div>
              </div>
            )}

            {/* Item Checklist in Modal */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                <span className="font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>Item-by-Item Verification</span>
                </span>
                <span className="font-mono font-semibold text-indigo-400">
                  {checkedCount} / {totalItems} items checked
                </span>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {activeOrder.items?.map((item) => {
                  const state = itemStates[item.id] || {
                    checked: false,
                    status: "Verified",
                    notes: ""
                  };

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border text-xs transition-all space-y-2 ${
                        state.checked
                          ? "bg-indigo-950/30 border-indigo-500/60 shadow-sm"
                          : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={state.checked}
                          onChange={(e) => handleToggleItemCheckbox(item.id, e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-semibold text-white block text-sm">
                              {item.product?.name || "Order Item"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                ITEM_STATUS_COLORS[state.status]?.bg
                              } ${ITEM_STATUS_COLORS[state.status]?.text} ${
                                ITEM_STATUS_COLORS[state.status]?.border
                              }`}
                            >
                              {state.status}
                            </span>
                          </div>
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

                      {/* Status Selector & Notes */}
                      <div className="pl-7 space-y-2 pt-1 border-t border-slate-800/60">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-medium">Condition:</span>
                          {(["Verified", "Missing", "Damaged", "Replaced", "Other"] as ItemVerificationStatus[]).map(
                            (st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => handleItemStatusChange(item.id, st)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                                  state.status === st
                                    ? `${ITEM_STATUS_COLORS[st].bg} ${ITEM_STATUS_COLORS[st].text} ${ITEM_STATUS_COLORS[st].border}`
                                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                }`}
                              >
                                {st}
                              </button>
                            )
                          )}
                        </div>

                        {/* Free-form notes with suggestions */}
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={state.notes}
                            onChange={(e) => handleItemNotesChange(item.id, e.target.value)}
                            placeholder="Type notes (e.g. Missing item delivered, Damaged item replaced)..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[9px] text-slate-500">Quick chips:</span>
                            {QUICK_ITEM_NOTES.map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => handleItemNotesChange(item.id, chip)}
                                className="px-1.5 py-0.5 rounded text-[9px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 border border-slate-800 transition"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overall Verification Comments */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Overall Inspection Notes & Verification Comments (Optional)
              </label>
              <textarea
                value={verificationComments}
                onChange={(e) => setVerificationComments(e.target.value)}
                placeholder="Any delivery condition notes, overall discrepancies, customer confirmation notes..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Evidence Photo Upload */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  {isWarehouseUser ? "Warehouse Delivery Evidence Photos" : "Delivery Evidence Photos"}
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
                disabled={!allItemsChecked || isDeliveryVerified(activeOrder) || isCompressing}
                className={
                  allItemsChecked && !isCompressing
                    ? isWarehouseUser
                      ? "bg-amber-600 hover:bg-amber-500 text-white"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                }
              >
                {isWarehouseUser ? "Confirm Warehouse Override Verification" : "Confirm Delivery Verification"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Standalone Add Warehouse Evidence Modal (2D & 2E) */}
      {isWarehouseUploadOpen && activeOrder && (
        <Modal
          isOpen={isWarehouseUploadOpen}
          onClose={() => setIsWarehouseUploadOpen(false)}
          title={`Add Warehouse Evidence: ${activeOrder.orderNumber}`}
          description="Upload additional warehouse-side evidence photos. Existing client and warehouse evidence will be preserved."
        >
          <form onSubmit={handleUploadWarehouseEvidenceSubmit} className="space-y-4 pt-1">
            {actionError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {actionError}
              </div>
            )}

            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-xl bg-slate-950/40 cursor-pointer transition-colors">
              <Upload className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-xs font-medium text-slate-300">Click to select warehouse evidence photos</span>
              <span className="text-[11px] text-slate-500 mt-1">JPEG, PNG, WebP (auto-compressed to ~1MB)</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleWarehouseImageSelect}
                className="hidden"
                disabled={isCompressingWarehouse}
              />
            </label>

            {isCompressingWarehouse && (
              <div className="flex items-center justify-center gap-2 p-2.5 text-xs text-indigo-300 bg-indigo-950/40 rounded-lg border border-indigo-800">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Compressing photos...</span>
              </div>
            )}

            {warehouseFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {warehouseFiles.map((item, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 group"
                  >
                    <img src={item.previewUrl} alt="Preview" className="w-full h-20 object-cover" />
                    <button
                      type="button"
                      onClick={() => removeWarehouseFile(idx)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/80 text-rose-400 hover:bg-rose-950"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="p-1 text-[9px] bg-slate-900/90 text-amber-300 truncate">
                      {(item.compressedSize / 1024).toFixed(0)} KB WebP
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsWarehouseUploadOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isUploadingWarehouse}
                disabled={warehouseFiles.length === 0 || isCompressingWarehouse}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                Upload Warehouse Evidence
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
