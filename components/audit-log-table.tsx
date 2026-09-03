"use client";

import { useMemo, useState } from "react";
import { filterAuditLogs, summarizeAuditChange } from "@/lib/audit-log";

export function AuditLogTable({ logs }: { logs: Array<{ id: string; action: string; entity: string; userRole: string; userName?: string | null; createdAt: Date; previousValue?: Record<string, unknown> | null; newValue?: Record<string, unknown> | null }> }) {
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("all");
  const [role, setRole] = useState("all");

  const filteredLogs = useMemo(() => filterAuditLogs(logs, {
    query,
    entity: entity === "all" ? null : entity,
    role: role === "all" ? null : role
  }), [entity, logs, query, role]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search action, entity, or role"
          className="rounded border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select value={entity} onChange={(event) => setEntity(event.target.value)} className="rounded border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="all">All entities</option>
          <option value="Order">Order</option>
          <option value="Inventory">Inventory</option>
          <option value="Invoice">Invoice</option>
          <option value="Tenant">Tenant</option>
        </select>
        <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="all">All roles</option>
          <option value="WAREHOUSE_OWNER">WAREHOUSE_OWNER</option>
          <option value="WAREHOUSE_MODERATOR">WAREHOUSE_MODERATOR</option>
          <option value="WAREHOUSE_STAFF">WAREHOUSE_STAFF</option>
          <option value="ACCOUNTANT">ACCOUNTANT</option>
          <option value="CLIENT">CLIENT</option>
          <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
        </select>
      </div>

      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No matching change log entries found.</td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="border-t border-border align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-800">{log.action}</div>
                    <div className="mt-1 text-xs text-slate-500">{summarizeAuditChange({ action: log.action, entity: log.entity, previousValue: log.previousValue ?? null, newValue: log.newValue ?? null })}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{log.entity}</td>
                  <td className="px-3 py-3 text-slate-700">{log.userName ? `${log.userName} (${log.userRole})` : `System (${log.userRole})`}</td>
                  <td className="px-3 py-3 text-slate-600">{log.userRole}</td>
                  <td className="px-3 py-3 text-slate-500">{log.createdAt.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
