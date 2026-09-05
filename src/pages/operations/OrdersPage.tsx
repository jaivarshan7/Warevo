import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchOrders,
  fetchClients,
  fetchProducts,
  createOrder,
  transitionOrderStatus
} from "@/lib/services";
import { Order, Client, Product, OrderStatus } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { validOrderTransitions } from "@/lib/orderWorkflow";
import { Plus, Search, Filter, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

export const OrdersPage: React.FC = () => {
  const { user, tenant, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Create Order Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderItems, setOrderItems] = useState<
    Array<{ productId: string; quantity: number; unitPrice: number; taxRate: number }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Transition modal state
  const [transitioningOrder, setTransitioningOrder] = useState<Order | null>(null);
  const [targetStatus, setTargetStatus] = useState<OrderStatus | "">("");
  const [transitionNotes, setTransitionNotes] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [oList, cList, pList] = await Promise.all([
        fetchOrders(tenant?.id, role, user?.client?.id),
        fetchClients(tenant?.id),
        fetchProducts(tenant?.id)
      ]);
      setOrders(oList);
      setClients(cList);
      setProducts(pList as Product[]);
      if (cList.length > 0) setSelectedClient(cList[0].id);
      if (pList.length > 0) {
        setOrderItems([
          {
            productId: pList[0].id,
            quantity: 1,
            unitPrice: Number(pList[0].sellingPrice),
            taxRate: Number(pList[0].gstRate)
          }
        ]);
      }
    } catch (err) {
      console.error("Error loading orders data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id, role, user?.id, user?.client?.id]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id || !user?.id || !selectedClient) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      await createOrder({
        tenantId: tenant.id,
        clientId: selectedClient,
        createdById: user.id,
        notes: orderNotes,
        items: orderItems
      });
      setIsCreateOpen(false);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

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
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || "Failed to transition order");
    } finally {
      setIsTransitioning(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = filterStatus === "ALL" || o.status === filterStatus;
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.client?.companyName.toLowerCase().includes(searchTerm.toLowerCase());
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
          <Button onClick={() => setIsCreateOpen(true)} className="gap-1.5 self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Create New Order
          </Button>
        )}
      </div>

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
              <option value="RECEIVED">RECEIVED</option>
              <option value="VERIFICATION_PENDING">VERIFICATION PENDING</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="INVOICE_PENDING">INVOICE PENDING</option>
              <option value="INVOICED">INVOICED</option>
              <option value="PAID">PAID</option>
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
          <div className="overflow-x-auto">
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
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 font-medium">
                        {o.client?.companyName || "Direct Client"}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={o.status} type="order" />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={o.verificationStatus} type="verification" />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-200">
                        ₹{Number(o.totalAmount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
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
        )}
      </Card>

      {/* Transition Order Modal */}
      {transitioningOrder && (
        <Modal
          isOpen={Boolean(transitioningOrder)}
          onClose={() => setTransitioningOrder(null)}
          title={`Advance Order ${transitioningOrder.orderNumber}`}
          description={`Current Status: ${transitioningOrder.status}`}
        >
          <form onSubmit={handleTransition} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Select Next Valid Status (Strict State Machine)
              </label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as OrderStatus)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              >
                {validOrderTransitions[transitioningOrder.status]?.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Transition Notes / Reason
              </label>
              <textarea
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                placeholder="Optional notes for audit trail..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

      {/* Create Order Modal */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New Commercial Order"
          description="Build line items and assign client customer"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Client Company</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.contactPerson})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Line Items
              </label>
              <div className="space-y-2">
                {orderItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 p-3 bg-slate-800/60 rounded-xl border border-slate-700"
                  >
                    <div className="col-span-6">
                      <label className="text-[10px] text-slate-400 block">Product</label>
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const p = products.find((prod) => prod.id === e.target.value);
                          const newItems = [...orderItems];
                          newItems[idx].productId = e.target.value;
                          if (p) {
                            newItems[idx].unitPrice = Number(p.sellingPrice);
                            newItems[idx].taxRate = Number(p.gstRate);
                          }
                          setOrderItems(newItems);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{p.sellingPrice})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...orderItems];
                          newItems[idx].quantity = parseInt(e.target.value, 10) || 1;
                          setOrderItems(newItems);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block">Unit Price (₹)</label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        readOnly
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Order Instructions / Notes
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Shipping instructions, dock requirements..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Order (DRAFT)
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
