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
  ArrowLeft,
  UserCheck,
  UserPlus,
  MapPin,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/utils";

export type ClientOption = {
  id: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email?: string | null;
  gstNumber?: string | null;
  shippingAddress?: string | null;
};

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  sellingPrice: number | string;
  gstRate: number | string;
};

export interface OrderLineItem {
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
    newCompany?: string;
    newContactPerson?: string;
    newMobile?: string;
    newGstNumber?: string;
    newShippingAddress?: string;
    expectedDelivery: string;
    notes: string;
    generateInvoice: boolean;
    items: OrderLineItem[];
    tenantId?: string;
  }) => Promise<void>;
}

export function OrderForm({ clients, products, tenantId, action }: OrderFormProps) {
  // Extract unique companies
  const uniqueCompanies = Array.from(new Set(clients.map((c) => c.companyName).filter(Boolean)));
  const initialCompany = uniqueCompanies[0] ?? "";
  
  // State for company & employee selection
  const [selectedCompany, setSelectedCompany] = useState<string>(initialCompany || "NEW");
  
  // Filter employees for the chosen company
  const companyEmployees = clients.filter((c) => c.companyName === selectedCompany);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    companyEmployees[0]?.id ?? "NEW"
  );

  // New Client / Employee inline state
  const [newCompanyName, setNewCompanyName] = useState<string>("");
  const [newContactPerson, setNewContactPerson] = useState<string>("");
  const [newMobile, setNewMobile] = useState<string>("");
  const [newGstNumber, setNewGstNumber] = useState<string>("");
  const [newShippingAddress, setNewShippingAddress] = useState<string>("");

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

  // Handle company change
  const handleCompanyChange = (company: string) => {
    setSelectedCompany(company);
    if (company === "NEW") {
      setSelectedEmployeeId("NEW");
    } else {
      const emps = clients.filter((c) => c.companyName === company);
      setSelectedEmployeeId(emps[0]?.id ?? "NEW");
    }
  };

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
  const subtotal = items.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice - item.discount,
    0
  );
  const totalTax = items.reduce(
    (acc, item) =>
      acc +
      ((item.quantity * item.unitPrice - item.discount) * item.taxRate) / 100,
    0
  );
  const totalAmount = subtotal + totalTax;

  // Selected client object for preview
  const currentEmployee = clients.find((c) => c.id === selectedEmployeeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const isNew = selectedCompany === "NEW" || selectedEmployeeId === "NEW";
    if (isNew) {
      const compName = selectedCompany === "NEW" ? newCompanyName.trim() : selectedCompany;
      if (!compName) {
        setErrorMsg("Please enter a Company Name.");
        return;
      }
      if (!newContactPerson.trim() || !newMobile.trim()) {
        setErrorMsg("Please enter the Employee / Contact Person name and Mobile.");
        return;
      }
    }

    if (items.length === 0 || items.some((i) => !i.productId || i.quantity <= 0)) {
      setErrorMsg("Please ensure all order line items have valid products and quantities.");
      return;
    }

    try {
      setIsSubmitting(true);
      await action({
        clientId: isNew ? "NEW" : selectedEmployeeId,
        newCompany: selectedCompany === "NEW" ? newCompanyName.trim() : selectedCompany,
        newContactPerson: newContactPerson.trim(),
        newMobile: newMobile.trim(),
        newGstNumber: newGstNumber.trim(),
        newShippingAddress: newShippingAddress.trim(),
        expectedDelivery,
        notes,
        generateInvoice,
        items,
        tenantId,
      });
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || "Failed to create order.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          {errorMsg}
        </div>
      )}

      {/* 2-Tier Company & Employee Selection */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900">1. Client Company & Designated Employee</h2>
          </div>
          <span className="text-xs text-slate-500">Select company and contact person for delivery</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Step 1: Company Dropdown */}
          <div>
            <label htmlFor="companySelect" className="block text-xs font-semibold text-slate-700 mb-1">
              Select Client Company <span className="text-red-500">*</span>
            </label>
            <select
              id="companySelect"
              value={selectedCompany}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none"
            >
              {uniqueCompanies.map((comp) => (
                <option key={comp} value={comp}>
                  🏢 {comp} ({clients.filter((c) => c.companyName === comp).length} employees)
                </option>
              ))}
              <option value="NEW">+ Register New Company</option>
            </select>
          </div>

          {/* Step 2: Employee Dropdown (if company exists) */}
          {selectedCompany !== "NEW" && (
            <div>
              <label htmlFor="employeeSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                Designated Employee / Contact Person <span className="text-red-500">*</span>
              </label>
              <select
                id="employeeSelect"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none"
              >
                {companyEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    👤 {emp.contactPerson} · {emp.mobile}
                  </option>
                ))}
                <option value="NEW">+ Add New Employee to {selectedCompany}</option>
              </select>
            </div>
          )}

          {/* Inline Form when adding new Company */}
          {selectedCompany === "NEW" && (
            <>
              <div>
                <label htmlFor="newCompanyName" className="block text-xs font-semibold text-slate-700 mb-1">
                  New Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="newCompanyName"
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. PSS Multiplex"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="newGstNumber" className="block text-xs font-semibold text-slate-700 mb-1">
                  Company GSTIN
                </label>
                <input
                  id="newGstNumber"
                  type="text"
                  value={newGstNumber}
                  onChange={(e) => setNewGstNumber(e.target.value)}
                  placeholder="e.g. 33AAYFP5618B1Z4"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 font-mono text-sm uppercase focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Inline Form when adding a new Employee */}
          {(selectedCompany === "NEW" || selectedEmployeeId === "NEW") && (
            <>
              <div>
                <label htmlFor="newContactPerson" className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee / Contact Person Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="newContactPerson"
                  type="text"
                  required
                  value={newContactPerson}
                  onChange={(e) => setNewContactPerson(e.target.value)}
                  placeholder="e.g. Sarah Smith (Store Manager)"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="newMobile" className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="newMobile"
                  type="tel"
                  required
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  placeholder="e.g. +91 93448 90042"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="newShippingAddress" className="block text-xs font-semibold text-slate-700 mb-1">
                  Delivery / Branch Address
                </label>
                <input
                  id="newShippingAddress"
                  type="text"
                  value={newShippingAddress}
                  onChange={(e) => setNewShippingAddress(e.target.value)}
                  placeholder="e.g. 510 Railway Feeder Road, Tenkasi Branch"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Selected Employee Preview Summary */}
          {selectedCompany !== "NEW" && selectedEmployeeId !== "NEW" && currentEmployee && (
            <div className="sm:col-span-2 rounded-lg bg-teal-50/60 p-3.5 border border-teal-200 text-xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-teal-900 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-teal-700" />
                  Order Assigned To: <span className="font-bold">{currentEmployee.contactPerson}</span> ({currentEmployee.companyName})
                </span>
                <div className="mt-0.5 text-slate-600 flex items-center gap-3">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {currentEmployee.mobile}</span>
                  {currentEmployee.shippingAddress && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {currentEmployee.shippingAddress}</span>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-mono bg-white px-2 py-1 rounded border border-teal-200 text-teal-800 font-semibold">
                Client ID: {currentEmployee.id.slice(-6)}
              </span>
            </div>
          )}

          {/* Delivery Date */}
          <div>
            <label htmlFor="expectedDelivery" className="block text-xs font-semibold text-slate-700 mb-1">
              Expected Delivery Date <span className="text-red-500">*</span>
            </label>
            <input
              id="expectedDelivery"
              type="date"
              required
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
              className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>

          {/* Order Notes */}
          <div>
            <label htmlFor="orderNotes" className="block text-xs font-semibold text-slate-700 mb-1">
              Delivery Notes / PO Reference
            </label>
            <input
              id="orderNotes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. PO-8841 / Deliver to receiving bay 2"
              className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Line Items */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-semibold text-slate-900">2. Products & Quantities</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={addItemRow}
            className="flex items-center gap-1.5 text-xs h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => {
            const lineTotal =
              (item.quantity * item.unitPrice - item.discount) *
              (1 + item.taxRate / 100);

            return (
              <div
                key={index}
                className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-slate-50/50 p-3 sm:grid-cols-12 items-center"
              >
                {/* Product Dropdown */}
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Product & SKU
                  </label>
                  <select
                    value={item.productId}
                    onChange={(e) => handleProductChange(index, e.target.value)}
                    className="h-9 w-full rounded border border-border bg-white px-2.5 text-xs focus:border-primary focus:outline-none font-medium"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      handleLineChange(
                        index,
                        "quantity",
                        parseInt(e.target.value, 10) || 1
                      )
                    }
                    className="h-9 w-full rounded border border-border bg-white px-2.5 text-xs text-center font-semibold focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Unit Price */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      handleLineChange(
                        index,
                        "unitPrice",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="h-9 w-full rounded border border-border bg-white px-2.5 text-xs text-right focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Tax Rate */}
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    GST %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="28"
                    value={item.taxRate}
                    onChange={(e) =>
                      handleLineChange(
                        index,
                        "taxRate",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="h-9 w-full rounded border border-border bg-white px-2 text-xs text-center focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Line Total */}
                <div className="sm:col-span-2 text-right">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Total
                  </label>
                  <span className="font-bold text-slate-900 text-xs">
                    {money(lineTotal)}
                  </span>
                </div>

                {/* Remove */}
                <div className="sm:col-span-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeItemRow(index)}
                    disabled={items.length <= 1}
                    className="text-slate-400 hover:text-red-600 disabled:opacity-30 transition p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals & Options */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={generateInvoice}
              onChange={(e) => setGenerateInvoice(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <ReceiptText className="h-4 w-4 text-primary" />
            Auto-generate Commercial Tax Invoice on Dispatch
          </label>

          <div className="w-full sm:w-72 space-y-1.5 text-xs bg-slate-50 p-3 rounded-lg border border-border">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-medium">{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST Total:</span>
              <span className="font-medium">{money(totalTax)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1.5 text-sm font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="text-primary font-mono">{money(totalAmount)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/dashboard/orders">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
        <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          {isSubmitting ? "Creating Order..." : "Create Order"}
        </Button>
      </div>
    </form>
  );
}
