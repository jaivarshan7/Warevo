import React, { useState, useMemo } from "react";
import { Product } from "@/types";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2, AlertCircle, Search, Package } from "lucide-react";

export interface EditableOrderItem {
  id?: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  productName?: string;
  sku?: string;
  unit?: string;
}

interface OrderItemsEditorProps {
  items: EditableOrderItem[];
  onChange: (items: EditableOrderItem[]) => void;
  availableProducts: Product[];
  disabled?: boolean;
}

export const OrderItemsEditor: React.FC<OrderItemsEditorProps> = ({
  items,
  onChange,
  availableProducts,
  disabled = false
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productSearch, setProductSearch] = useState<string>("");

  // Determine which products are already selected to prevent duplicates
  const selectedProductIds = useMemo(() => {
    return new Set(items.map((it) => it.productId));
  }, [items]);

  // Products available to add (not yet in the order)
  const unselectedProducts = useMemo(() => {
    return availableProducts.filter((p) => !selectedProductIds.has(p.id));
  }, [availableProducts, selectedProductIds]);

  // Filter unselected products by search text
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return unselectedProducts;
    const term = productSearch.toLowerCase();
    return unselectedProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term))
    );
  }, [unselectedProducts, productSearch]);

  // Handle adding an item
  const handleAddItem = (productIdToAdd?: string) => {
    const targetId = productIdToAdd || selectedProductId || unselectedProducts[0]?.id;
    if (!targetId) return;

    const prod = availableProducts.find((p) => p.id === targetId);
    if (!prod) return;

    const newItem: EditableOrderItem = {
      productId: prod.id,
      quantity: 1,
      unitPrice: Number(prod.sellingPrice) || 0,
      taxRate: Number(prod.gstRate) || 0,
      discount: 0,
      productName: prod.name,
      sku: prod.sku,
      unit: prod.unit || "pcs"
    };

    onChange([...items, newItem]);
    setSelectedProductId("");
    setProductSearch("");
  };

  // Handle removing an item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return; // Keep at least one item
    onChange(items.filter((_, i) => i !== index));
  };

  // Handle updating an item property
  const handleItemFieldChange = (
    index: number,
    field: keyof EditableOrderItem,
    value: number
  ) => {
    onChange(
      items.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          [field]: value
        };
      })
    );
  };

  // Compute live client-side totals
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);
  }, [items]);

  const taxTotal = useMemo(() => {
    return items.reduce(
      (sum, it) => sum + ((it.quantity || 0) * (it.unitPrice || 0) * (it.taxRate || 0)) / 100,
      0
    );
  }, [items]);

  const discountTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.discount || 0), 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal + taxTotal - discountTotal);
  }, [subtotal, taxTotal, discountTotal]);

  return (
    <div className="space-y-4">
      {/* Items Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-400" />
            Order Line Items ({items.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure line items, quantities, pricing, and GST rates.
          </p>
        </div>

        {items.length <= 1 && (
          <span className="text-[11px] text-amber-400 font-medium">
            Orders require at least one line item.
          </span>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-950/60 text-[10px]">
              <th className="py-3 px-3">Product / SKU</th>
              <th className="py-3 px-3 text-right w-24">Qty</th>
              <th className="py-3 px-3 text-right w-32">Unit Price (₹)</th>
              <th className="py-3 px-3 text-right w-24">GST (%)</th>
              <th className="py-3 px-3 text-right w-36">Line Total (₹)</th>
              <th className="py-3 px-2 text-center w-12">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {items.map((item, idx) => {
              const lineAmount = (item.quantity || 0) * (item.unitPrice || 0);
              const lineTax = (lineAmount * (item.taxRate || 0)) / 100;
              const lineTotal = lineAmount + lineTax - (item.discount || 0);

              return (
                <tr key={`${item.productId}-${idx}`} className="hover:bg-slate-800/30">
                  <td className="py-3 px-3">
                    <p className="font-semibold text-white text-xs">
                      {item.productName || "Product"}
                    </p>
                    {item.sku && (
                      <p className="font-mono text-[10px] text-slate-400">SKU: {item.sku}</p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <input
                      type="number"
                      min={1}
                      disabled={disabled}
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemFieldChange(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={disabled}
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleItemFieldChange(idx, "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={disabled}
                      value={item.taxRate}
                      onChange={(e) =>
                        handleItemFieldChange(idx, "taxRate", Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-200">
                    ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button
                      type="button"
                      disabled={disabled || items.length <= 1}
                      onClick={() => handleRemoveItem(idx)}
                      title={items.length <= 1 ? "Order must have at least one item" : "Remove item"}
                      className={`p-1.5 rounded-lg transition-colors ${
                        items.length <= 1
                          ? "text-slate-600 cursor-not-allowed"
                          : "text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE STACKED CARDS VIEW (hidden on desktop) */}
      <div className="block md:hidden space-y-3">
        {items.map((item, idx) => {
          const lineAmount = (item.quantity || 0) * (item.unitPrice || 0);
          const lineTax = (lineAmount * (item.taxRate || 0)) / 100;
          const lineTotal = lineAmount + lineTax - (item.discount || 0);

          return (
            <div
              key={`${item.productId}-${idx}`}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-white text-xs">
                    {item.productName || "Product Item"}
                  </h4>
                  {item.sku && (
                    <span className="font-mono text-[10px] text-slate-400">SKU: {item.sku}</span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={disabled || items.length <= 1}
                  onClick={() => handleRemoveItem(idx)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    items.length <= 1
                      ? "text-slate-600 cursor-not-allowed"
                      : "text-slate-400 hover:text-rose-400 bg-slate-800"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Qty</label>
                  <input
                    type="number"
                    min={1}
                    disabled={disabled}
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemFieldChange(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={disabled}
                    value={item.unitPrice}
                    onChange={(e) =>
                      handleItemFieldChange(idx, "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">GST (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={disabled}
                    value={item.taxRate}
                    onChange={(e) =>
                      handleItemFieldChange(idx, "taxRate", Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-slate-400 font-medium">Line Total:</span>
                <span className="font-mono font-bold text-white">
                  ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD ITEM SECTION */}
      {!disabled && (
        <div className="p-3.5 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              Add Product Item
            </span>
            <span className="text-[11px] text-slate-400">
              {unselectedProducts.length} catalog products available
            </span>
          </div>

          {unselectedProducts.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-1">
              All catalog products have already been added to this order.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select a product to add --</option>
                  {unselectedProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(SKU: ${p.sku})` : ""} — ₹{Number(p.sellingPrice).toLocaleString("en-IN")} + {p.gstRate}% GST
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                onClick={() => handleAddItem()}
                disabled={!selectedProductId}
                className="text-xs gap-1.5 whitespace-nowrap bg-indigo-600 hover:bg-indigo-500"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ORDER TOTALS SUMMARY BAR */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-slate-400">
          <p className="font-medium text-slate-300">Live Client Total Estimate</p>
          <p className="text-[11px] text-slate-500">
            Database RPC recalculates authoritative invoice totals upon save.
          </p>
        </div>

        <div className="w-full sm:w-64 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal:</span>
            <span className="font-mono text-slate-200">
              ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>GST (Tax):</span>
            <span className="font-mono text-slate-200">
              ₹{taxTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Discount:</span>
              <span className="font-mono text-emerald-400">
                -₹{discountTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
            <span>Grand Total:</span>
            <span className="font-mono text-indigo-400">
              ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
