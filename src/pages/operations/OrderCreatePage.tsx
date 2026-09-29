import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchClients,
  fetchProducts,
  fetchEmployees,
  createEnhancedOrder
} from "@/lib/services";
import { Client, Product, User as UserType } from "@/types";
import { OrderForm, OrderFormValues } from "@/components/orders/OrderForm";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ArrowLeft, PlusCircle } from "lucide-react";

export const OrderCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<UserType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const loadResources = async () => {
      try {
        setLoading(true);
        const [cList, pList, sList] = await Promise.all([
          fetchClients(tenant?.id || user?.tenantId),
          fetchProducts(tenant?.id || user?.tenantId),
          fetchEmployees(tenant?.id || user?.tenantId)
        ]);
        setClients(cList);
        setProducts(pList as Product[]);
        setStaff(sList as UserType[]);
      } catch (err: any) {
        console.error("Error loading order creation resources:", err);
        setActionError(err?.message || "Failed to load order form resources.");
      } finally {
        setLoading(false);
      }
    };

    loadResources();
  }, [tenant?.id, user?.tenantId]);

  const handleCreateOrder = async (values: OrderFormValues) => {
    const tenantId = tenant?.id || user?.tenantId;
    const userId = user?.id;

    if (!tenantId || !userId) {
      setActionError("Tenant or user session missing.");
      return;
    }

    if (!values.clientId) {
      setActionError("Please select a client company.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      await createEnhancedOrder({
        tenantId,
        clientId: values.clientId,
        selectedContactIds:
          values.selectedContactIds && values.selectedContactIds.length > 0
            ? values.selectedContactIds
            : undefined,
        createdById: userId,
        assignedStaffId: values.assignedStaffId,
        expectedDelivery: values.expectedDelivery,
        notes: values.notes,
        status: "ISSUED",
        eWayBill: values.eWayBill,
        items: values.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          discount: it.discount || 0
        }))
      });

      navigate("/operations/orders", {
        state: { message: `Commercial order created successfully with ${values.items.length} items.` }
      });
    } catch (err: any) {
      console.error("Order creation failed:", err);
      setActionError(err?.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading client registry and catalog products..." />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/operations/orders"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Orders
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-indigo-400" /> Create Commercial Order
          </h1>
          <p className="text-sm text-slate-400">
            Issue a warehouse commercial order with synchronized invoice and line items.
          </p>
        </div>
      </div>

      {/* Main Order Form */}
      <OrderForm
        mode="create"
        clients={clients}
        products={products}
        staff={staff}
        onSubmit={handleCreateOrder}
        onCancel={() => navigate("/operations/orders")}
        isSubmitting={isSubmitting}
        actionError={actionError}
      />
    </div>
  );
};

export default OrderCreatePage;
