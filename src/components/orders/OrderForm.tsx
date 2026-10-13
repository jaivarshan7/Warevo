import React, { useState, useEffect } from "react";
import { Client, Product, OrderStatus, User as UserType } from "@/types";
import { OrderItemsEditor, EditableOrderItem } from "./OrderItemsEditor";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { orderStatusBadgeStyles } from "@/lib/orderWorkflow";
import {
  Building2,
  Users,
  Calendar,
  User,
  FileText,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft
} from "lucide-react";

export interface OrderFormValues {
  clientId?: string;
  selectedContactIds?: string[];
  expectedDelivery?: string;
  notes?: string;
  assignedStaffId?: string;
  eWayBill?: {
    transporterName?: string;
    vehicleNumber?: string;
    distanceKm?: number;
    transportMode?: string;
  };
  items: EditableOrderItem[];
}

interface OrderFormProps {
  mode: "create" | "edit";
  initialData?: Partial<OrderFormValues>;
  onSubmit: (values: OrderFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  clients?: Client[];
  products: Product[];
  staff: UserType[];
  orderNumber?: string;
  orderStatus?: OrderStatus;
  clientName?: string;
  actionError?: string | null;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  clients = [],
  products,
  staff,
  orderNumber,
  orderStatus,
  clientName,
  actionError
}) => {
  // Client selection (Create mode)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    initialData?.clientId || (clients[0]?.id || "")
  );
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(
    initialData?.selectedContactIds || []
  );

  // General fields
  const [expectedDelivery, setExpectedDelivery] = useState<string>(
    initialData?.expectedDelivery || ""
  );
  const [assignedStaffId, setAssignedStaffId] = useState<string>(
    initialData?.assignedStaffId || ""
  );
  const [notes, setNotes] = useState<string>(initialData?.notes || "");

  // E-Way Bill fields (Create mode)
  const [transporterName, setTransporterName] = useState<string>(
    initialData?.eWayBill?.transporterName || ""
  );
  const [vehicleNumber, setVehicleNumber] = useState<string>(
    initialData?.eWayBill?.vehicleNumber || ""
  );
  const [distanceKm, setDistanceKm] = useState<number>(
    initialData?.eWayBill?.distanceKm || 0
  );

  // Line items
  const [items, setItems] = useState<EditableOrderItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : products.length > 0
      ? [
          {
            productId: products[0].id,
            quantity: 1,
            unitPrice: Number(products[0].sellingPrice) || 0,
            taxRate: Number(products[0].gstRate) || 0,
            discount: 0,
            productName: products[0].name,
            sku: products[0].sku,
            unit: products[0].unit || "pcs"
          }
        ]
      : []
  );

  const [formValidationNotice, setFormValidationNotice] = useState<string | null>(null);

  // Update selected company default when clients load
  useEffect(() => {
    if (!selectedCompanyId && clients.length > 0) {
      setSelectedCompanyId(clients[0].id);
      setSelectedContactIds((clients[0].employees || []).map((e) => e.id));
    }
  }, [clients, selectedCompanyId]);

  const selectedCompany = clients.find((c) => c.id === selectedCompanyId) || clients[0];
  const companyEmployees = selectedCompany?.employees || [];

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const co = clients.find((c) => c.id === companyId);
    setSelectedContactIds((co?.employees || []).map((e) => e.id));
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationNotice(null);

    if (items.length === 0) {
      setFormValidationNotice("Order must contain at least one line item.");
      return;
    }

    if (mode === "create" && !selectedCompanyId) {
      setFormValidationNotice("Please select a client company for the order.");
      return;
    }

    await onSubmit({
      clientId: mode === "create" ? selectedCompanyId : undefined,
      selectedContactIds: mode === "create" ? selectedContactIds : undefined,
      expectedDelivery: expectedDelivery ? new Date(expectedDelivery).toISOString() : undefined,
      assignedStaffId: assignedStaffId || undefined,
      notes: notes || undefined,
      eWayBill:
        transporterName || vehicleNumber || distanceKm > 0
          ? {
              transporterName: transporterName || undefined,
              vehicleNumber: vehicleNumber || undefined,
              distanceKm: distanceKm || undefined,
              transportMode: "ROAD"
            }
          : undefined,
      items
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Action / Validation errors */}
      {(actionError || formValidationNotice) && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{actionError || formValidationNotice}</span>
        </div>
      )}

      {/* Header Info Banner in Edit Mode */}
      {mode === "edit" && orderNumber && (
        <Card className="p-5 border-slate-800 bg-slate-900/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold font-mono text-white">{orderNumber}</span>
                {orderStatus && (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                      orderStatusBadgeStyles[orderStatus] || "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {orderStatus.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Client: <strong className="text-slate-200">{clientName || "Direct Client"}</strong>
              </p>
            </div>
            <span className="text-xs text-indigo-400 font-medium">
              Editable prior to dispatch
            </span>
          </div>
        </Card>
      )}

      {/* Client Company & Contact Selection (Create Mode) */}
      {mode === "create" && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              1. Client & Notified Contacts
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Client Company <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                required
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} {c.billingAddress ? `(${c.billingAddress})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span className="flex items-center gap-1 font-medium">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Designated Contacts ({selectedContactIds.length} of {companyEmployees.length})
                </span>
                {companyEmployees.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedContactIds.length === companyEmployees.length) {
                        setSelectedContactIds([]);
                      } else {
                        setSelectedContactIds(companyEmployees.map((e) => e.id));
                      }
                    }}
                    className="text-indigo-400 hover:underline text-[10px]"
                  >
                    {selectedContactIds.length === companyEmployees.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {companyEmployees.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                  No registered employees for this client company.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {companyEmployees.map((emp) => {
                    const isChecked = selectedContactIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? "bg-indigo-950/40 border-indigo-600/60 text-white"
                            : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleContactSelection(emp.id)}
                          className="mt-0.5 w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold truncate leading-tight text-[11px]">{emp.contactPerson}</p>
                          <p className="text-[10px] text-slate-400">{emp.employeeRole} • {emp.mobile || "No Mobile"}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* General Dispatch & Fulfillment Details */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
            {mode === "create" ? "2. Fulfillment & Schedule" : "Fulfillment & Schedule"}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Assigned Warehouse Staff
            </label>
            <select
              value={assignedStaffId}
              onChange={(e) => setAssignedStaffId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Unassigned (Available to all staff) --</option>
              {staff.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.role.replace(/_/g, " ")})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Order Instructions / Gate & Dispatch Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Delivery gate entry instructions, handling requirements, pallet specs..."
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </Card>

      {/* E-Way Bill Section (Create mode) */}
      {mode === "create" && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Truck className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              3. E-Way Bill & Transport (Optional)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Transporter Name
              </label>
              <input
                type="text"
                placeholder="e.g. Express Logistics"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Vehicle Number
              </label>
              <input
                type="text"
                placeholder="e.g. MH 12 AB 1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Approx Distance (KM)
              </label>
              <input
                type="number"
                min="0"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-right focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Line Items Editor Card */}
      <Card className="p-5">
        <OrderItemsEditor
          items={items}
          onChange={setItems}
          availableProducts={products}
          disabled={isSubmitting}
        />
      </Card>

      {/* Action Footer Bar */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>

        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-indigo-950"
        >
          <CheckCircle2 className="w-4 h-4" />
          {mode === "create" ? "Create Order & Issue Invoice" : "Save Order Changes"}
        </Button>
      </div>
    </form>
  );
};
