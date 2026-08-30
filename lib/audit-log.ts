export function summarizeAuditChange(input: {
  action?: string | null;
  entity?: string | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}) {
  const action = input.action ?? "Updated record";
  const entity = input.entity ?? "Record";
  const previous = input.previousValue && typeof input.previousValue === "object" ? input.previousValue : {};
  const next = input.newValue && typeof input.newValue === "object" ? input.newValue : {};

  const summarizeJson = (value: Record<string, unknown>) => {
    const entries = Object.entries(value)
      .slice(0, 2)
      .map(([key, item]) => `${key}: ${String(item)}`)
      .join(", ");

    return entries || "updated data";
  };

  return `${action} on ${entity}: ${summarizeJson(previous)} → ${summarizeJson(next)}`;
}

export function filterAuditLogs<T extends { action: string; entity: string; userRole: string }>(
  logs: T[],
  filters: { query?: string | null; entity?: string | null; role?: string | null }
) {
  const query = (filters.query ?? "").trim().toLowerCase();

  return logs.filter((log) => {
    const matchesQuery = !query || `${log.action} ${log.entity} ${log.userRole}`.toLowerCase().includes(query);
    const matchesEntity = !filters.entity || log.entity === filters.entity;
    const matchesRole = !filters.role || log.userRole === filters.role;

    return matchesQuery && matchesEntity && matchesRole;
  });
}
