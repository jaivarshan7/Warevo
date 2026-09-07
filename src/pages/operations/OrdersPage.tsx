import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchOrders,
  fetchClients,
  fetchProducts,
  createEnhancedOrder,
  transitionOrderStatus
} from "@/lib/services";
import { Order, Client, Product, OrderStatus } from "@/types";
import { parseInvoiceText, samplePureAuraInvoice } from "@/lib/invoiceParser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { validOrderTransitions } from "@/lib/orderWorkflow";
import {
  Plus,
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
  Sparkles,
  Building2,
  Users,
  CheckSquare,
  Square,
  Truck,
  FileSpreadsheet
} from "lucide-react";
import { Link } from "react-router-dom";

export const OrdersPage: React.FC = () => {
  const { user, tenant, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Create Order Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"manual" | "import">("manual");
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // 2-tier client selection
  const [selectedCompanyName, setSelectedCompanyName] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  
  const [orderNotes, setOrderNotes] = useState("");
  const [orderItems, setOrderItems] = useState<
    Array<{ productId: string; quantity: number; unitPrice: number; taxRate: number; discount: number }>
  >([]);
  
  // E-Way Bill details
  const [transporterName, setTransporterName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(true);

  // Invoice OCR / Import state
  const [invoiceRawText, setInvoiceRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

      // Default company selection
      if (cList.length > 0) {
        const firstCo = cList[0].companyName;
        setSelectedCompanyName(firstCo);
        const contactsInFirst = cList.filter((c) => c.companyName === firstCo);
        setSelectedContactIds(contactsInFirst.map((c) => c.id));
      }

      if (pList.length > 0) {
        setOrderItems([
          {
            productId: pList[0].id,
            quantity: 1,
            unitPrice: Number(pList[0].sellingPrice),
            taxRate: Number(pList[0].gstRate),
            discount: 0
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

  // Unique companies
  const companyNames = Array.from(new Set(clients.map((c) => c.companyName || "Direct Client")));
  const companyEmployees = clients.filter((c) => c.companyName === selectedCompanyName);

  const handleCompanyChange = (cName: string) => {
    setSelectedCompanyName(cName);
    const emps = clients.filter((c) => c.companyName === cName);
    setSelectedContactIds(emps.map((e) => e.id));
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  // Run parser on pasted text or sample
  const processImportText = (text: string) => {
    setIsParsing(true);
    setImportNotice(null);
    try {
      const parsed = parseInvoiceText(text);

      // Auto-match company if found
      if (parsed.clientName) {
        const matchedCo = companyNames.find(
          (c) => c.toLowerCase().includes(parsed.clientName.toLowerCase()) || parsed.clientName.toLowerCase().includes(c.toLowerCase())
        );
        if (matchedCo) {
          setSelectedCompanyName(matchedCo);
          const emps = clients.filter((c) => c.companyName === matchedCo);
          setSelectedContactIds(emps.map((e) => e.id));
        }
      }

      // Fill E-Way Bill
      if (parsed.eWayBill) {
        if (parsed.eWayBill.transporterName) setTransporterName(parsed.eWayBill.transporterName);
        if (parsed.eWayBill.vehicleNumber) setVehicleNumber(parsed.eWayBill.vehicleNumber);
        if (parsed.eWayBill.distanceKm) setDistanceKm(parsed.eWayBill.distanceKm);
      }

      if (parsed.notes) {
        setOrderNotes((prev) => (prev ? `${prev}\n${parsed.notes}` : parsed.notes));
      }

      // Map parsed items to catalog products or add them
      if (parsed.items && parsed.items.length > 0) {
        const mappedItems: Array<{
          productId: string;
          quantity: number;
          unitPrice: number;
          taxRate: number;
          discount: number;
        }> = [];

        for (const item of parsed.items) {
          const matchedProd = products.find(
            (p) =>
              (item.sku && p.sku.toLowerCase() === item.sku.toLowerCase()) ||
              p.name.toLowerCase().includes(item.name.toLowerCase()) ||
              item.name.toLowerCase().includes(p.name.toLowerCase())
          );

          if (matchedProd) {
            mappedItems.push({
              productId: matchedProd.id,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || Number(matchedProd.sellingPrice),
              taxRate: item.gstRate || Number(matchedProd.gstRate),
              discount: 0
            });
          } else if (products.length > 0) {
            // Fallback to first available product with item price
            mappedItems.push({
              productId: products[0].id,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || Number(products[0].sellingPrice),
              taxRate: item.gstRate || Number(products[0].gstRate),
              discount: 0
            });
          }
        }

        if (mappedItems.length > 0) {
          setOrderItems(mappedItems);
        }
      }

      setImportNotice(
        `Successfully extracted ${parsed.items.length} line items from invoice (${parsed.invoiceNumber || "Parsed"}).`
      );
    } catch (err: any) {
      setActionError(err?.message || "Invoice extraction failed");
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInvoiceRawText(content);
      processImportText(content);
    };
    reader.readAsText(file);
  };

  const handleLoadSampleInvoice = () => {
    const formatted = `INVOICE NUMBER: ${samplePureAuraInvoice.invoiceNumber}
DATE: ${samplePureAuraInvoice.invoiceDate}
CUSTOMER: ${samplePureAuraInvoice.clientName}
CONTACT: ${samplePureAuraInvoice.contactPerson}
GSTIN: ${samplePureAuraInvoice.clientGstin}
DELIVERY ADDRESS: ${samplePureAuraInvoice.clientAddress}
TRANSPORTER: ${samplePureAuraInvoice.eWayBill?.transporterName}
VEHICLE NO: ${samplePureAuraInvoice.eWayBill?.vehicleNumber}
DISTANCE: ${samplePureAuraInvoice.eWayBill?.distanceKm} KM

LINE ITEMS:
${samplePureAuraInvoice.items.map((it) => `${it.sku} | ${it.name} | Qty: ${it.quantity} | UnitPrice: ${it.unitPrice} | GST: ${it.gstRate}%`).join("\n")}`;

    setInvoiceRawText(formatted);
    processImportText(formatted);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id || !user?.id) return;

    // Pick primary client ID from selected contacts or first client of selected company
    const primaryClient =
      clients.find((c) => selectedContactIds.includes(c.id)) ||
      clients.find((c) => c.companyName === selectedCompanyName) ||
      clients[0];

    if (!primaryClient) {
      setActionError("Please register at least one client company before creating orders.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      await createEnhancedOrder({
        tenantId: tenant.id,
        clientId: primaryClient.id,
        selectedContactIds: selectedContactIds.length > 0 ? selectedContactIds : [primaryClient.id],
        createdById: user.id,
        notes: orderNotes,
        generateInvoice: autoGenerateInvoice,
        eWayBill: transporterName || vehicleNumber ? {
          transporterName,
          vehicleNumber,
          distanceKm,
          transportMode: "ROAD"
        } : undefined,
        items: orderItems
      });

      setIsCreateOpen(false);
      setSuccessMsg(`Order created successfully with ${orderItems.length} items.`);
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
      setSuccessMsg(`Order ${transitioningOrder.orderNumber} transitioned to ${targetStatus}`);
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
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link to="/operations/orders/track">
              <Button variant="outline" className="gap-1.5">
                <Truck className="w-4 h-4" /> Live Delivery Tracker
              </Button>
            </Link>
            <Button onClick={() => setIsCreateOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Create New Order
            </Button>
            <Link to="/operations/orders/import">
              <Button className="gap-1.5">
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

      {/* Create Order Modal with Invoice Import & OCR */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Commercial Order"
          description="Select client company, designate notified employee contacts, and build or import line items."
          maxWidth="lg"
        >
          <form onSubmit={handleCreateOrder} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {actionError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {actionError}
              </div>
            )}

            {/* 2-Tier Company & Employee Contacts Selection */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span>1. Select Client Company</span>
              </div>
              <select
                value={selectedCompanyName}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                required
              >
                {companyNames.map((cName) => (
                  <option key={cName} value={cName}>
                    {cName}
                  </option>
                ))}
              </select>

              {/* Designated Employees Checkboxes */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Select Designated Employees to Notify ({selectedContactIds.length} selected):
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedContactIds(companyEmployees.map((e) => e.id))}
                    className="text-indigo-400 hover:underline text-[10px]"
                  >
                    Select All
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {companyEmployees.map((emp) => {
                    const isSelected = selectedContactIds.includes(emp.id);
                    return (
                      <button
                        type="button"
                        key={emp.id}
                        onClick={() => toggleContactSelection(emp.id)}
                        className={`flex items-start gap-2 p-2 rounded-lg text-left border transition ${
                          isSelected
                            ? "bg-indigo-950/60 border-indigo-700 text-white"
                            : "bg-slate-800/40 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                        )}
                        <div className="text-[11px] leading-tight">
                          <p className="font-semibold text-white">{emp.contactPerson}</p>
                          <p className="font-mono text-slate-400 text-[10px]">{emp.mobile}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Line Items Builder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-300">
                  Line Items ({orderItems.length})
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (products.length > 0) {
                      setOrderItems((prev) => [
                        ...prev,
                        {
                          productId: products[0].id,
                          quantity: 1,
                          unitPrice: Number(products[0].sellingPrice),
                          taxRate: Number(products[0].gstRate),
                          discount: 0
                        }
                      ]);
                    }
                  }}
                  className="text-xs h-7 px-2"
                >
                  <Plus className="w-3 h-3" /> Add Item
                </Button>
              </div>

              <div className="space-y-2">
                {orderItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 p-2.5 bg-slate-800/60 rounded-xl border border-slate-700"
                  >
                    <div className="col-span-5">
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{p.sellingPrice})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-right"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block">Rate (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const newItems = [...orderItems];
                          newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                          setOrderItems(newItems);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-right font-mono"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 block">GST %</label>
                      <input
                        type="number"
                        value={item.taxRate}
                        onChange={(e) => {
                          const newItems = [...orderItems];
                          newItems[idx].taxRate = parseFloat(e.target.value) || 0;
                          setOrderItems(newItems);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-right font-mono"
                      />
                    </div>

                    <div className="col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (orderItems.length > 1) {
                            setOrderItems(orderItems.filter((_, i) => i !== idx));
                          }
                        }}
                        className="p-1 rounded text-rose-400 hover:bg-rose-950/60 transition w-full flex justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* E-Way Bill Details */}
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Transport & E-Way Bill Information</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400">Transporter</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Cargo"
                    value={transporterName}
                    onChange={(e) => setTransporterName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Vehicle #</label>
                  <input
                    type="text"
                    placeholder="TN-76-AB-1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Distance (KM)</label>
                  <input
                    type="number"
                    min="0"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-right"
                  />
                </div>
              </div>
            </div>

            {/* Auto Generate Invoice Checkbox */}
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={autoGenerateInvoice}
                onChange={(e) => setAutoGenerateInvoice(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
              />
              <span>Automatically generate Tax Invoice and email notified contacts upon creation</span>
            </label>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Order Instructions / Delivery Notes
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Gate entry instructions, dock appointment, fragile cargo..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Order & Issue
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
