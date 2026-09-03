export function normalizeSelectedContactIds(raw?: Array<string | null | undefined>): string[] {
  if (!raw) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of raw) {
    if (!value || value === "NEW") continue;
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function resolvePrimaryClientId(selectedIds: string[], fallbackClientId?: string) {
  if (selectedIds.length === 0) {
    return fallbackClientId ?? "";
  }

  return selectedIds[0];
}
