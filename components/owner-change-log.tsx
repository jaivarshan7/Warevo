import { Card } from "@/components/ui/card";
import { summarizeAuditChange } from "@/lib/audit-log";

export function OwnerChangeLog({ logs }: { logs: Array<{ id: string; action: string; entity: string; userRole: string; userName?: string | null; createdAt: Date; previousValue?: Record<string, unknown> | null; newValue?: Record<string, unknown> | null }> }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Owner change log</h2>
        <span className="text-xs uppercase tracking-wide text-slate-500">Recent updates</span>
      </div>
      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="rounded border border-dashed border-border p-4 text-sm text-slate-500">No activity has been logged yet.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="rounded border border-border bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-slate-800">{log.action}</div>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">{log.userRole}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>By: <span className="font-medium text-slate-700">{log.userName ?? "System"}</span></span>
              </div>
              <div className="mt-2 text-sm text-slate-600">{summarizeAuditChange({ action: log.action, entity: log.entity, previousValue: log.previousValue ?? null, newValue: log.newValue ?? null })}</div>
              <div className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">{log.createdAt.toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
