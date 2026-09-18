import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchClients, createClientRecord, updateClientRecord } from "@/lib/services";
import { createEmployeeWithAuth } from "@/lib/employeeService";
import { Client, ClientEmployeeRole } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Building2,
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Building,
  CheckCircle2,
  UserCheck,
  Pencil,
  Eye,
  EyeOff,
  Key,
  ShieldCheck
} from "lucide-react";

export const ClientsPage: React.FC = () => {
  const { tenant, role } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Add Client / Employee Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [companyMode, setCompanyMode] = useState<"EXISTING" | "NEW">("NEW");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [mobile, setMobile] = useState("+91");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [enableLogin, setEnableLogin] = useState(true);
  const [employeeRole, setEmployeeRole] = useState<ClientEmployeeRole>("RECEIVER");
  const [gstNumber, setGstNumber] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Client Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editCompany, setEditCompany] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGst, setEditGst] = useState("");
  const [editBilling, setEditBilling] = useState("");
  const [editShipping, setEditShipping] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  const loadClients = async () => {
    try {
      setLoading(true);
      const list = await fetchClients(tenant?.id);
      setClients(list);
    } catch (err) {
      console.error("Error loading clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [tenant?.id]);

  // Group clients by company
  const companyMap: Record<string, Client[]> = {};
  for (const client of clients) {
    const cName = client.companyName || "Unnamed Company";
    if (!companyMap[cName]) {
      companyMap[cName] = [];
    }
    companyMap[cName].push(client);
  }
  const companies = Object.keys(companyMap);

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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    const finalCompany = companyMode === "EXISTING" ? selectedCompany : companyName.trim();
    if (!finalCompany) {
      setFormError("Please provide a company name.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (enableLogin) {
        if (!email.trim()) {
          setFormError("Email is required to create a login account.");
          setIsSubmitting(false);
          return;
        }
        if (!password) {
          setFormError("Password is required to create a login account.");
          setIsSubmitting(false);
          return;
        }
        if (password.length < 8) {
          setFormError("Password must be at least 8 characters.");
          setIsSubmitting(false);
          return;
        }

        const existingClientRec = companyMode === "EXISTING" ? companyMap[selectedCompany]?.[0] : null;

        const result = await createEmployeeWithAuth({
          name: contactPerson.trim(),
          email: email.trim(),
          password,
          mobile: mobile.trim() || undefined,
          role: "CLIENT",
          clientEmployeeRole: employeeRole,
          clientId: existingClientRec?.id,
          companyName: finalCompany,
          billingAddress: billingAddress.trim() || "Main Office",
          shippingAddress: (shippingAddress.trim() || billingAddress.trim()) || "Main Office",
          gstNumber: gstNumber.trim() || undefined,
        });

        if (!result.success) {
          setFormError(result.error || "Failed to create client employee");
          setIsSubmitting(false);
          return;
        }

        setSuccessMsg(`Client employee ${contactPerson} under ${finalCompany} created with login access!`);
      } else {
        await createClientRecord({
          tenantId: tenant.id,
          companyName: finalCompany,
          contactPerson: contactPerson.trim(),
          mobile: mobile.trim(),
          email: email.trim() || undefined,
          gstNumber: gstNumber.trim() || undefined,
          billingAddress: billingAddress.trim(),
          shippingAddress: (shippingAddress.trim() || billingAddress.trim())
        });
        setSuccessMsg(`Contact ${contactPerson} under ${finalCompany} registered successfully!`);
      }

      setIsAddOpen(false);
      // Reset form
      setCompanyName("");
      setContactPerson("");
      setMobile("+91");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setGstNumber("");
      setBillingAddress("");
      setShippingAddress("");
      await loadClients();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create client");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (client: Client) => {
    setEditingClient(client);
    setEditCompany(client.companyName);
    setEditContact(client.contactPerson);
    setEditMobile(client.mobile);
    setEditEmail(client.email || "");
    setEditGst(client.gstNumber || "");
    setEditBilling(client.billingAddress);
    setEditShipping(client.shippingAddress || client.billingAddress);
    setEditStatus(client.status);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      setIsSubmitting(true);
      setFormError(null);
      await updateClientRecord({
        id: editingClient.id,
        companyName: editCompany.trim(),
        contactPerson: editContact.trim(),
        mobile: editMobile.trim(),
        email: editEmail.trim() || undefined,
        gstNumber: editGst.trim() || undefined,
        billingAddress: editBilling.trim(),
        shippingAddress: editShipping.trim(),
        status: editStatus
      });

      setSuccessMsg(`Updated ${editContact} (${editCompany}) successfully!`);
      setIsEditOpen(false);
      setEditingClient(null);
      await loadClients();
    } catch (err: any) {
      setFormError(err?.message || "Failed to update client");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Client Companies & Directory</h1>
          <p className="text-sm text-slate-400">
            2-tier organizational structure: Client companies and their designated authorized employees.
          </p>
        </div>

        {role !== "CLIENT" && (
          <Button
            onClick={() => {
              setCompanyMode(companies.length > 0 ? "EXISTING" : "NEW");
              setSelectedCompany(companies[0] || "");
              setIsAddOpen(true);
            }}
            className="gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Add Company / Employee
          </Button>
        )}
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Client Companies</p>
            <h3 className="text-2xl font-bold text-white">{companies.length}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-950 text-teal-400 border border-teal-800">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Authorized Personnel</p>
            <h3 className="text-2xl font-bold text-white">{clients.length}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Active Status</p>
            <h3 className="text-2xl font-bold text-emerald-400">
              {clients.filter((c) => c.status === "ACTIVE").length}
            </h3>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by company, employee name, phone, or GST..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {loading ? (
        <LoadingSpinner message="Loading client companies..." />
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients found"
          description="Register your first client company to associate orders and deliver shipments."
          actionLabel="Add Client"
          onAction={() => setIsAddOpen(true)}
        />
      ) : filteredCompanies.length === 0 ? (
        <Card className="p-8 text-center text-slate-400 text-sm">
          No client companies or contacts match "{searchTerm}".
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCompanies.map((cName) => {
            const employees = companyMap[cName] || [];
            const firstEmp = employees[0];

            return (
              <Card key={cName} className="p-0 overflow-hidden border border-slate-800 bg-slate-900/60">
                {/* Company Header Row */}
                <div className="bg-slate-900/90 px-5 py-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800 font-bold text-sm">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-white">{cName}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
                        {firstEmp?.gstNumber && (
                          <span className="font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 text-slate-300 text-[11px]">
                            GSTIN: {firstEmp.gstNumber}
                          </span>
                        )}
                        <span>{employees.length} contact person(s)</span>
                      </div>
                    </div>
                  </div>

                  {role !== "CLIENT" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCompanyMode("EXISTING");
                        setSelectedCompany(cName);
                        setIsAddOpen(true);
                      }}
                      className="text-xs h-8 flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Employee
                    </Button>
                  )}
                </div>

                {/* Employees Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase text-slate-400">
                      <tr>
                        <th className="px-5 py-2.5">Authorized Contact</th>
                        <th className="px-5 py-2.5">Mobile Phone</th>
                        <th className="px-5 py-2.5">Email</th>
                        <th className="px-5 py-2.5">Delivery / Billing Address</th>
                        <th className="px-5 py-2.5 text-center">Status</th>
                        {role !== "CLIENT" && (
                          <th className="px-5 py-2.5 text-right">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-5 py-3 font-semibold text-white flex items-center gap-2">
                            <UserCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                            {emp.contactPerson}
                          </td>
                          <td className="px-5 py-3 font-mono text-slate-300">{emp.mobile}</td>
                          <td className="px-5 py-3 text-slate-400">{emp.email || "—"}</td>
                          <td className="px-5 py-3 text-slate-400 max-w-xs truncate">
                            {emp.shippingAddress || emp.billingAddress}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                emp.status === "ACTIVE"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {emp.status}
                            </span>
                          </td>
                          {role !== "CLIENT" && (
                            <td className="px-5 py-3 text-right">
                              <button
                                onClick={() => startEdit(emp)}
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded bg-indigo-950/50 border border-indigo-800/50 inline-flex items-center gap-1"
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Client / Employee Modal */}
      {isAddOpen && (
        <Modal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          title="Register Client Company / Employee"
          description="Add a new client organization or register an additional authorized contact under an existing client."
          maxWidth="md"
        >
          <form onSubmit={handleAddSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {formError}
              </div>
            )}

            {/* Existing vs New Company toggle */}
            {companies.length > 0 && (
              <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCompanyMode("EXISTING")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                    companyMode === "EXISTING"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Existing Company ({companies.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyMode("NEW")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                    companyMode === "NEW"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  + New Company
                </button>
              </div>
            )}

            {companyMode === "EXISTING" && companies.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select Existing Company *
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => {
                    setSelectedCompany(e.target.value);
                    const found = companyMap[e.target.value]?.[0];
                    if (found) {
                      setGstNumber(found.gstNumber || "");
                      setBillingAddress(found.billingAddress || "");
                      setShippingAddress(found.shippingAddress || "");
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                >
                  {companies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Industrial Corp"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Employee / Contact Name *
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email {enableLogin && "*"}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required={enableLogin}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">GST Number</label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none uppercase"
                />
              </div>
            </div>

            {/* WMS Login Account Section */}
            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  <div>
                    <span className="text-xs font-semibold text-white">WMS Portal Access</span>
                    <p className="text-[11px] text-slate-400">Create a secure Supabase Auth login for this client employee</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enableLogin}
                  onChange={(e) => setEnableLogin(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {enableLogin && (
                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Role in Company *
                    </label>
                    <select
                      value={employeeRole}
                      onChange={(e) => setEmployeeRole(e.target.value as ClientEmployeeRole)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      required
                    >
                      <option value="RECEIVER">Receiver (Delivery Receiver)</option>
                      <option value="STORE">Store Incharge</option>
                      <option value="ACCOUNT">Accountant</option>
                      <option value="MANAGER">Store Manager</option>
                      <option value="GM">General Manager (GM)</option>
                      <option value="MD">Managing Director (MD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Login Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        minLength={8}
                        required={enableLogin}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-xs text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Billing Address *
              </label>
              <textarea
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Complete registered billing address..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Shipping Address (Optional, defaults to billing)
              </label>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Delivery dock or warehouse destination..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Contact
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Client Modal */}
      {isEditOpen && editingClient && (
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Edit ${editingClient.contactPerson}`}
          description={`Update details for client record under ${editingClient.companyName}`}
          maxWidth="md"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="BLOCKED">BLOCKED</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Contact Person *
                </label>
                <input
                  type="text"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="text"
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">GST Number</label>
                <input
                  type="text"
                  value={editGst}
                  onChange={(e) => setEditGst(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Billing Address *
              </label>
              <textarea
                value={editBilling}
                onChange={(e) => setEditBilling(e.target.value)}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Shipping Address
              </label>
              <textarea
                value={editShipping}
                onChange={(e) => setEditShipping(e.target.value)}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
