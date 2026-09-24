import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  Shield,
  Plus,
  Search,
  Pencil,
  Trash2,
  Lock,
  Users,
  CheckSquare,
  Square,
  AlertTriangle,
  RefreshCw,
  Eye,
  RotateCcw,
  CheckCircle2,
  XCircle,
  X
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  fetchAdminRoles,
  fetchAvailablePermissions,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole
} from "@/lib/services";
import { AdminRoleItem, PermissionItem, PermissionKey, UserStatus } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export interface PermissionGroup {
  category: string;
  permissions: {
    key: PermissionKey;
    label: string;
    description: string;
  }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    category: "Orders",
    permissions: [
      { key: "ORDERS_VIEW", label: "View Orders", description: "View orders list and order details" },
      { key: "ORDERS_PROCESS", label: "Process Orders", description: "Advance fulfillment and processing stages" },
      { key: "ORDERS_DISPATCH", label: "Dispatch Orders", description: "Confirm warehouse shipment dispatch" }
    ]
  },
  {
    category: "Delivery",
    permissions: [
      { key: "DELIVERY_VERIFY", label: "Verify Delivery", description: "Item inspection and physical condition confirmation" }
    ]
  },
  {
    category: "Inventory",
    permissions: [
      { key: "INVENTORY_VERIFY", label: "Verify Inventory", description: "Storekeeper receipt and inventory update confirmation" }
    ]
  },
  {
    category: "Invoices",
    permissions: [
      { key: "INVOICES_VIEW", label: "View Invoices", description: "View commercial invoices and tax details" },
      { key: "INVOICES_MANAGE", label: "Manage Invoices", description: "Manage and download commercial invoices" }
    ]
  },
  {
    category: "Accounts",
    permissions: [
      { key: "ACCOUNTS_VIEW", label: "View Accounts", description: "View client ledger, outstanding balance, and accounts" }
    ]
  },
  {
    category: "Payments",
    permissions: [
      { key: "PAYMENTS_VIEW", label: "View Payments", description: "View recorded invoice payments" },
      { key: "PAYMENTS_RECORD", label: "Record Payments", description: "Record invoice payment settlements" },
      { key: "PAYMENT_PROOF_UPLOAD", label: "Upload Payment Proof", description: "Upload bank transfer receipts or proof documents" }
    ]
  },
  {
    category: "Reports",
    permissions: [
      { key: "REPORTS_VIEW", label: "View Reports", description: "View financial, operational, and fulfillment reports" }
    ]
  }
];

