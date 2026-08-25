"use client";

import { useState } from "react";
import { 
  Building2, 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  UserCheck, 
  CheckCircle2,
  X,
  ClipboardCheck,
  Pencil,
  Save
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type ClientRecord = {
  id: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string | null;
  gstNumber: string | null;
  billingAddress: string;
  shippingAddress: string;
  status: string;
  orders: Array<{ id: string; orderNumber: string; totalAmount: number | string; status: string }>;
};

interface ClientsDirectoryViewProps {
  clients: ClientRecord[];
  onAddClient: (data: {
    companyName: string;
    contactPerson: string;
    mobile: string;
    email?: string;
    gstNumber?: string;
    billingAddress?: string;
    shippingAddress?: string;
  }) => Promise<void>;
  onUpdateClient?: (data: {
    id: string;
    companyName: string;
    contactPerson: string;
    mobile: string;
    email?: string;
    gstNumber?: string;
    billingAddress?: string;
    shippingAddress?: string;
    status: string;
  }) => Promise<void>;
}

export function ClientsDirectoryView({ clients, onAddClient, onUpdateClient }: ClientsDirectoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Group clients by company
  const companyMap: Record<string, ClientRecord[]> = {};
  for (const client of clients) {
    if (!companyMap[client.companyName]) {
      companyMap[client.companyName] = [];
    }
    companyMap[client.companyName].push(client);
  }

  const companies = Object.keys(companyMap);

  // Filter companies/employees by search
  const filteredCompanies = companies.filter((company) => {
    const term = searchTerm.toLowerCase();
    const matchesCompany = company.toLowerCase().includes(term);
    const emps = companyMap[company] || [];
    const matchesEmployee = emps.some(
      (e) =>
        e.contactPerson.toLowerCase().includes(term) ||
        e.mobile.includes(term) ||
        (e.gstNumber && e.gstNumber.toLowerCase().includes(term))
    );
    return matchesCompany || matchesEmployee;
  });

  // Modal Form State (Add)
  const [companyMode, setCompanyMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [selectedExistingCompany, setSelectedExistingCompany] = useState(companies[0] || "");
  const [formCompany, setFormCompany] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formGst, setFormGst] = useState("");
  const [formBilling, setFormBilling] = useState("");
  const [formShipping, setFormShipping] = useState("");

  // Edit Modal Form State
  const [editCompany, setEditCompany] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGst, setEditGst] = useState("");
  const [editBilling, setEditBilling] = useState("");
  const [editShipping, setEditShipping] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  const startEdit = (client: ClientRecord) => {
    setEditingClient(client);
    setEditCompany(client.companyName);
    setEditContact(client.contactPerson);
    setEditMobile(client.mobile);
    setEditEmail(client.email || "");
    setEditGst(client.gstNumber || "");
    setEditBilling(client.billingAddress);
    setEditShipping(client.shippingAddress);
    setEditStatus(client.status);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCompany = companyMode === "EXISTING" ? selectedExistingCompany : formCompany.trim();

    if (!finalCompany) {
      setFeedback({ text: "Please provide a Company Name.", type: "error" });
      return;
    }
    if (!formContact.trim() || !formMobile.trim()) {
      setFeedback({ text: "Employee Contact Name and Mobile are required.", type: "error" });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);
      await onAddClient({
        companyName: finalCompany,
        contactPerson: formContact.trim(),
        mobile: formMobile.trim(),
        email: formEmail.trim() || undefined,
        gstNumber: formGst.trim() || undefined,
        billingAddress: formBilling.trim() || undefined,
        shippingAddress: formShipping.trim() || undefined,
      });

      setFeedback({ text: `Employee "${formContact}" added under ${finalCompany}!`, type: "success" });
      setShowAddModal(false);
      setIsSubmitting(false);
      // Reset form
      setFormContact("");
      setFormMobile("");
      setFormEmail("");
    } catch (err: any) {
      setIsSubmitting(false);
      setFeedback({ text: err?.message || "Failed to add client.", type: "error" });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !onUpdateClient) return;

    try {
      setIsSubmitting(true);
      setFeedback(null);
      await onUpdateClient({
        id: editingClient.id,
        companyName: editCompany.trim(),
        contactPerson: editContact.trim(),
        mobile: editMobile.trim(),
        email: editEmail.trim() || undefined,
        gstNumber: editGst.trim() || undefined,
        billingAddress: editBilling.trim() || undefined,
        shippingAddress: editShipping.trim() || undefined,
        status: editStatus,
      });

      setFeedback({ text: `Updated ${editContact} (${editCompany}) successfully!`, type: "success" });
      setEditingClient(null);
      setIsSubmitting(false);
    } catch (err: any) {
      setIsSubmitting(false);
      setFeedback({ text: err?.message || "Failed to update client.", type: "error" });
    }
  };

  const totalEmployees = clients.length;
  const totalOrders = clients.reduce((sum, c) => sum + c.orders.length, 0);

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-lg p-4 text-sm font-medium border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Client Companies</p>
            <h3 className="text-2xl font-bold text-slate-800">{companies.length}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Registered Employees</p>
            <h3 className="text-2xl font-bold text-slate-800">{totalEmployees}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Customer Orders</p>
            <h3 className="text-2xl font-bold text-slate-800">{totalOrders}</h3>
          </div>
        </Card>
      </div>

      {/* Action Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by company, employee name, phone, or GST..."
            className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-4 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Company / Employee
        </Button>
      </div>

      {/* Company Cards Directory */}
      <div className="space-y-4">
        {filteredCompanies.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">
            No client companies match your search.
          </Card>
        ) : (
          filteredCompanies.map((companyName) => {
            const employees = companyMap[companyName] || [];
            const firstEmp = employees[0];
            const companyOrdersCount = employees.reduce((sum, e) => sum + e.orders.length, 0);

            return (
              <Card key={companyName} className="overflow-hidden p-0 shadow-sm border border-border">
                {/* Company Header */}
                <div className="bg-slate-50/80 px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-800 font-bold text-sm">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-slate-900">{companyName}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                        {firstEmp?.gstNumber && (
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-border">
                            GSTIN: {firstEmp.gstNumber}
                          </span>
                        )}
                        <span>{employees.length} contact person(s) / employees</span>
                        <span>· {companyOrdersCount} total orders</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCompanyMode("EXISTING");
                      setSelectedExistingCompany(companyName);
                      setShowAddModal(true);
                    }}
                    className="text-xs h-8 flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Employee
                  </Button>
                </div>

                {/* Employees Table under Company */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-white text-[11px] font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-6 py-2.5">Employee / Contact Person</th>
                        <th className="px-6 py-2.5">Mobile Phone</th>
                        <th className="px-6 py-2.5">Email</th>
                        <th className="px-6 py-2.5">Delivery Address</th>
                        <th className="px-6 py-2.5 text-center">Orders</th>
                        <th className="px-6 py-2.5">Status</th>
                        <th className="px-6 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-6 py-3 font-semibold text-slate-900 flex items-center gap-2">
                            <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                            {emp.contactPerson}
                          </td>
                          <td className="px-6 py-3 font-mono text-slate-700">{emp.mobile}</td>
                          <td className="px-6 py-3 text-slate-500">{emp.email || "—"}</td>
                          <td className="px-6 py-3 text-slate-600 max-w-xs truncate">{emp.shippingAddress}</td>
                          <td className="px-6 py-3 text-center font-bold text-slate-800">
                            {emp.orders.length}
                          </td>
                          <td className="px-6 py-3">
                            <Badge tone={emp.status === "ACTIVE" ? "green" : "neutral"}>
                              {emp.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <Button
                              variant="secondary"
                              onClick={() => startEdit(emp)}
                              className="h-7 px-2 text-xs flex items-center gap-1 ml-auto"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Company / Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl animate-in fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Add Client Company or Employee
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {/* Mode Toggle */}
              <div className="flex rounded-md border border-border p-0.5 bg-slate-100">
                <button
                  type="button"
                  onClick={() => setCompanyMode("EXISTING")}
                  disabled={companies.length === 0}
                  className={`flex-1 py-1.5 font-semibold rounded text-center transition ${
                    companyMode === "EXISTING"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Existing Company
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyMode("NEW")}
                  className={`flex-1 py-1.5 font-semibold rounded text-center transition ${
                    companyMode === "NEW"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  + New Company
                </button>
              </div>

              {/* Company Field */}
              {companyMode === "EXISTING" ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Company <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedExistingCompany}
                    onChange={(e) => setSelectedExistingCompany(e.target.value)}
                    className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 focus:border-primary focus:bg-white focus:outline-none font-medium"
                  >
                    {companies.map((comp) => (
                      <option key={comp} value={comp}>
                        🏢 {comp}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      New Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      placeholder="e.g. Apex Industrial Supplies"
                      className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Company GSTIN
                    </label>
                    <input
                      type="text"
                      value={formGst}
                      onChange={(e) => setFormGst(e.target.value)}
                      placeholder="e.g. 33AAYFP5618B1Z4"
                      className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 font-mono uppercase focus:border-primary focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee / Contact Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="e.g. Sarah Smith (Store Mgr)"
                    className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Contact Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    placeholder="e.g. +91 93448 90042"
                    className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Employee Email (optional)
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. sarah@company.com"
                  className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Shipping / Receiving Branch Address
                </label>
                <input
                  type="text"
                  value={formShipping}
                  onChange={(e) => setFormShipping(e.target.value)}
                  placeholder="e.g. 510 Railway Feeder Road, Receiving Dock"
                  className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Employee"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl animate-in fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Edit Client Company / Employee Details
              </h2>
              <button
                onClick={() => setEditingClient(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 font-bold focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Company GSTIN
                  </label>
                  <input
                    type="text"
                    value={editGst}
                    onChange={(e) => setEditGst(e.target.value)}
                    placeholder="e.g. 33AAYFP5618B1Z4"
                    className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 font-mono uppercase focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee / Contact Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 font-medium focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mobile Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 font-mono focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Account Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 focus:border-primary focus:bg-white focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Delivery / Branch Address
                </label>
                <input
                  type="text"
                  value={editShipping}
                  onChange={(e) => setEditShipping(e.target.value)}
                  className="h-9 w-full rounded border border-border bg-slate-50 px-2.5 focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingClient(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
