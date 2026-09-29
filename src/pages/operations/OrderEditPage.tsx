import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchOrderById,
  fetchProducts,
  fetchEmployees,
  updateOrderBeforeDispatched
} from "@/lib/services";
import { Order, Product, User as UserType } from "@/types";
import { OrderForm, OrderFormValues } from "@/components/orders/OrderForm";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Edit3, AlertTriangle, ShieldAlert } from "lucide-react";

export const OrderEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, tenant, role } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<UserType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setActionError(null);
        const [orderData, prodList, staffList] = await Promise.all([
          fetchOrderById(
            id,
            tenant?.id || user?.tenantId,
            user?.clientId || user?.client?.id,
            role,
            user?.id
          ),
          fetchProducts(tenant?.id || user?.tenantId),
          fetchEmployees(tenant?.id || user?.tenantId)
        ]);

        if (!orderData) {
          setActionError("Order not found or access denied.");
        } else {
          setOrder(orderData);
        }
        setProducts(prodList as Product[]);
        setStaff(staffList as UserType[]);
      } catch (err: any) {
        console.error("Error loading order for editing:", err);
        setActionError(err?.message || "Failed to load order.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, tenant?.id, user?.tenantId, role]);

  const handleSaveOrder = async (values: OrderFormValues) => {
    if (!order) return;

    if (!["ISSUED", "PROCESSING", "READY_FOR_DISPATCH"].includes(order.status)) {
      setActionError(`Editing is not permitted once an order reaches ${order.status}.`);
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      await updateOrderBeforeDispatched({
        orderId: order.id,
        expectedDelivery: values.expectedDelivery || null,
        notes: values.notes || null,
        assignedStaffId: values.assignedStaffId || null,
        items: values.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          discount: it.discount || 0
        }))
      });

      navigate(`/operations/orders/${order.id}`, {
        state: { message: `Order ${order.orderNumber} updated successfully before dispatch.` }
      });
    } catch (err: any) {
      console.error("Failed to update order:", err);
      setActionError(err?.message || "Failed to update order");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading order details and catalog products..." />;
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-4">
        <div className="inline-flex p-3 rounded-full bg-rose-950/60 border border-rose-800 text-rose-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Order Not Found</h2>
        <p className="text-sm text-slate-400">
          {actionError || "The requested order could not be found or you do not have permission to edit it."}
        </p>
        <Link
          to="/operations/orders"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>
      </div>
    );
  }

  // Pre-dispatch status check
  const isEditable = ["ISSUED", "PROCESSING", "READY_FOR_DISPATCH"].includes(order.status);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Navigation Links */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
            <Link
              to="/operations/orders"
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Orders
            </Link>
            <span>/</span>
            <Link
              to={`/operations/orders/${order.id}`}
              className="hover:text-white transition-colors font-mono"
            >
              {order.orderNumber}
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Edit3 className="w-6 h-6 text-indigo-400" /> Edit Order {order.orderNumber}
          </h1>
          <p className="text-sm text-slate-400">
            Modify schedule, warehouse assignment, notes, and add or adjust line items before dispatch.
          </p>
        </div>
      </div>

      {!isEditable && (
        <Card className="p-4 bg-rose-950/40 border-rose-800/80 text-xs text-rose-300 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
          <div>
            <p className="font-semibold">Order Editing Locked</p>
            <p className="text-[11px] text-rose-400 mt-0.5">
              This order is currently <strong>{order.status}</strong>. Orders can only be modified while in
              ISSUED, PROCESSING, or READY_FOR_DISPATCH status.
            </p>
          </div>
        </Card>
      )}

      {/* Main Shared Order Form */}
      <OrderForm
        mode="edit"
        orderNumber={order.orderNumber}
        orderStatus={order.status}
        clientName={order.client?.companyName}
        initialData={{
          expectedDelivery: order.expectedDelivery
            ? new Date(order.expectedDelivery).toISOString().split("T")[0]
            : "",
          assignedStaffId: order.assignedStaffId || "",
          notes: order.notes || "",
          items: (order.items || []).map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: Number(it.unitPrice),
            taxRate: Number(it.taxRate),
            discount: Number(it.discount || 0),
            productName: it.product?.name || "Product",
            sku: it.product?.sku,
            unit: it.product?.unit || "pcs"
          }))
        }}
        products={products}
        staff={staff}
        onSubmit={handleSaveOrder}
        onCancel={() => navigate(`/operations/orders/${order.id}`)}
        isSubmitting={isSubmitting || !isEditable}
        actionError={actionError}
      />
    </div>
  );
};

export default OrderEditPage;
