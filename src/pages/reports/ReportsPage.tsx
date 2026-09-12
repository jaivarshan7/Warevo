import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchOrders, fetchInvoices, fetchInventory } from "@/lib/services";
import { Order, Invoice, Inventory } from "@/types";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { BarChart3, TrendingUp, PieChart as PieIcon, CheckCircle2 } from "lucide-react";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

export const ReportsPage: React.FC = () => {
  const { tenant, role, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [o, inv, i] = await Promise.all([
          fetchOrders(tenant?.id, role, user?.client?.id),
          fetchInvoices(tenant?.id, user?.client?.id, role, user?.id),
          fetchInventory(tenant?.id)
        ]);
        setOrders(o);
        setInvoices(inv);
        setInventory(i);
      } catch (err) {
        console.error("Error loading reports:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenant?.id, role, user?.client?.id]);

  if (loading) return <LoadingSpinner message="Synthesizing analytics..." />;

  // Aggregate orders by status
  const statusCounts: Record<string, number> = {};
  orders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });
  const orderStatusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.replace(/_/g, " "),
    count
  }));

  // Aggregate stock distribution by product
  const stockData = inventory.slice(0, 6).map((item) => ({
    name: item.product?.name || "Item",
    available: item.availableQuantity,
    reserved: item.reservedQuantity
  }));

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalReceived = invoices
    .flatMap((i) => i.payments || [])
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Executive Reports & Analytics</h1>
        <p className="text-sm text-slate-400">
          Operational throughput, order status distributions, and revenue settlements.
        </p>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-indigo-900/40 bg-gradient-to-br from-indigo-950/40 to-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            Total Billed Revenue
          </p>
          <p className="text-2xl font-bold font-mono text-white mt-1">
            ₹{totalInvoiced.toLocaleString("en-IN")}
          </p>
        </Card>

        <Card className="border-emerald-900/40 bg-gradient-to-br from-emerald-950/40 to-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            Verified Payments
          </p>
          <p className="text-2xl font-bold font-mono text-white mt-1">
            ₹{totalReceived.toLocaleString("en-IN")}
          </p>
        </Card>

        <Card className="border-amber-900/40 bg-gradient-to-br from-amber-950/40 to-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
            Delivery Verification Rate
          </p>
          <p className="text-2xl font-bold font-mono text-white mt-1">
            {orders.length > 0
              ? Math.round(
                  (orders.filter((o) => o.verificationStatus === "VERIFIED").length /
                    orders.length) *
                    100
                )
              : 100}
            %
          </p>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Breakdown */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Orders by Status Distribution</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={(props: any) => `${props.name ?? ''}: ${props.value ?? 0}`}
                >
                  {orderStatusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Inventory Stock by Product */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Stock Levels (Available vs Reserved)</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px"
                  }}
                />
                <Bar dataKey="available" fill="#10b981" radius={[4, 4, 0, 0]} name="Available" />
                <Bar dataKey="reserved" fill="#6366f1" radius={[4, 4, 0, 0]} name="Reserved" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
