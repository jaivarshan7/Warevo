"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  Calendar, 
  Building2, 
  IndianRupee, 
  ReceiptText, 
  ArrowLeft 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/utils";

type ClientOption = {
  id: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
};

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  sellingPrice: number | string;
  gstRate: number | string;
};

interface OrderLineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
}

interface OrderFormProps {
  clients: ClientOption[];
  products: ProductOption[];
  tenantId?: string;
  action: (data: {
    clientId: string;
    expectedDelivery: string;
    notes: string;
    generateInvoice: boolean;
    items: OrderLineItem[];
    tenantId?: string;
  }) => Promise<void>;
}

export function OrderForm({ clients, products, tenantId, action }: OrderFormProps) {
  const [selectedClient, setSelectedClient] = useState<string>(clients[0]?.id ?? "");
  const [expectedDelivery, setExpectedDelivery] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState<string>("");
  const [generateInvoice, setGenerateInvoice] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [items, setItems] = useState<OrderLineItem[]>([
    {
      productId: products[0]?.id ?? "",
      quantity: 1,
      unitPrice: Number(products[0]?.sellingPrice ?? 0),
      taxRate: Number(products[0]?.gstRate ?? 18),
      discount: 0,
    },
  ]);

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId,
      unitPrice: Number(product.sellingPrice),
      taxRate: Number(product.gstRate),
    };
    setItems(newItems);
  };

  const handleLineChange = (
    index: number,
    field: keyof OrderLineItem,
    value: number
  ) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    setItems(newItems);
  };

  const addItemRow = () => {
    const defaultProduct = products[0];
    setItems([
      ...items,
      {
        productId: defaultProduct?.id ?? "",
        quantity: 1,
        unitPrice: Number(defaultProduct?.sellingPrice ?? 0),
        taxRate: Number(defaultProduct?.gstRate ?? 18),
        discount: 0,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const calculatedItems = items.map((item) => {
    const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0) - (item.discount || 0);
    const itemTax = (itemSubtotal * (item.taxRate || 0)) / 100;
    const itemTotal = itemSubtotal + itemTax;
    return {
      ...item,
      itemSubtotal: Math.max(0, itemSubtotal),
      itemTax: Math.max(0, itemTax),
      itemTotal: Math.max(0, itemTotal),
    };
  });

  const subtotal = calculatedItems.reduce((sum, item) => sum + item.itemSubtotal, 0);
  const taxTotal = calculatedItems.reduce((sum, item) => sum + item.itemTax, 0);
  const grandTotal = subtotal + taxTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      setErrorMsg("Please select a client.");
      return;
    }
    if (items.length === 0 || items.some((item) => !item.productId || item.quantity <= 0)) {
      setErrorMsg("Please ensure all order line items have a selected product and positive quantity.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await action({
        clientId: selectedClient,
        expectedDelivery,
        notes,
        generateInvoice,
        items,
        tenantId,
      });
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || "Failed to create order. Please check inputs.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-700 border border-red-200">
          {errorMsg}
        </div>
      )}

      {/* Client & Schedule Information */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          1. Client & Delivery Details
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="clientId" className="block text-xs font-semibold text-slate-700 mb-1">
              Client / Customer <span className="text-red-500">*</span>
            </label>
            {clients.length === 0 ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                No clients registered yet.{" "}
                <Link href="/dashboard/clients" className="underline font-semibold">
                  Add a client first
                </Link>
              </div>
            ) : (
              <select
                id="clientId"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                required
                className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.contactPerson} · {c.mobile})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="expectedDelivery" className="block text-xs font-semibold text-slate-700 mb-1">
              Expected Delivery Date
            </label>
            <input
              id="expectedDelivery"
              type="date"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
              className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Order Notes / Delivery Instructions
            </label>
            <input
              id="notes"
              type="text"
              placeholder="e.g. Deliver to Loading Bay 3; fragile items"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Order Line Items */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            2. Order Items
          </h2>
          <Button
            type="button"
            variant="secondary"
            onClick={addItemRow}
            className="flex items-center gap-1.5 text-xs h-8"
          >
            <Plus className="h-3.5 w-3.5" /> Add Line
          </Button>
        </div>

        {products.length === 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 text-center">
            No products found in the catalog.{" "}
            <Link href="/dashboard/inventory/new" className="underline font-semibold">
              Add products in inventory
            </Link>{" "}
            before creating an order.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 w-24">Qty</th>
                    <th className="px-3 py-2 w-32">Unit Price (₹)</th>
                    <th className="px-3 py-2 w-24">GST Rate (%)</th>
                    <th className="px-3 py-2 w-28">Discount (₹)</th>
                    <th className="px-3 py-2 text-right w-32">Line Total</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {calculatedItems.map((item, idx) => (
                    <tr key={idx} className="align-middle">
                      <td className="px-3 py-2">
                        <select
                          value={item.productId}
                          onChange={(e) => handleProductChange(idx, e.target.value)}
                          className="h-9 w-full rounded border border-border bg-white px-2 text-xs focus:border-primary focus:outline-none"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) — ₹{Number(p.sellingPrice).toFixed(0)}/{p.unit}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleLineChange(idx, "quantity", parseInt(e.target.value, 10) || 1)
                          }
                          className="h-9 w-full rounded border border-border px-2 text-xs text-center focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleLineChange(idx, "unitPrice", parseFloat(e.target.value) || 0)
                          }
                          className="h-9 w-full rounded border border-border px-2 text-xs text-right focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={item.taxRate}
                          onChange={(e) =>
                            handleLineChange(idx, "taxRate", parseFloat(e.target.value) || 0)
                          }
                          className="h-9 w-full rounded border border-border px-2 text-xs focus:border-primary focus:outline-none"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.discount}
                          onChange={(e) =>
                            handleLineChange(idx, "discount", parseFloat(e.target.value) || 0)
                          }
                          className="h-9 w-full rounded border border-border px-2 text-xs text-right focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        {money(item.itemTotal)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          disabled={items.length <= 1}
                          onClick={() => removeItemRow(idx)}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30 transition p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Summary */}
            <div className="flex justify-end pt-4">
              <div className="w-72 space-y-2 rounded-lg bg-slate-50 p-4 border border-border text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal (excl. tax):</span>
                  <span className="font-medium">{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Estimated GST (Tax):</span>
                  <span className="font-medium">{money(taxTotal)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-slate-900">
                  <span>Grand Total:</span>
                  <span className="text-primary">{money(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Invoice Options */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-primary" />
          3. Invoice Generation
        </h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={generateInvoice}
            onChange={(e) => setGenerateInvoice(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <div>
            <div className="text-sm font-semibold text-slate-800">
              Generate Commercial Invoice automatically
            </div>
            <div className="text-xs text-slate-500">
              Creates a matching invoice record with CGST/SGST itemized breakdown immediately upon order creation.
            </div>
          </div>
        </label>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href="/dashboard/orders">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={isSubmitting || products.length === 0 || clients.length === 0}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {isSubmitting ? "Creating Order..." : "Create Order"}
        </Button>
      </div>
    </form>
  );
}
