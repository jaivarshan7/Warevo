import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAuditLogs } from "@/lib/services";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Activity, Search, Filter, RefreshCw, User, Calendar, Shield } from "lucide-react";

export const ChangeLogPage: React.FC = () => {
  const { tenant, role } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await fetchAuditLogs(tenant?.id);
      setLogs(data);
    } catch (err) {
      console.error("Error loading audit change logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [tenant?.id]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        log.action?.toLowerCase().includes(term) ||
        log.entity?.toLowerCase().includes(term) ||
        log.user?.name?.toLowerCase().includes(term) ||
        log.userRole?.toLowerCase().includes(term);

      const matchesEntity = selectedEntity === "all" || log.entity === selectedEntity;
      const matchesRole = selectedRole === "all" || log.userRole === selectedRole;

      return matchesSearch && matchesEntity && matchesRole;
    });
  }, [logs, searchTerm, selectedEntity, selectedRole]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-400" /> Operational Change Log
          </h1>
          <p className="text-sm text-slate-400">
            Immutable audit trail of state changes, stock movements, and commercial transactions.
          </p>
        </div>

        <Button onClick={loadLogs} variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Log
        </Button>
      </div>

      {/* Filters & Search Card */}
      <Card className="p-4 border border-slate-800 bg-slate-900/60">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search action, entity, user..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="all">All Entities</option>
              <option value="Order">Order</option>
              <option value="Inventory">Inventory</option>
              <option value="Product">Product</option>
              <option value="Invoice">Invoice</option>
              <option value="Client">Client</option>
              <option value="Tenant">Tenant</option>
            </select>
          </div>

          <div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="WAREHOUSE_OWNER">WAREHOUSE_OWNER</option>
              <option value="WAREHOUSE_MODERATOR">WAREHOUSE_MODERATOR</option>
              <option value="WAREHOUSE_STAFF">WAREHOUSE_STAFF</option>
              <option value="ACCOUNTANT">ACCOUNTANT</option>
              <option value="CLIENT">CLIENT</option>
              <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="p-0 overflow-hidden border border-slate-800 bg-slate-900/80">
        {loading ? (
          <LoadingSpinner message="Querying tamper-evident audit records..." />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="No audit entries found"
            description="No recent operations matched your filter parameters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-[10px] font-semibold uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4">Action & Diff Details</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-semibold text-white text-xs">{log.action}</div>
                      {(log.previousValue || log.newValue) && (
                        <div className="mt-1 font-mono text-[10px] text-slate-400 bg-slate-950/60 p-1.5 rounded border border-slate-800/80 overflow-x-auto">
                          {log.previousValue && (
                            <span className="text-rose-400 block truncate">
                              - Prev: {typeof log.previousValue === "object" ? JSON.stringify(log.previousValue) : log.previousValue}
                            </span>
                          )}
                          {log.newValue && (
                            <span className="text-emerald-400 block truncate">
                              + Next: {typeof log.newValue === "object" ? JSON.stringify(log.newValue) : log.newValue}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                        {log.entity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{log.user?.name || "System Automated"}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-mono text-slate-400">
                        {log.userRole || "SYSTEM"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                      {new Date(log.createdAt).toLocaleDateString()}{" "}
                      {new Date(log.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
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
};
