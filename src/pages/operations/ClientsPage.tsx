import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchClients,
  createClientRecord,
  updateClientRecord,
  createClientEmployeeRecord,
  updateClientEmployeeRecord,
  deleteClientEmployeeRecord,
  fetchCompanyGroups,
  sendPasswordResetEmail
} from "@/lib/services";
import { createEmployeeWithAuth } from "@/lib/employeeService";
import { Client, ClientEmployee, ClientEmployeeRole, CompanyGroup, UserStatus } from "@/types";
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
  ShieldCheck,
  FolderTree
} from "lucide-react";

export const ClientsPage: React.FC = () => {
  const { tenant, role } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<CompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isEditCompanyOpen, setIsEditCompanyOpen] = useState(false);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);

  // Add Company Form State
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyGst, setNewCompanyGst] = useState("");
  const [newCompanyBilling, setNewCompanyBilling] = useState("");
  const [newCompanyShipping, setNewCompanyShipping] = useState("");
  const [newCompanyGroupId, setNewCompanyGroupId] = useState("");

  // Add Employee Form State
  const [selectedClientId, setSelectedClientId] = useState("");
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState<ClientEmployeeRole>("RECEIVER");
  const [empMobile, setEmpMobile] = useState("+91");
  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Edit Company Form State
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCompanyGst, setEditCompanyGst] = useState("");
  const [editCompanyBilling, setEditCompanyBilling] = useState("");
  const [editCompanyShipping, setEditCompanyShipping] = useState("");
  const [editCompanyGroupId, setEditCompanyGroupId] = useState("");
  const [editCompanyStatus, setEditCompanyStatus] = useState("ACTIVE");

  // Edit Employee Form State
  const [editingEmployee, setEditingEmployee] = useState<ClientEmployee | null>(null);
  const [editEmpClientId, setEditEmpClientId] = useState("");
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpMobile, setEditEmpMobile] = useState("");
  const [editEmpEmail, setEditEmpEmail] = useState("");
  const [editEmpRole, setEditEmpRole] = useState<ClientEmployeeRole>("RECEIVER");
  const [editEmpStatus, setEditEmpStatus] = useState<UserStatus>("ACTIVE");

  // Status & Error
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientList, groupList] = await Promise.all([
        fetchClients(tenant?.id),
        fetchCompanyGroups(tenant?.id)
      ]);
      setClients(clientList);
      setGroups(groupList);
    } catch (err) {
      console.error("Error loading client data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id]);

  const totalEmployees = clients.reduce((acc, c) => acc + (c.employees?.length || 0), 0);

  // Search Filter: Matches company name, GSTIN, or any employee name/mobile
  const filteredClients = clients.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesCompany =
      c.companyName.toLowerCase().includes(term) ||
      (c.gstNumber && c.gstNumber.toLowerCase().includes(term));
    const matchesEmployee = (c.employees || []).some(
      (e) =>
        e.contactPerson.toLowerCase().includes(term) ||
        e.mobile.includes(term) ||
        (e.email && e.email.toLowerCase().includes(term))
    );
    return matchesCompany || matchesEmployee;
  });

  // ─── ADD COMPANY HANDLER ──────────────────────────────────────────
  const handleAddCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    if (!newCompanyName.trim()) {
      setFormError("Company name is required.");
      return;
    }
    if (!newCompanyBilling.trim()) {
      setFormError("Billing address is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await createClientRecord({
        tenantId: tenant.id,
        companyName: newCompanyName.trim(),
        gstNumber: newCompanyGst.trim() || undefined,
        billingAddress: newCompanyBilling.trim(),
        shippingAddress: (newCompanyShipping.trim() || newCompanyBilling.trim()),
        companyGroupId: newCompanyGroupId || undefined
      });

      setSuccessMsg(`Company "${newCompanyName}" registered successfully!`);
      setIsAddCompanyOpen(false);
      setNewCompanyName("");
      setNewCompanyGst("");
      setNewCompanyBilling("");
      setNewCompanyShipping("");
      setNewCompanyGroupId("");
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create client company");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── ADD EMPLOYEE HANDLER ─────────────────────────────────────────
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setFormError("Please select a client company.");
      return;
    }
    if (!empName.trim()) {
      setFormError("Employee / Contact name is required.");
      return;
    }
    if (!empMobile.trim()) {
      setFormError("Mobile number is required.");
      return;
    }
    if (!empEmail.trim()) {
      setFormError("Email is required for employee account creation.");
      return;
    }
    if (!empPassword || empPassword.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    const targetCompany = clients.find((c) => c.id === selectedClientId);
    const resolvedTenantId = targetCompany?.tenantId || tenant?.id;
    if (!resolvedTenantId) {
      setFormError("Unable to resolve organization context for the selected company.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const result = await createEmployeeWithAuth({
        name: empName.trim(),
        email: empEmail.trim(),
        password: empPassword,
        mobile: empMobile.trim() || undefined,
        role: "CLIENT",
        clientEmployeeRole: empRole,
        clientId: selectedClientId,
        companyName: targetCompany?.companyName || "",
        billingAddress: targetCompany?.billingAddress || "Main Office",
        shippingAddress: targetCompany?.shippingAddress || "Main Office",
        tenantId: resolvedTenantId
      });

      if (!result.success) {
        setFormError(result.error || "Failed to create client employee");
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg(
        `Client employee ${empName} added under ${targetCompany?.companyName} with login access!`
      );

      setIsAddEmployeeOpen(false);
      setEmpName("");
      setEmpMobile("+91");
      setEmpEmail("");
      setEmpPassword("");
      setShowPassword(false);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || "Failed to add client employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── EDIT COMPANY HANDLER ─────────────────────────────────────────
  const startEditCompany = (c: Client) => {
    setEditingClient(c);
    setEditCompanyName(c.companyName);
    setEditCompanyGst(c.gstNumber || "");
    setEditCompanyBilling(c.billingAddress);
    setEditCompanyShipping(c.shippingAddress || c.billingAddress);
    setEditCompanyGroupId(c.companyGroupId || "");
    setEditCompanyStatus(c.status);
    setIsEditCompanyOpen(true);
  };

  const handleEditCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      setIsSubmitting(true);
      setFormError(null);
      await updateClientRecord(editingClient.id, {
        companyName: editCompanyName.trim(),
        gstNumber: editCompanyGst.trim() || undefined,
        billingAddress: editCompanyBilling.trim(),
        shippingAddress: editCompanyShipping.trim(),
        companyGroupId: editCompanyGroupId || null,
        status: editCompanyStatus
      });

      setSuccessMsg(`Updated company "${editCompanyName}" successfully!`);
      setIsEditCompanyOpen(false);
      setEditingClient(null);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || "Failed to update client company");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── EDIT EMPLOYEE HANDLER ────────────────────────────────────────
  const startEditEmployee = (emp: ClientEmployee) => {
    setEditingEmployee(emp);
    setEditEmpClientId(emp.clientId);
    setEditEmpName(emp.contactPerson);
    setEditEmpMobile(emp.mobile);
    setEditEmpEmail(emp.email || "");
    setEditEmpRole(emp.employeeRole);
    setEditEmpStatus(emp.status as UserStatus);
    setIsEditEmployeeOpen(true);
  };

  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      setIsSubmitting(true);
      setFormError(null);
      await updateClientEmployeeRecord(editingEmployee.id, {
        clientId: editEmpClientId || undefined,
        contactPerson: editEmpName.trim(),
        mobile: editEmpMobile.trim(),
        email: editEmpEmail.trim(), // explicit empty string clears email, or sets new email
        employeeRole: editEmpRole,
        status: editEmpStatus
      });

      setSuccessMsg(`Updated employee "${editEmpName}" successfully!`);
      setIsEditEmployeeOpen(false);
      setEditingEmployee(null);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || "Failed to update employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleEmployeeStatus = async (emp: ClientEmployee) => {
    const nextStatus: UserStatus = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const confirmMsg = emp.status === "ACTIVE"
      ? `Deactivate employee "${emp.contactPerson}"? Linked login sessions will be blocked immediately.`
      : `Reactivate employee "${emp.contactPerson}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await updateClientEmployeeRecord(emp.id, {
        status: nextStatus
      });
      setSuccessMsg(`Employee ${emp.contactPerson} is now ${nextStatus}.`);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to change employee status");
    }
  };

  const handleResetEmployeePassword = async (emp: ClientEmployee) => {
    if (!emp.email) {
      alert(`Cannot reset password: ${emp.contactPerson} does not have an email registered. Please edit and provide an email first.`);
      return;
    }
    if (!window.confirm(`Send password reset email to ${emp.email} for ${emp.contactPerson}?`)) return;

    try {
      await sendPasswordResetEmail(emp.email);
      setSuccessMsg(`Password reset email sent to ${emp.email}.`);
    } catch (err: any) {
      alert(err?.message || "Failed to send password reset email");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Client Companies & Directory</h1>
          <p className="text-sm text-slate-400">
            2-tier corporate structure: Client Companies and designated Client Employees.
          </p>
        </div>

        {role !== "CLIENT" && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              onClick={() => {
                setFormError(null);
                setIsAddCompanyOpen(true);
              }}
              className="gap-1.5 text-xs h-9"
            >
              <Building2 className="w-4 h-4" /> Add Company
            </Button>
            <Button
              onClick={() => {
                setFormError(null);
                setSelectedClientId(clients[0]?.id || "");
                setIsAddEmployeeOpen(true);
              }}
              className="gap-1.5 text-xs h-9"
              disabled={clients.length === 0}
            >
              <Plus className="w-4 h-4" /> Add Employee
            </Button>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Client Companies</p>
            <h3 className="text-2xl font-bold text-white">{clients.length}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-950 text-teal-400 border border-teal-800">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Client Employees</p>
            <h3 className="text-2xl font-bold text-white">{totalEmployees}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Active Companies</p>
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
          placeholder="Search by company name, GST, employee name, or phone..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {loading ? (
        <LoadingSpinner message="Loading client companies..." />
      ) : clients.length === 0 ? (
        <EmptyState
          title="No client companies found"
          description="Register your first client company to associate orders, assign contacts, and track deliveries."
          actionLabel="Add Company"
          onAction={() => setIsAddCompanyOpen(true)}
        />
      ) : filteredClients.length === 0 ? (
        <Card className="p-8 text-center text-slate-400 text-sm">
          No client companies or employees match "{searchTerm}".
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredClients.map((client) => {
            const employees = client.employees || [];
            const companyGroupName = (client as any).companyGroup?.name;

            return (
              <Card key={client.id} className="p-0 overflow-hidden border border-slate-800 bg-slate-900/60">
                {/* Company Header Row */}
                <div className="bg-slate-900/90 px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800 font-bold text-sm">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="font-bold text-base text-white">{client.companyName}</h2>
                        {companyGroupName && (
                          <span className="inline-flex items-center gap-1 font-medium bg-purple-950/80 text-purple-300 border border-purple-800/80 px-2 py-0.5 rounded-full text-[11px]">
                            <FolderTree className="h-3 w-3" />
                            {companyGroupName}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            client.status === "ACTIVE"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {client.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                        {client.gstNumber && (
                          <span className="font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 text-slate-300 text-[11px]">
                            GSTIN: {client.gstNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400">
                          <MapPin className="h-3 w-3 text-slate-500" />
                          {client.billingAddress}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span>{employees.length} employee(s)</span>
                      </div>
                    </div>
                  </div>

                  {role !== "CLIENT" && (
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={() => startEditCompany(client)}
                        className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/50 inline-flex items-center gap-1"
                      >
                        <Pencil className="h-3 w-3" /> Edit Company
                      </button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setFormError(null);
                          setIsAddEmployeeOpen(true);
                        }}
                        className="text-xs h-8 flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Employee
                      </Button>
                    </div>
                  )}
                </div>

                {/* Employees Table */}
                {employees.length === 0 ? (
                  <div className="px-5 py-4 text-xs text-slate-400 italic bg-slate-950/20">
                    No employees or contacts registered for this company yet. Click "Add Employee" above.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase text-slate-400">
                        <tr>
                          <th className="px-5 py-2.5">Client Employee</th>
                          <th className="px-5 py-2.5">Designated Role</th>
                          <th className="px-5 py-2.5">Mobile Phone</th>
                          <th className="px-5 py-2.5">Email</th>
                          <th className="px-5 py-2.5">Portal Access</th>
                          <th className="px-5 py-2.5 text-center">Status</th>
                          {role !== "CLIENT" && (
                            <th className="px-5 py-2.5 text-right">Actions</th>
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
                            <td className="px-5 py-3">
                              <span className="font-mono bg-slate-800/70 text-slate-300 px-2 py-0.5 rounded text-[11px] border border-slate-700/60">
                                {emp.employeeRole}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-mono text-slate-300">{emp.mobile}</td>
                            <td className="px-5 py-3 text-slate-400">{emp.email || "—"}</td>
                            <td className="px-5 py-3">
                              {emp.userId ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                  <ShieldCheck className="h-3.5 w-3.5" /> Login Active
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500">Contact Only</span>
                              )}
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
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    onClick={() => startEditEmployee(emp)}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded bg-indigo-950/50 border border-indigo-800/50 inline-flex items-center gap-1"
                                    title="Edit employee or reassign company"
                                  >
                                    <Pencil className="h-3 w-3" /> Edit
                                  </button>
                                  {emp.email && (
                                    <button
                                      onClick={() => handleResetEmployeePassword(emp)}
                                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold px-2 py-1 rounded bg-amber-950/50 border border-amber-800/50 inline-flex items-center gap-1"
                                      title="Send password reset link"
                                    >
                                      <Key className="h-3 w-3" /> Reset Pass
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleToggleEmployeeStatus(emp)}
                                    className={`text-xs font-semibold px-2 py-1 rounded border inline-flex items-center gap-1 ${
                                      emp.status === "ACTIVE"
                                        ? "text-rose-400 hover:text-rose-300 bg-rose-950/30 border-rose-800/40"
                                        : "text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 border-emerald-800/40"
                                    }`}
                                    title={emp.status === "ACTIVE" ? "Deactivate employee" : "Reactivate employee"}
                                  >
                                    {emp.status === "ACTIVE" ? "Deactivate" : "Activate"}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── ADD COMPANY MODAL ────────────────────────────────────────── */}
      {isAddCompanyOpen && (
        <Modal
          isOpen={isAddCompanyOpen}
          onClose={() => setIsAddCompanyOpen(false)}
          title="Register Client Company"
          description="Create a client company record. Employees can be added under this company."
          maxWidth="md"
        >
          <form onSubmit={handleAddCompanySubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Company Name *</label>
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="e.g. Kauvery Healthcare Ltd"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={newCompanyGst}
                  onChange={(e) => setNewCompanyGst(e.target.value)}
                  placeholder="33AABCK1234F1Z5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Corporate Group (Optional)</label>
                <select
                  value={newCompanyGroupId}
                  onChange={(e) => setNewCompanyGroupId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="">None (Independent)</option>
                  {groups
                    .filter((g) => !tenant?.id || g.tenantId === tenant.id)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Billing Address *</label>
              <textarea
                value={newCompanyBilling}
                onChange={(e) => setNewCompanyBilling(e.target.value)}
                placeholder="Registered head office / billing address..."
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
                value={newCompanyShipping}
                onChange={(e) => setNewCompanyShipping(e.target.value)}
                placeholder="Primary receiving dock / site address..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddCompanyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Company
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── ADD EMPLOYEE MODAL ───────────────────────────────────────── */}
      {isAddEmployeeOpen && (
        <Modal
          isOpen={isAddEmployeeOpen}
          onClose={() => setIsAddEmployeeOpen(false)}
          title="Add Client Employee"
          description="Register an authorized contact or delivery receiver under an existing client company."
          maxWidth="md"
        >
          <form onSubmit={handleAddEmployeeSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Client Company *</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                required
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Employee Name *</label>
                <input
                  type="text"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Designated Role *</label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value as ClientEmployeeRole)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                >
                  <option value="RECEIVER">RECEIVER (Goods Receiving)</option>
                  <option value="STORE">STORE (Store Incharge)</option>
                  <option value="ACCOUNT">ACCOUNT (Accountant)</option>
                  <option value="MANAGER">MANAGER (Store Manager)</option>
                  <option value="GM">GM (General Manager)</option>
                  <option value="MD">MD (Managing Director)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Number *</label>
                <input
                  type="text"
                  value={empMobile}
                  onChange={(e) => setEmpMobile(e.target.value)}
                  placeholder="+91..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  placeholder="employee@company.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* WMS Login Setup */}
            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                <div>
                  <span className="text-xs font-semibold text-white">WMS Portal Login Account</span>
                  <p className="text-[11px] text-slate-400">
                    A Supabase Auth account will be created with designated role permissions
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <label className="block text-xs font-medium text-slate-300 mb-1">Login Password * (Min 8 characters)</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={empPassword}
                    onChange={(e) => setEmpPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    minLength={8}
                    required
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

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Employee
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── EDIT COMPANY MODAL ───────────────────────────────────────── */}
      {isEditCompanyOpen && editingClient && (
        <Modal
          isOpen={isEditCompanyOpen}
          onClose={() => setIsEditCompanyOpen(false)}
          title={`Edit ${editingClient.companyName}`}
          description="Update company properties, addresses, or corporate group affiliation."
          maxWidth="md"
        >
          <form onSubmit={handleEditCompanySubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                <select
                  value={editCompanyStatus}
                  onChange={(e) => setEditCompanyStatus(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-300 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={editCompanyGst}
                  onChange={(e) => setEditCompanyGst(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Corporate Group</label>
                <select
                  value={editCompanyGroupId}
                  onChange={(e) => setEditCompanyGroupId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="">None (Independent)</option>
                  {groups
                    .filter((g) => !editingClient?.tenantId || g.tenantId === editingClient.tenantId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Billing Address *</label>
              <textarea
                value={editCompanyBilling}
                onChange={(e) => setEditCompanyBilling(e.target.value)}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Shipping Address</label>
              <textarea
                value={editCompanyShipping}
                onChange={(e) => setEditCompanyShipping(e.target.value)}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditCompanyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── EDIT EMPLOYEE MODAL ──────────────────────────────────────── */}
      {isEditEmployeeOpen && editingEmployee && (
        <Modal
          isOpen={isEditEmployeeOpen}
          onClose={() => setIsEditEmployeeOpen(false)}
          title={`Edit ${editingEmployee.contactPerson}`}
          description="Update contact information, designated role, or status."
          maxWidth="md"
        >
          <form onSubmit={handleEditEmployeeSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Client Company *</label>
              <select
                value={editEmpClientId}
                onChange={(e) => setEditEmpClientId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                required
              >
                {clients
                  .filter((c) => !tenant?.id || c.tenantId === tenant.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
              </select>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Reassigning company preserves employee history and maintains the existing user login account.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Employee Name *</label>
                <input
                  type="text"
                  value={editEmpName}
                  onChange={(e) => setEditEmpName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Designated Role *</label>
                <select
                  value={editEmpRole}
                  onChange={(e) => setEditEmpRole(e.target.value as ClientEmployeeRole)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  required
                >
                  <option value="RECEIVER">RECEIVER</option>
                  <option value="STORE">STORE</option>
                  <option value="ACCOUNT">ACCOUNT</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="GM">GM</option>
                  <option value="MD">MD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Number *</label>
                <input
                  type="text"
                  value={editEmpMobile}
                  onChange={(e) => setEditEmpMobile(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmpEmail}
                  onChange={(e) => setEditEmpEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
              <select
                value={editEmpStatus}
                onChange={(e) => setEditEmpStatus(e.target.value as UserStatus)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditEmployeeOpen(false)}>
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