export const RolesPermissionsTab: React.FC<{
  selectedTenantId?: string | null;
}> = ({ selectedTenantId }) => {
  const { role, user } = useAuth();
  const [roles, setRoles] = useState<AdminRoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "SYSTEM" | "CUSTOM">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRoleItem | null>(null);
  const [viewingRole, setViewingRole] = useState<AdminRoleItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    status: "ACTIVE" as UserStatus,
    selectedPermissions: [] as PermissionKey[]
  });

  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminRoles(selectedTenantId || user?.tenantId);
      setRoles(data);
    } catch (err: any) {
      console.error("Failed to load roles:", err);
      setActionMessage({ type: "error", text: err.message || "Failed to load roles." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, [selectedTenantId, user?.tenantId]);

  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q);

      const matchesType =
        typeFilter === "ALL" ||
        (typeFilter === "SYSTEM" && r.systemRole) ||
        (typeFilter === "CUSTOM" && !r.systemRole);

      const matchesStatus =
        statusFilter === "ALL" || r.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [roles, searchQuery, typeFilter, statusFilter]);

  const handleOpenCreateModal = () => {
    setRoleForm({
      name: "",
      description: "",
      status: "ACTIVE",
      selectedPermissions: ["ORDERS_VIEW"]
    });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (r: AdminRoleItem) => {
    setEditingRole(r);
    setRoleForm({
      name: r.name,
      description: r.description || "",
      status: r.status,
      selectedPermissions: (r.permissions || []).map((p) => p.key)
    });
  };

  const handleTogglePermission = (key: PermissionKey) => {
    setRoleForm((prev) => {
      const exists = prev.selectedPermissions.includes(key);
      return {
        ...prev,
        selectedPermissions: exists
          ? prev.selectedPermissions.filter((k) => k !== key)
          : [...prev.selectedPermissions, key]
      };
    });
  };

  const handleToggleGroup = (group: PermissionGroup) => {
    const groupKeys = group.permissions.map((p) => p.key);
    const allChecked = groupKeys.every((k) => roleForm.selectedPermissions.includes(k));

    setRoleForm((prev) => {
      if (allChecked) {
        return {
          ...prev,
          selectedPermissions: prev.selectedPermissions.filter((k) => !groupKeys.includes(k))
        };
      } else {
        const set = new Set([...prev.selectedPermissions, ...groupKeys]);
        return {
          ...prev,
          selectedPermissions: Array.from(set)
        };
      }
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      setActionMessage({ type: "error", text: "Role name is required." });
      return;
    }

    setSubmitting(true);
    try {
      await createAdminRole(
        roleForm.name.trim(),
        roleForm.description.trim() || undefined,
        selectedTenantId || user?.tenantId || undefined,
        roleForm.selectedPermissions
      );

      setShowCreateModal(false);
      setActionMessage({ type: "success", text: `Role "${roleForm.name.trim()}" created successfully.` });
      await loadRoles();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create role." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    setSubmitting(true);
    try {
      await updateAdminRole(
        editingRole.id,
        editingRole.systemRole ? undefined : roleForm.name.trim(),
        roleForm.description.trim() || undefined,
        editingRole.systemRole ? undefined : roleForm.status,
        roleForm.selectedPermissions
      );

      setEditingRole(null);
      setActionMessage({ type: "success", text: `Role "${editingRole.name}" updated successfully.` });
      await loadRoles();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update role." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (r: AdminRoleItem) => {
    if (r.systemRole) {
      setActionMessage({ type: "error", text: "System roles cannot be deactivated." });
      return;
    }

    const newStatus: UserStatus = r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const actionLabel = newStatus === "INACTIVE" ? "deactivate" : "restore";

    if (!window.confirm(`Are you sure you want to ${actionLabel} custom role "${r.name}"?`)) {
      return;
    }

    try {
      await updateAdminRole(r.id, undefined, undefined, newStatus);
      setActionMessage({
        type: "success",
        text: `Role "${r.name}" has been ${newStatus === "ACTIVE" ? "restored" : "deactivated"}.`
      });
      await loadRoles();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || `Failed to ${actionLabel} role.` });
    }
  };

  const handleDelete = async (r: AdminRoleItem) => {
    if (r.systemRole) {
      setActionMessage({ type: "error", text: "System roles cannot be deleted." });
      return;
    }

    if ((r.userCount || 0) > 0) {
      setActionMessage({
        type: "error",
        text: `Cannot delete role "${r.name}": ${r.userCount} employees are currently assigned to it. Please reassign them first.`
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete custom role "${r.name}"?`)) {
      return;
    }

    try {
      await deleteAdminRole(r.id);
      setActionMessage({ type: "success", text: `Role "${r.name}" deleted successfully.` });
      await loadRoles();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to delete role." });
    }
  };

  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium ${
            actionMessage.type === "success"
              ? "bg-emerald-950/70 border-emerald-800 text-emerald-200"
              : "bg-rose-950/70 border-rose-800 text-rose-200"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="p-1 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Controls Card */}
      <Card className="p-4 bg-slate-900/60 border-slate-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-3 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles by name or description..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-800/80 border border-slate-700 text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="SYSTEM">System Roles</option>
              <option value="CUSTOM">Custom Roles</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-800/80 border border-slate-700 text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={loadRoles}
              isLoading={loading}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              size="sm"
              onClick={handleOpenCreateModal}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-sm shadow-indigo-950"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Custom Role
            </Button>
          </div>
        </div>
      </Card>

      {/* Roles Table Card */}
      <Card className="overflow-hidden border-slate-800 bg-slate-900/60 p-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-sm text-white">Defined Roles & Permissions</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {filteredRoles.length} roles total
          </span>
        </div>

        {loading ? (
          <div className="p-12">
            <LoadingSpinner message="Loading role definitions & permissions..." />
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Shield className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-medium">No roles match your search</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting the search query or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Users</th>
                  <th className="px-4 py-3">Permissions</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRoles.map((r) => {
                  const permCount = (r.permissions || []).length;
                  return (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Role & Description */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono text-sm">{r.name}</span>
                          {r.systemRole && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/60">
                              <Lock className="w-2.5 h-2.5" /> SYSTEM
                            </span>
                          )}
                        </div>
                        {r.description && (
                          <p className="text-slate-400 text-[11px] mt-0.5 max-w-md line-clamp-1">
                            {r.description}
                          </p>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="px-4 py-3">
                        {r.systemRole ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            Built-in Protected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-950/70 text-indigo-300 border border-indigo-800/60">
                            Custom Role
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {r.status === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            INACTIVE
                          </span>
                        )}
                      </td>

                      {/* Assigned Users Count */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono font-medium text-[11px]">
                          <Users className="w-3 h-3 text-slate-400" />
                          {r.userCount ?? 0}
                        </span>
                      </td>

                      {/* Permissions Count & Preview */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                            {permCount} permissions
                          </span>
                          <button
                            onClick={() => setViewingRole(r)}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline ml-1"
                          >
                            View All
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(r)}
                            className="text-[11px] h-7 px-2"
                            title="Edit Role & Permissions"
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>

                          {!r.systemRole && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleActive(r)}
                                className={`text-[11px] h-7 px-2 ${
                                  r.status === "ACTIVE"
                                    ? "text-amber-300 hover:text-amber-200 border-amber-800/60"
                                    : "text-emerald-300 hover:text-emerald-200 border-emerald-800/60"
                                }`}
                                title={r.status === "ACTIVE" ? "Deactivate Role" : "Restore Role"}
                              >
                                {r.status === "ACTIVE" ? "Deactivate" : "Restore"}
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(r)}
                                className="text-[11px] h-7 px-2 text-rose-400 hover:text-rose-300 border-rose-800/60"
                                title="Delete Custom Role"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: View Role Details & Permission Set */}
      {viewingRole && (
        <Modal
          isOpen={Boolean(viewingRole)}
          onClose={() => setViewingRole(null)}
          title={`Role Details: ${viewingRole.name}`}
          description={viewingRole.description || "Permissions assigned to this role."}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Type & Status:</span>
                <span className="font-semibold text-white">
                  {viewingRole.systemRole ? "System Built-in (Protected)" : "Custom Role"} • {viewingRole.status}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[11px]">Assigned Employees:</span>
                <span className="font-mono font-bold text-indigo-400">{viewingRole.userCount ?? 0}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Assigned Permissions ({(viewingRole.permissions || []).length})
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {(viewingRole.permissions || []).map((p) => (
                  <div
                    key={p.key}
                    className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/60 flex items-start gap-2 text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">{p.name}</span>
                      <span className="text-[10px] text-indigo-300 font-mono block">{p.key}</span>
                      {p.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{p.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setViewingRole(null)} size="sm">
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Create Custom Role */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create Custom Role"
          description="Define a new role and choose its granular permissions."
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Role Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                placeholder="e.g. OPERATIONS_AUDITOR, INVENTORY_SUPERVISOR..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">
                Role names must not duplicate built-in system names (MD, GM, MANAGER, RECEIVER, STORE, ACCOUNT).
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder="Operational purpose and scope of this custom role..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Permission Groups */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Permission Matrix ({roleForm.selectedPermissions.length} selected)
                </span>
                <span className="text-[11px] text-indigo-400 font-medium">
                  Grouped Permissions
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                {PERMISSION_GROUPS.map((group) => {
                  const allChecked = group.permissions.every((p) =>
                    roleForm.selectedPermissions.includes(p.key)
                  );
                  const someChecked = group.permissions.some((p) =>
                    roleForm.selectedPermissions.includes(p.key)
                  );

                  return (
                    <div
                      key={group.category}
                      className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleToggleGroup(group)}
                          className="flex items-center gap-2 text-xs font-bold text-white hover:text-indigo-300"
                        >
                          {allChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : someChecked ? (
                            <div className="w-4 h-4 rounded bg-indigo-600/60 border border-indigo-400 flex items-center justify-center text-[10px] text-white">
                              -
                            </div>
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                          <span>{group.category}</span>
                        </button>
                        <span className="text-[10px] text-slate-500">
                          {group.permissions.filter((p) => roleForm.selectedPermissions.includes(p.key)).length} / {group.permissions.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 pt-1">
                        {group.permissions.map((p) => {
                          const checked = roleForm.selectedPermissions.includes(p.key);
                          return (
                            <label
                              key={p.key}
                              className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                                checked
                                  ? "bg-indigo-950/40 border-indigo-600/60 text-white"
                                  : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleTogglePermission(p.key)}
                                className="mt-0.5 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                              />
                              <div>
                                <span className="font-semibold block">{p.label}</span>
                                <span className="text-[10px] text-slate-500 block">{p.description}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                Create Role
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Edit Role & Permissions */}
      {editingRole && (
        <Modal
          isOpen={Boolean(editingRole)}
          onClose={() => setEditingRole(null)}
          title={`Edit Role: ${editingRole.name}`}
          description={editingRole.systemRole ? "Modify granular permissions for this system role." : "Update custom role details and assigned permissions."}
          maxWidth="2xl"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editingRole.systemRole ? (
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/60 text-xs text-purple-200 flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-purple-400" />
                <span>
                  This is a protected system role. Name and status cannot be modified, but administrative permission assignments may be tailored.
                </span>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Role Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={roleForm.status}
                    onChange={(e) => setRoleForm({ ...roleForm, status: e.target.value as UserStatus })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Permission Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Permission Matrix ({roleForm.selectedPermissions.length} selected)
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                {PERMISSION_GROUPS.map((group) => {
                  const allChecked = group.permissions.every((p) =>
                    roleForm.selectedPermissions.includes(p.key)
                  );
                  const someChecked = group.permissions.some((p) =>
                    roleForm.selectedPermissions.includes(p.key)
                  );

                  return (
                    <div
                      key={group.category}
                      className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleToggleGroup(group)}
                          className="flex items-center gap-2 text-xs font-bold text-white hover:text-indigo-300"
                        >
                          {allChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : someChecked ? (
                            <div className="w-4 h-4 rounded bg-indigo-600/60 border border-indigo-400 flex items-center justify-center text-[10px] text-white">
                              -
                            </div>
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                          <span>{group.category}</span>
                        </button>
                        <span className="text-[10px] text-slate-500">
                          {group.permissions.filter((p) => roleForm.selectedPermissions.includes(p.key)).length} / {group.permissions.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 pt-1">
                        {group.permissions.map((p) => {
                          const checked = roleForm.selectedPermissions.includes(p.key);
                          return (
                            <label
                              key={p.key}
                              className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                                checked
                                  ? "bg-indigo-950/40 border-indigo-600/60 text-white"
                                  : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleTogglePermission(p.key)}
                                className="mt-0.5 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                              />
                              <div>
                                <span className="font-semibold block">{p.label}</span>
                                <span className="text-[10px] text-slate-500 block">{p.description}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
