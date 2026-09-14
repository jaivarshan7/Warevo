import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchDashboardSummary } from "@/lib/services";
import { Order, Invoice, Inventory } from "@/types";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Package,
  TrendingUp,
  Boxes,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  ArrowUpRight,
  Truck
} from "lucide-react";
import { Link } from "react-router-dom";

export const DashboardPage: React.FC = () => {
  const { user, tenant, role } = useAuth();
  const [data, setData] = useState<{
    orders: Order[];
    invoices: Invoice[];
    inventory: Inventory[];
    totalClients: number;
  }>({ orders: [], invoices: [], inventory: [], totalClients: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetchDashboardSummary(
        tenant?.id,
        role,
        user?.id,
        user?.client?.id
      );
      setData(res);
      setLoading(false);
    }
    load();
  }, [tenant?.id, role, user?.id, user?.client?.id]);

  if (loading) {
    return <LoadingSpinner message="Aggregating warehouse operations..." />;
  }

  // Specialized view for Warehouse Staff
  if (role === "WAREHOUSE_STAFF") {
    const pendingOrders = data.orders.filter((o) =>
      ["ISSUED", "PROCESSING", "READY_FOR_DISPATCH"].includes(o.status)
    );
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Staff Workspace</h1>
          <p className="text-sm text-slate-400">
            Welcome back, {user?.name}. Here are your assigned fulfillment and inventory tasks.
          </p>
        </div>

        {/* Task KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-indigo-900/40 bg-gradient-to-br from-indigo-950/40 to-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  Active Fulfillment Tasks
                </p>
                <p className="text-3xl font-bold text-white mt-1">{pendingOrders.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400">
                <Package className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="border-emerald-900/40 bg-gradient-to-br from-emerald-950/40 to-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Total Dispatched
                </p>
                <p className="text-3xl font-bold text-white mt-1">
                  {data.orders.filter((o) => o.status === "DISPATCHED" || o.status === "COMPLETED").length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-600/20 text-emerald-400">
                <Truck className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="border-amber-900/40 bg-gradient-to-br from-amber-950/40 to-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Low Stock Items
                </p>
                <p className="text-3xl font-bold text-white mt-1">
                  {data.inventory.filter((i) => i.availableQuantity <= (i.product?.reorderLevel || 10)).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-600/20 text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* Actionable Orders Table */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Orders Requiring Processing</h2>
            <Link
              to="/operations/orders"
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              All Orders <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pendingOrders.length === 0 ? (
            <EmptyState
              title="All caught up!"
              description="There are currently no pending orders requiring your processing."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="py-3 px-3">Order #</th>
                    <th className="py-3 px-3">Client</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pendingOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-semibold text-white">
                        {o.orderNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {o.client?.companyName || "Unknown Client"}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={o.status} type="order" />
                      </td>
                      <td className="py-3 px-3">
                        <Link
                          to={`/operations/orders/${o.id}`}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/60 px-2.5 py-1.5 rounded-lg transition-colors inline-block"
                        >
                          Process & Advance
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Specialized view for Product Receiver / Client Receiver
  if (role === "PRODUCT_RECEIVER" || (role === "CLIENT" && user?.client?.employeeRole === "RECEIVER")) {
    const readyForVerification = data.orders.filter((o) =>
      o.status === "DISPATCHED"
    );

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Delivery Verification Tasks</h1>
          <p className="text-sm text-slate-400">
            Confirm goods received, document package conditions, and complete delivery verification.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-amber-900/40 bg-gradient-to-br from-amber-950/30 to-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Pending Verification
                </p>
                <p className="text-3xl font-bold text-white mt-1">{readyForVerification.length}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </Card>

          <Card className="border-emerald-900/40 bg-gradient-to-br from-emerald-950/30 to-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Verified Deliveries
                </p>
                <p className="text-3xl font-bold text-white mt-1">
                  {data.orders.filter((o) => o.verificationStatus === "VERIFIED").length}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-base font-semibold text-white mb-4">Orders Ready for Verification</h2>
          {readyForVerification.length === 0 ? (
            <EmptyState
              title="No pending deliveries"
              description="There are currently no inbound orders awaiting verification."
            />
          ) : (
            <div className="space-y-3">
              {readyForVerification.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{o.orderNumber}</span>
                      <StatusBadge status={o.verificationStatus} type="verification" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Expected Delivery:{" "}
                      {o.expectedDelivery
                        ? new Date(o.expectedDelivery).toLocaleDateString()
                        : "Not specified"}
                    </p>
                  </div>
                  <Link
                    to={`/operations/orders/${o.id}`}
                    className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  >
                    Verify Delivery Now
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Specialized view for Accounts Team / Accountant / Client Accountant
  if (role === "ACCOUNTS_TEAM" || role === "ACCOUNTANT" || role === "CLIENT_ACCOUNTANT") {
    const unpaidInvoices = data.invoices.filter((i) => i.paymentStatus !== "PAID");
    const totalOutstanding = unpaidInvoices.reduce((sum, i) => sum + Number(i.total), 0);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Accounting Dashboard</h1>
          <p className="text-sm text-slate-400">
            Payment verification, invoices, and billing settlement workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-indigo-900/40 bg-gradient-to-br from-indigo-950/40 to-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Outstanding Balance
            </p>
            <p className="text-3xl font-bold text-white mt-1">
              ₹{totalOutstanding.toLocaleString("en-IN")}
            </p>
          </Card>

          <Card className="border-amber-900/40 bg-gradient-to-br from-amber-950/40 to-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Unpaid Invoices
            </p>
            <p className="text-3xl font-bold text-white mt-1">{unpaidInvoices.length}</p>
          </Card>

          <Card className="border-emerald-900/40 bg-gradient-to-br from-emerald-950/40 to-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Verified Deliveries Awaiting Invoice
            </p>
            <p className="text-3xl font-bold text-white mt-1">
              {data.orders.filter((o) => o.verificationStatus === "VERIFIED" && o.status !== "INVOICED").length}
            </p>
          </Card>
        </div>

        {/* Invoices list */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Recent Invoices</h2>
            <Link
              to="/accounting?tab=invoices"
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              All Invoices <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {inv.client?.companyName || "Client"}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-200">
                      ₹{Number(inv.total).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={inv.status} type="invoice" />
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={inv.paymentStatus} type="payment" />
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        to={`/accounting/invoices/${inv.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // Management Overview (PLATFORM_ADMIN, WAREHOUSE_OWNER, MANAGER, GM, WAREHOUSE_MODERATOR)
  const totalRevenue = data.orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const completedOrders = data.orders.filter((o) => o.status === "COMPLETED" || o.status === "PAID").length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {tenant?.name || "Warehouse"} Overview
          </h1>
          <p className="text-sm text-slate-400">
            Real-time multi-tenant operations, stock health, and client order tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/operations/orders"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-sm shadow-indigo-950 flex items-center gap-1.5"
          >
            <Package className="w-4 h-4" /> Manage Orders
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-indigo-900/40 bg-gradient-to-br from-indigo-950/40 to-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Total Orders
              </p>
              <p className="text-3xl font-bold text-white mt-1">{data.orders.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Package className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="border-emerald-900/40 bg-gradient-to-br from-emerald-950/40 to-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Gross Volume
              </p>
              <p className="text-2xl font-bold text-white mt-1 font-mono">
                ₹{totalRevenue.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-600/20 text-emerald-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="border-purple-900/40 bg-gradient-to-br from-purple-950/40 to-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                Catalog Products
              </p>
              <p className="text-3xl font-bold text-white mt-1">{data.inventory.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-600/20 text-purple-400">
              <Boxes className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="border-cyan-900/40 bg-gradient-to-br from-cyan-950/40 to-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                Active Clients
              </p>
              <p className="text-3xl font-bold text-white mt-1">{data.totalClients || 1}</p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-600/20 text-cyan-400">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Grid: Orders & Stock Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders (2 cols) */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Recent Orders</h2>
              <p className="text-xs text-slate-400">Controlled lifecycle and delivery tracking</p>
            </div>
            <Link
              to="/operations/orders"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.orders.slice(0, 6).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-white">
                      {order.orderNumber}
                    </td>
                    <td className="py-3 px-3 text-slate-300 text-xs truncate max-w-[140px]">
                      {order.client?.companyName || "Direct Client"}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={order.status} type="order" />
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-200">
                      ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        to={`/operations/orders/${order.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Stock & Quick Stats (1 col) */}
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-white mb-3">Inventory Health</h2>
            <div className="space-y-3">
              {data.inventory.slice(0, 4).map((inv) => (
                <div
                  key={inv.id}
                  className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-white truncate">
                      {inv.product?.name || "Product"}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400">
                      SKU: {inv.product?.sku || "N/A"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-emerald-400">
                      {inv.availableQuantity} {inv.product?.unit || "pcs"}
                    </span>
                    <p className="text-[10px] text-slate-500">Available</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/operations/inventory"
              className="mt-4 block text-center py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors border border-slate-700/60"
            >
              Manage Warehouse Stock
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
};
