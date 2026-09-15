import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchEmployees,
  updateEmployee,
  updateEmployeeSecure,
  createAuditLogRecord
} from "@/lib/services";
import { fetchWarehouseEmployees } from "@/lib/employeeService";
import { User, Role, UserStatus, ALLOWED_EMPLOYEE_ROLES, Tenant } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";
// Custom badge component for UserStatus (ACTIVE/INACTIVE)
const UserStatusBadge: React.FC<{ status: UserStatus | string }> = ({ status }) => {
  const style =
    status === "ACTIVE"
      ? "bg-emerald-950 text-emerald-300 border-emerald-800"
      : "bg-slate-800 text-slate-400 border-slate-700";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${style}`}
    >
      {status}
    </span>
  );
};
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

// Human-readable role labels
const ROLE_LABELS: Record<string, string> = {
  WAREHOUSE_STAFF: "Warehouse Staff",
  PRODUCT_RECEIVER: "Product Receiver",
  ACCOUNTS_TEAM: "Accounts Team",
  ACCOUNTANT: "Accountant",
  WAREHOUSE_MODERATOR: "Warehouse Moderator"
};

export const EmployeesPage: React.FC = () => {
  const { user, tenant, role } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Add Employee Modal State - using AddEmployeeModal component
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Edit Employee Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editRole, setEditRole] = useState<Role>("WAREHOUSE_STAFF");
  const [editStatus, setEditStatus] = useState<UserStatus>("ACTIVE");

  // Edit form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadEmployees = async () => {
    if (!tenant?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      console.log(`[EmployeesPage] Loading employees for tenant: ${tenant.id}`);
      // Use secure fetch that enforces tenant isolation server-side
      const list = await fetchWarehouseEmployees(tenant.id);
      console.log(
        `[EmployeesPage] Supabase returned ${list.length} rows:`,
        list.map((u) => ({ id: u.id, name: u.name, role: u.role }))
      );
      setEmployees(list);
    } catch (err) {
      console.error("Error loading employees:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [tenant?.id]);

  // Filter employees - backend already filters by tenant and allowed roles
  const filteredEmployees = employees.filter((emp) => {
    // Secondary defensive filter: ensure only allowed warehouse employee roles are rendered
    if (!ALLOWED_EMPLOYEE_ROLES.includes(emp.role)) return false;
    const term = searchTerm.toLowerCase();
    return (
      emp.name.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.mobile?.includes(term) ||
      ROLE_LABELS[emp.role]?.toLowerCase().includes(term)
    );
  });


  const startEdit = (employee: User) => {
    if (employee.id === user?.id) {
      // Don't allow editing self through this modal
      return;
    }
    // Defensive guard: prevent opening edit modal for non-employee roles
    if (!ALLOWED_EMPLOYEE_ROLES.includes(employee.role as Role)) {
      console.warn("Attempted to edit non-employee user via EmployeesPage:", employee.role);
      return;
    }
    setEditingEmployee(employee);
    setEditFullName(employee.name || "");
    setEditEmail(employee.email || "");
    setEditMobile(employee.mobile || "");
    setEditRole(employee.role || "WAREHOUSE_STAFF");
    setEditStatus(employee.status || "ACTIVE");
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (!tenant?.id) return;

    // Prevent changing own status to avoid accidental lockout
    if (editingEmployee.id === user?.id) {
      setFormError("Cannot modify your own account through this interface.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const updates: {
        name?: string;
        email?: string;
        mobile?: string;
        role?: Role;
        status?: UserStatus;
      } = {};

      if (editFullName.trim() !== (editingEmployee.name || "")) {
        updates.name = editFullName.trim();
      }
      if (editEmail.trim() !== (editingEmployee.email || "")) {
        updates.email = editEmail.trim();
      }
      if (editMobile.trim() !== (editingEmployee.mobile || "")) {
        updates.mobile = editMobile.trim();
      }
      if (editRole !== editingEmployee.role) {
        updates.role = editRole;
      }
      if (editStatus !== editingEmployee.status) {
        updates.status = editStatus;
      }

      // Only update if there are actual changes
      const hasChanges = Object.keys(updates).length > 0;

      if (hasChanges) {
        if (!user?.id || !role) {
          throw new Error("User session information is missing. Please refresh.");
        }

        await updateEmployeeSecure({
          actorId: user.id,
          actorRole: role,
          targetId: editingEmployee.id,
          name: updates.name,
          email: updates.email,
          mobile: updates.mobile,
          role: updates.role,
          status: updates.status
        });

        setSuccessMsg(`${updates.name || editingEmployee.name} updated successfully!`);
      } else {
        setSuccessMsg("No changes to save.");
      }

      setIsEditOpen(false);
      setEditingEmployee(null);
      await loadEmployees();
    } catch (err: any) {
      setFormError(err?.message || "Failed to update employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (employee: User) => {
    if (!tenant?.id) return;
    if (employee.id === user?.id) {
      // Prevent self-deactivation
      setSuccessMsg("Cannot deactivate your own account.");
      return;
    }

    const newStatus = employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (user?.id && role) {
        await updateEmployeeSecure({
          actorId: user.id,
          actorRole: role,
          targetId: employee.id,
          status: newStatus as UserStatus
        });
      } else {
        await updateEmployee(employee.id, { status: newStatus });
      }

      setSuccessMsg(`${employee.name} ${newStatus === "ACTIVE" ? "activated" : "deactivated"} successfully!`);
      await loadEmployees();
    } catch (err: any) {
      setFormError(err?.message || `Failed to ${newStatus === "ACTIVE" ? "activate" : "deactivate"} employee`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Employee Management</h1>
          <p className="text-sm text-slate-400">
            Manage employees for {tenant?.name || "your warehouse"}. Only employees from your tenant are shown.
          </p>
        </div>

        <Button
          onClick={() => {
            setIsAddOpen(true);
            setFormError(null);
            setSuccessMsg(null);
          }}
          className="gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </Button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Total Employees</p>
            <h3 className="text-2xl font-bold text-white">{employees.length}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Active</p>
            <h3 className="text-2xl font-bold text-emerald-400">
              {employees.filter((e) => e.status === "ACTIVE").length}
            </h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
            <EyeOff className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Inactive</p>
            <h3 className="text-2xl font-bold text-slate-400">
              {employees.filter((e) => e.status === "INACTIVE").length}
            </h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-950 text-purple-400 border border-purple-800">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Roles</p>
            <h3 className="text-2xl font-bold text-purple-400">
              {new Set(employees.map((e) => e.role)).size}
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
          placeholder="Search by name, email, mobile, or role..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {loading ? (
        <LoadingSpinner message="Loading employees..." />
      ) : employees.length === 0 ? (
        <EmptyState
          title="No employees found"
          description={
            tenant?.id
              ? "Add your first employee to start managing warehouse staff."
              : "No tenant associated with this account."
          }
          actionLabel={tenant?.id ? "Add Employee" : undefined}
          onAction={tenant?.id ? () => setIsAddOpen(true) : undefined}
        />
      ) : filteredEmployees.length === 0 ? (
        <Card className="p-8 text-center text-slate-400 text-sm">
          No employees match "{searchTerm}".
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEmployees.map((emp) => {
            const isSelf = emp.id === user?.id;
            return (
              <Card key={emp.id} className="p-0 overflow-hidden border border-slate-800 bg-slate-900/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase text-slate-400">
                      <tr>
                        <th className="px-5 py-3">Employee</th>
                        <th className="px-5 py-3">Email</th>
                        <th className="px-5 py-3">Mobile</th>
                        <th className="px-5 py-3">Role</th>
                        <th className="px-5 py-3 text-center">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      <tr className="hover:bg-slate-800/40 transition">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-950 text-indigo-400 font-semibold text-xs border border-indigo-800">
                              {emp.name ? emp.name.charAt(0).toUpperCase() : "U"}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{emp.name || "Unknown User"}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">ID: {emp.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {emp.email ? (
                            <a href={`mailto:${emp.email}`} className="hover:text-indigo-400 flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {emp.email}
                            </a>
                          ) : (
                            <span className="text-slate-500 italic">No email</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-400 font-mono">
                          {emp.mobile || <span className="text-slate-500 italic">No mobile</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/50 text-purple-300 border border-purple-800/50">
                            {ROLE_LABELS[emp.role] || emp.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <UserStatusBadge status={emp.status || "ACTIVE"} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isSelf ? (
                              <span className="text-[10px] text-slate-600 px-2 py-1 rounded bg-slate-800 border border-slate-700">
                                You
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(emp)}
                                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded bg-indigo-950/50 border border-indigo-800/50 inline-flex items-center gap-1"
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(emp)}
                                  className={`text-xs px-2 py-1 rounded border inline-flex items-center gap-1 ${
                                    emp.status === "ACTIVE"
                                      ? "text-rose-400 hover:text-rose-300 bg-rose-950/30 border-rose-800/50"
                                      : "text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 border-emerald-800/50"
                                  }`}
                                >
                                  {emp.status === "ACTIVE" ? (
                                    <>
                                      <EyeOff className="h-3 w-3" /> Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-3 w-3" /> Activate
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Employee Modal - uses reusable AddEmployeeModal component */}
      <AddEmployeeModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={() => {
          loadEmployees();
          setSuccessMsg("Employee created successfully!");
        }}
        tenantId={tenant?.id}
        isPlatformAdmin={false}
      />

      {/* Edit Employee Modal */}
      {isEditOpen && editingEmployee && (
        <Modal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setFormError(null);
            setEditingEmployee(null);
            setEditFullName("");
            setEditEmail("");
            setEditMobile("");
            setEditRole("WAREHOUSE_STAFF");
            setEditStatus("ACTIVE");
          }}
          title={`Edit Employee`}
          description={`Update details for ${editingEmployee.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Role
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as Role)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              >
                {ALLOWED_EMPLOYEE_ROLES.map((roleOption) => (
                  <option key={roleOption} value={roleOption}>
                    {ROLE_LABELS[roleOption] || roleOption}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-2">
                Admin roles (PLATFORM_ADMIN, WAREHOUSE_OWNER) cannot be assigned through this interface.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
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

export default EmployeesPage;
