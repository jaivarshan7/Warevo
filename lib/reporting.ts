function toNumber(value: unknown) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toString" in value && typeof (value as { toString: () => string }).toString === "function") {
    const text = (value as { toString: () => string }).toString();
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function buildReportSummary(
  orders: Array<{ status?: string; totalAmount?: unknown }>,
  invoices: Array<{ total?: unknown }>,
  products: Array<{ inventory?: Array<{ availableQuantity?: unknown }>; reorderLevel?: unknown }>
) {
  const totalRevenue = orders.reduce((sum, order) => sum + toNumber(order.totalAmount), 0);
  const verificationPending = orders.filter((order) => order.status === "VERIFICATION_PENDING").length;
  const completedOrders = orders.filter((order) => order.status === "COMPLETED").length;
  const lowStockItems = products.filter((product) => {
    const inventory = product.inventory ?? [];
    const reorderLevel = toNumber(product.reorderLevel);
    return inventory.some((item) => toNumber(item.availableQuantity) <= reorderLevel);
  }).length;

  return {
    totalRevenue,
    verificationPending,
    completedOrders,
    lowStockItems,
    receivables: invoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0)
  };
}
