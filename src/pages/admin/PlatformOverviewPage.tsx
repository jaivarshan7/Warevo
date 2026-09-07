import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAdminDashboardData, fetchAuditLogs } from "@/lib/services";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Globe,
  Building,
  Users,
  Warehouse,
  FileText,
  Activity,
  Shield,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { Link } from "react-router-dom";

export const PlatformOverviewPage: React.FC = () => {
  const { role } = useAuth();
  const [data, setData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [adminData, logs] = await Promise.all([
        fetchAdminDashboardData(),
        fetchAuditLogs()
      ]);
      setData(adminData);
      setAuditLogs(logs.slice(0, 10));
    } catch (err) {
      console.error("Error loading platform overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Aggregating platform tenant metrics..." />;
  }

  const tenants = data?.tenants || [];
  const warehouses = data?.warehouses || [];
  const users = data?.users || [];
  const clients = data?.clients || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-400" /> Platform Administration Overview
          </h1>
          <p className="text-sm text-slate-400">
            Cross-tenant facility oversight, multi-warehouse operational capacity, and platform audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link to="/admin">
            <Button variant="outline" size="sm" className="text-xs">
              Open Admin Console
            </Button>
          </Link>
          <Button onClick={loadData} size="sm" className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Active Tenants</p>
              <h3 className="text-2xl font-bold text-white">{tenants.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-teal-950 text-teal-400 border border-teal-800">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Warehouses</p>
              <h3 className="text-2xl font-bold text-white">{warehouses.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-950 text-blue-400 border border-blue-800">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Platform Users</p>
              <h3 className="text-2xl font-bold text-white">{users.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-950 text-purple-400 border border-purple-800">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Client Accounts</p>
              <h3 className="text-2xl font-bold text-white">{clients.length}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Tenants Facility Summary Table */}
      <Card className="p-0 overflow-hidden border border-slate-800 bg-slate-900/80">
        <div className="bg-slate-950/60 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Tenant Organizations & Operational Footprint
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">
            {tenants.length} Managed Organizations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-semibold uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">Organization / Tenant</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Warehouses</th>
                <th className="py-3 px-4 text-center">Users</th>
                <th className="py-3 px-4 text-center">Clients</th>
                <th className="py-3 px-4 text-right">Identifier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tenants.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3.5 px-4 font-semibold text-white">
                    {t.name}
                    <div className="text-[10px] font-mono text-slate-500">{t.slug}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-200">
                    {t.warehousesCount || 0}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-200">
                    {t.usersCount || 0}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-200">
                    {t.clientsCount || 0}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-500 text-[11px]">
                    {t.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Cross-Tenant Recent Audit Logs */}
      <Card className="p-0 overflow-hidden border border-slate-800 bg-slate-900/80">
        <div className="bg-slate-950/60 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Platform-Wide Audit Activity (Last 10 Actions)
            </h2>
          </div>
          <Link
            to="/change-log"
            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline"
          >
            View Full Change Log
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-semibold uppercase text-slate-400">
              <tr>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Entity</th>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-semibold text-white">{log.action}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700 text-[10px]">
                      {log.entity}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{log.user?.name || "System"}</td>
                  <td className="py-3 px-4 font-mono text-[10px] text-slate-400">{log.userRole}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400 text-[11px]">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
