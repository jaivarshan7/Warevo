import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Users,
  Plus,
  Search,
  MapPin,
  Layers,
  Mail,
  Phone,
  Briefcase,
  UserCheck,
  Store,
  RefreshCw,
  X,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Key
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";
import { createEmployeeWithAuth } from "@/lib/employeeService";
import {
  fetchAdminDashboardData,
  createAdminWarehouse,
  createAdminClient,
  createAdminCompanyGroup,
  createAdminTenant,
  updateAdminWarehouse,
  deleteAdminWarehouse,
  updateAdminUser,
  updateAdminUserWithRoleAudit,
  updateAdminClient,
  updateAdminTenant,
  assignClientCompanyGroup,
  updateClientEmployeeSecure,
  sendPasswordResetEmail,
  AdminWarehouseItem,
  AdminUserItem,
  AdminClientItem,
  AdminCompanyGroupItem,
  AdminTenantItem
} from "@/lib/services";
import { Role, ClientEmployeeRole, UserStatus } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export const AdminDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warehouses, setWarehouses] = useState<AdminWarehouseItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [clients, setClients] = useState<AdminClientItem[]>([]);
  const [companyGroups, setCompanyGroups] = useState<AdminCompanyGroupItem[]>([]);
  const [tenants, setTenants] = useState<AdminTenantItem[]>([]);

  const { user, role, refreshUsers } = useAuth();

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<"warehouses" | "admins" | "warehouse_employees" | "clients" | "groups" | "tenants">("warehouses");
  const [searchQuery, setSearchQuery] = useState("");
  const [tenantFilter, setTenantFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal states
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [showAddPlatformAdmin, setShowAddPlatformAdmin] = useState(false);
  const [showAddWarehouseEmployee, setShowAddWarehouseEmployee] = useState(false);
  const [selectedWarehouseTenantId, setSelectedWarehouseTenantId] = useState<string>("");
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit modal states
  const [editingWarehouse, setEditingWarehouse] = useState<AdminWarehouseItem | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [editingClient, setEditingClient] = useState<AdminClientItem | null>(null);
  const [editingClientEmployee, setEditingClientEmployee] = useState<{
    id: string;
    clientId: string;
    tenantId?: string;
    contactPerson: string;
    mobile: string;
    email: string;
    employeeRole: ClientEmployeeRole;
    status: UserStatus;
  } | null>(null);
  const [editingTenant, setEditingTenant] = useState<AdminTenantItem | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const [tenantForm, setTenantForm] = useState({
    name: "",
    slug: "",
    gstNumber: "",
    email: "",
    phone: "",
    address: ""
  });

  // Form states
  const [warehouseForm, setWarehouseForm] = useState({
    name: "",
    code: "",
    address: "",
    tenantId: ""
  });

  const [platformAdminForm, setPlatformAdminForm] = useState({
    name: "",
    email: "",
    password: "",
    mobile: "",
    tenantId: ""
  });
  const [showPlatformAdminPassword, setShowPlatformAdminPassword] = useState(false);

  const [clientForm, setClientForm] = useState({
    companyName: "",
    contactPerson: "",
    mobile: "",
    email: "",
    gstNumber: "",
    billingAddress: "",
    shippingAddress: "",
    tenantId: ""
  });

  const [employeeForm, setEmployeeForm] = useState({
    clientId: "",
    companyName: "",
    contactPerson: "",
    mobile: "",
    email: "",
    password: "",
    employeeRole: "RECEIVER" as ClientEmployeeRole,
    tenantId: ""
  });
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);

  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    tenantId: ""
  });
  const [groupTenantId, setGroupTenantId] = useState("");

  const [showAttachCompany, setShowAttachCompany] = useState(false);
  const [selectedAttachGroupId, setSelectedAttachGroupId] = useState("");
  const [selectedAttachClientId, setSelectedAttachClientId] = useState("");

  const loadData = async () => {
    try {
      const data = await fetchAdminDashboardData(user?.tenantId, role);
      setWarehouses(data.warehouses);
      setUsers(data.users);
      setClients(data.clients);
      setCompanyGroups(data.companyGroups);
      setTenants(data.tenants);

      const defaultTenantId = user?.tenantId || (data.tenants.length === 1 ? data.tenants[0].id : "");
      if (defaultTenantId) {
        setWarehouseForm((prev) => ({ ...prev, tenantId: prev.tenantId || defaultTenantId }));
        setPlatformAdminForm((prev) => ({ ...prev, tenantId: prev.tenantId || defaultTenantId }));
        setClientForm((prev) => ({ ...prev, tenantId: prev.tenantId || defaultTenantId }));
        setEmployeeForm((prev) => ({ ...prev, tenantId: prev.tenantId || defaultTenantId }));
      }
    } catch (err) {
      console.error("Failed to load admin dashboard data:", err);
      setActionMessage({ type: "error", text: "Failed to load admin metrics." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // Filtered Warehouses
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((wh) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        wh.name.toLowerCase().includes(q) ||
        wh.code.toLowerCase().includes(q) ||
        wh.address.toLowerCase().includes(q) ||
        (wh.tenant?.name ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || wh.status === statusFilter;
      const matchesTenant = tenantFilter === "ALL" || wh.tenant?.id === tenantFilter;
      return matchesSearch && matchesStatus && matchesTenant;
    });
  }, [warehouses, searchQuery, statusFilter, tenantFilter]);

  // 1. Platform Admins (ONLY role === "PLATFORM_ADMIN")
  const platformAdmins = useMemo(() => {
    return users.filter((u) => u.role === "PLATFORM_ADMIN");
  }, [users]);

  const filteredPlatformAdmins = useMemo(() => {
    return platformAdmins.filter((u) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.mobile ?? "").includes(q);
      const matchesStatus = statusFilter === "ALL" || u.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [platformAdmins, searchQuery, statusFilter]);

  // 2. Warehouse Employees (warehouse-side roles; excludes PLATFORM_ADMIN, CLIENT, CLIENT_ACCOUNTANT)
  const warehouseEmployees = useMemo(() => {
    return users.filter(
      (u) =>
        u.role !== "PLATFORM_ADMIN" &&
        u.role !== "CLIENT" &&
        u.role !== "CLIENT_ACCOUNTANT"
    );
  }, [users]);

  const filteredWarehouseEmployees = useMemo(() => {
    return warehouseEmployees.filter((u) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.mobile ?? "").includes(q) ||
        (u.tenant?.name ?? "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q);
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchesStatus = statusFilter === "ALL" || u.status === statusFilter;
      const matchesTenant = tenantFilter === "ALL" || u.tenant?.id === tenantFilter;
      return matchesSearch && matchesRole && matchesStatus && matchesTenant;
    });
  }, [warehouseEmployees, searchQuery, roleFilter, statusFilter, tenantFilter]);

  // Group warehouse employees by Tenant/Organization
  const groupedWarehouseEmployees = useMemo(() => {
    const map = new Map<string, { tenantName: string; tenantId: string; items: AdminUserItem[] }>();
    for (const emp of filteredWarehouseEmployees) {
      const key = emp.tenantId || "system";
      const tenantName = emp.tenant?.name || "System Level / Global";
      const current = map.get(key) ?? { tenantName, tenantId: key, items: [] };
      current.items.push(emp);
      map.set(key, current);
    }
    return Array.from(map.values());
  }, [filteredWarehouseEmployees]);

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.companyName.toLowerCase().includes(q) ||
        Boolean(c.contactPerson?.toLowerCase().includes(q)) ||
        Boolean(c.mobile?.includes(q)) ||
        (c.gstNumber ?? "").toLowerCase().includes(q) ||
        (c.tenant?.name ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
      const matchesTenant = tenantFilter === "ALL" || c.tenant?.id === tenantFilter;
      return matchesSearch && matchesStatus && matchesTenant;
    });
  }, [clients, searchQuery, statusFilter, tenantFilter]);

  // Grouped Client Companies
  const groupedClientCompanies = useMemo(() => {
    const map = new Map<string, AdminClientItem[]>();
    for (const client of filteredClients) {
      const key = client.companyName.trim() || "Unnamed Client";
      const current = map.get(key) ?? [];
      current.push(client);
      map.set(key, current);
    }
    return Array.from(map.entries()).map(([companyName, items]) => ({ companyName, items }));
  }, [filteredClients]);

  // Unique Company Names for employee adding
  const uniqueCompanyNames = useMemo(() => {
    return Array.from(new Set(clients.map((c) => c.companyName.trim()).filter(Boolean)));
  }, [clients]);

  // Effective Tenant Context for Corporate Groups
  const effectiveGroupTenantId = role === "PLATFORM_ADMIN" ? groupTenantId : (user?.tenantId || "");

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase();
    // For PLATFORM_ADMIN: if no tenant selected, return empty list
    if (role === "PLATFORM_ADMIN" && !groupTenantId) {
      return [];
    }

    return companyGroups.filter((g) => {
      const distinctCompanyNames = Array.from(new Set(g.clients.map((c) => c.companyName))).join(" ").toLowerCase();
      const matchesSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        distinctCompanyNames.includes(q) ||
        Boolean(g.tenant?.name?.toLowerCase().includes(q));
      const matchesTenant = effectiveGroupTenantId ? g.tenantId === effectiveGroupTenantId : true;
      return matchesSearch && matchesTenant;
    });
  }, [companyGroups, searchQuery, role, groupTenantId, effectiveGroupTenantId]);

  // Clients matching the currently selected attach group's tenant
  const matchingAttachClients = useMemo(() => {
    const targetGroup = companyGroups.find((g) => g.id === selectedAttachGroupId);
    if (!targetGroup) return [];
    return clients.filter((c) => c.tenantId === targetGroup.tenantId);
  }, [companyGroups, selectedAttachGroupId, clients]);

  /**
   * Groups a corporate group's flat Client[] (which may contain multiple employee rows
   * per company) into distinct companies, each with their employee list.
   * This correctly implements: Corporate Group → Companies → Employees
   */
  const groupGroupClients = (clients: AdminClientItem[]) => {
    return clients.map((c) => ({
      companyName: c.companyName.trim() || "Unnamed Company",
      companyId: c.id,
      employees:
        c.employees && c.employees.length > 0
          ? c.employees
          : c.contactPerson
          ? [
              {
                id: c.id,
                contactPerson: c.contactPerson,
                employeeRole: c.employeeRole,
                mobile: c.mobile,
                email: c.email
              } as any
            ]
          : []
    }));
  };

  // Handlers
  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAdminWarehouse(warehouseForm);
      setShowAddWarehouse(false);
      setWarehouseForm({ name: "", code: "", address: "", tenantId: user?.tenantId || (tenants.length === 1 ? tenants[0]?.id : "") || "" });
      setActionMessage({ type: "success", text: "Warehouse created successfully!" });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create warehouse." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePlatformAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platformAdminForm.email.trim()) {
      setActionMessage({ type: "error", text: "Email is required." });
      return;
    }
    if (!platformAdminForm.password) {
      setActionMessage({ type: "error", text: "Password is required." });
      return;
    }
    if (platformAdminForm.password.length < 8) {
      setActionMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }

    setSubmitting(true);
    try {
      const result = await createEmployeeWithAuth({
        name: platformAdminForm.name.trim(),
        email: platformAdminForm.email.trim(),
        password: platformAdminForm.password,
        mobile: platformAdminForm.mobile.trim() || undefined,
        role: "PLATFORM_ADMIN",
        tenantId: platformAdminForm.tenantId || undefined,
      });

      if (!result.success) {
        setActionMessage({ type: "error", text: result.error || "Failed to create platform admin." });
        return;
      }

      setShowAddPlatformAdmin(false);
      setPlatformAdminForm({ name: "", email: "", password: "", mobile: "", tenantId: user?.tenantId || (tenants.length === 1 ? tenants[0]?.id : "") || "" });
      setShowPlatformAdminPassword(false);
      setActionMessage({ type: "success", text: "Platform Admin created successfully with Supabase Auth credentials!" });
      await loadData();
      await refreshUsers();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create platform admin." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAdminClient({
        ...clientForm,
        employeeRole: "MANAGER"
      });
      setShowAddClient(false);
      setClientForm({
        companyName: "",
        contactPerson: "",
        mobile: "",
        email: "",
        gstNumber: "",
        billingAddress: "",
        shippingAddress: "",
        tenantId: user?.tenantId || (tenants.length === 1 ? tenants[0]?.id : "") || ""
      });
      setActionMessage({ type: "success", text: "Client company created successfully!" });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create client." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeForm.email.trim()) {
      setActionMessage({ type: "error", text: "Email is required for employee login." });
      return;
    }
    if (!employeeForm.password) {
      setActionMessage({ type: "error", text: "Password is required for employee login." });
      return;
    }
    if (employeeForm.password.length < 8) {
      setActionMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (!employeeForm.mobile.trim()) {
      setActionMessage({ type: "error", text: "Mobile number is required for employee account." });
      return;
    }
    if (!employeeForm.clientId) {
      setActionMessage({ type: "error", text: "Client company is required." });
      return;
    }

    const targetCompany = clients.find((c) => c.id === employeeForm.clientId);

    if (!targetCompany) {
      setActionMessage({ type: "error", text: "Selected client company does not exist. Please select an existing company." });
      return;
    }

    const targetTenantId = targetCompany.tenantId;
    if (!targetTenantId) {
      setActionMessage({ type: "error", text: "Selected company does not have an assigned tenant." });
      return;
    }

    setSubmitting(true);
    try {
      console.log("[ClientEmployee] create started with Auth", {
        companyName: employeeForm.companyName,
        contactPerson: employeeForm.contactPerson,
        email: employeeForm.email,
        employeeRole: employeeForm.employeeRole,
        tenantId: targetTenantId,
        clientId: targetCompany.id
      });

      const result = await createEmployeeWithAuth({
        name: employeeForm.contactPerson.trim(),
        email: employeeForm.email.trim(),
        password: employeeForm.password,
        mobile: employeeForm.mobile.trim(),
        role: "CLIENT",
        clientEmployeeRole: employeeForm.employeeRole,
        clientId: targetCompany.id,
        companyName: targetCompany.companyName.trim(),
        tenantId: targetTenantId,
      });

      if (!result.success) {
        setActionMessage({ type: "error", text: result.error || "Failed to add employee." });
        return;
      }

      console.log("[ClientEmployee] create result", result);

      setShowAddEmployee(false);
      setEmployeeForm({
        clientId: "",
        companyName: "",
        contactPerson: "",
        mobile: "",
        email: "",
        password: "",
        employeeRole: "RECEIVER",
        tenantId: user?.tenantId || (tenants.length === 1 ? tenants[0]?.id : "") || ""
      });
      setShowEmployeePassword(false);
      setActionMessage({ type: "success", text: "Employee added successfully! Supabase Auth login account active with CLIENT role." });
      await loadData();
      await refreshUsers();
      console.log("[ClientEmployee] refresh completed");
    } catch (err: any) {
      console.error("[ClientEmployee] create failed:", err);
      setActionMessage({ type: "error", text: err.message || "Failed to add employee." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTenantId = role === "PLATFORM_ADMIN" ? groupTenantId : (user?.tenantId || groupForm.tenantId);
    if (!targetTenantId) {
      setActionMessage({ type: "error", text: "Please select an organization before creating a Corporate Group." });
      return;
    }
    if (!groupForm.name.trim()) {
      setActionMessage({ type: "error", text: "Group name is required." });
      return;
    }
    setSubmitting(true);
    try {
      await createAdminCompanyGroup({
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || undefined,
        tenantId: targetTenantId
      });
      setGroupForm({
        name: "",
        description: "",
        tenantId: targetTenantId
      });
      setActionMessage({ type: "success", text: "Corporate group created successfully!" });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create corporate group." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttachClientId || !selectedAttachGroupId) {
      setActionMessage({ type: "error", text: "Please select both a Corporate Group and a Client Company." });
      return;
    }
    const targetGroup = companyGroups.find((g) => g.id === selectedAttachGroupId);
    const targetClient = clients.find((c) => c.id === selectedAttachClientId);
    if (!targetGroup || !targetClient) {
      setActionMessage({ type: "error", text: "Invalid Corporate Group or Client Company selection." });
      return;
    }
    if (targetClient.tenantId !== targetGroup.tenantId) {
      setActionMessage({
        type: "error",
        text: `Tenant mismatch: "${targetClient.companyName}" (${targetClient.tenant?.name || targetClient.tenantId}) does not match Corporate Group "${targetGroup.name}" (${targetGroup.tenant?.name || targetGroup.tenantId}). They must belong to the same organization.`
      });
      return;
    }
    setSubmitting(true);
    try {
      await assignClientCompanyGroup(selectedAttachClientId, selectedAttachGroupId);
      setShowAttachCompany(false);
      setSelectedAttachClientId("");
      setSelectedAttachGroupId("");
      setActionMessage({ type: "success", text: "Client company attached to Corporate Group successfully!" });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to attach company to group." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetachCompany = async (clientId: string, companyName: string) => {
    if (!window.confirm(`Are you sure you want to remove "${companyName}" from this corporate group?`)) return;
    setSubmitting(true);
    try {
      await assignClientCompanyGroup(clientId, null);
      setActionMessage({ type: "success", text: `"${companyName}" removed from corporate group.` });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to remove company from group." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantForm.name.trim()) return;
    setSubmitting(true);
    try {
      await createAdminTenant(tenantForm);
      const createdName = tenantForm.name;
      setTenantForm({ name: "", slug: "", gstNumber: "", email: "", phone: "", address: "" });
      setShowAddTenant(false);
      setActionMessage({ type: "success", text: `Organization "${createdName}" created successfully!` });
      await loadData();
    } catch (err: any) {
      console.error("Failed to create tenant:", err);
      setActionMessage({ type: "error", text: err.message || "Failed to create organization." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const record = editingWarehouse || editingUser || editingClient || editingTenant;
    if (!record) return;
    setSubmitting(true);
    try {
      if (editingWarehouse) await updateAdminWarehouse(editingWarehouse.id, editForm);
      if (editingUser) {
        // Use updateAdminUserWithRoleAudit for role transitions, otherwise simple update
        if (editForm.role && editForm.role !== editingUser.role) {
          await updateAdminUserWithRoleAudit({
            userId: editingUser.id,
            name: editForm.name,
            email: editForm.email,
            mobile: editForm.mobile,
            status: editForm.status,
            role: editForm.role as Role,
            previousRole: editingUser.role,
            clientId: editingUser.clientEmployee?.clientId || editingUser.client?.id || undefined,
            employeeRole: editForm.employeeRole as ClientEmployeeRole | undefined,
            previousEmployeeRole: editingUser.clientEmployee?.employeeRole || editingUser.client?.employeeRole || undefined,
            targetUserTenantId: editingUser.tenantId || undefined,
            actorUserId: user?.id || null,
            actorUserRole: role,
          });
        } else {
          await updateAdminUser(editingUser.id, editForm, user?.id, role);
        }
      }
      if (editingClient) {
        await updateAdminClient(editingClient.id, {
          ...editForm,
          companyGroupId: editForm.companyGroupId || null,
        });
      }
      if (editingTenant) await updateAdminTenant(editingTenant.id, editForm);
      setEditingWarehouse(null);
      setEditingUser(null);
      setEditingClient(null);
      setEditingTenant(null);
      setActionMessage({ type: "success", text: "Record updated successfully." });
      await loadData();
      await refreshUsers();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update record." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateClientEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClientEmployee) return;
    setSubmitting(true);
    try {
      await updateClientEmployeeSecure({
        clientEmployeeId: editingClientEmployee.id,
        newClientId: editingClientEmployee.clientId,
        contactPerson: editingClientEmployee.contactPerson.trim(),
        mobile: editingClientEmployee.mobile.trim(),
        email: editingClientEmployee.email.trim(),
        newEmployeeRole: editingClientEmployee.employeeRole,
        newStatus: editingClientEmployee.status
      });
      setActionMessage({ type: "success", text: `Client employee "${editingClientEmployee.contactPerson}" updated successfully.` });
      setEditingClientEmployee(null);
      await loadData();
      await refreshUsers();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update client employee." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleClientEmployeeStatus = async (emp: any) => {
    const nextStatus: UserStatus = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const confirmMsg = emp.status === "ACTIVE"
      ? `Deactivate client employee "${emp.contactPerson}"? Linked login sessions will be blocked immediately.`
      : `Reactivate client employee "${emp.contactPerson}"?`;
    if (!window.confirm(confirmMsg)) return;

    setSubmitting(true);
    try {
      await updateClientEmployeeSecure({
        clientEmployeeId: emp.id,
        newStatus: nextStatus
      });
      setActionMessage({ type: "success", text: `Employee "${emp.contactPerson}" is now ${nextStatus}.` });
      await loadData();
      await refreshUsers();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update status." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendResetEmail = async (email?: string | null, name: string = "User") => {
    if (!email) {
      setActionMessage({ type: "error", text: `Cannot send reset email: ${name} does not have an email registered.` });
      return;
    }
    if (!window.confirm(`Send password reset email to ${email} for ${name}?`)) return;

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(email);
      setActionMessage({ type: "success", text: `Password reset email sent to ${email}.` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to send reset email." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner message="Loading Admin Console records..." />
      </div>
    );
  }

  const roleBadgeColor = (r: string) => {
    switch (r) {
      case "PLATFORM_ADMIN":
        return "bg-rose-950/80 text-rose-300 border-rose-800";
      case "WAREHOUSE_OWNER":
        return "bg-indigo-950/80 text-indigo-300 border-indigo-800";
      case "WAREHOUSE_MODERATOR":
        return "bg-sky-950/80 text-sky-300 border-sky-800";
      case "WAREHOUSE_STAFF":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
      case "ACCOUNTANT":
      case "ACCOUNTS_TEAM":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      case "GM":
      case "MD":
        return "bg-purple-950/80 text-purple-300 border-purple-800";
      case "RECEIVER":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-xs font-medium ${
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

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Admin Console
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-800">
              System Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Manage multi-tenant warehouses, facility locations, client organizations, and system users.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={refreshing}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {activeTab === "warehouses" && (
            <Button size="sm" onClick={() => setShowAddWarehouse(true)} className="flex items-center gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add Warehouse
            </Button>
          )}
          {activeTab === "admins" && (
            <Button size="sm" onClick={() => setShowAddPlatformAdmin(true)} className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white">
              <Plus className="w-3.5 h-3.5" /> Add Platform Admin
            </Button>
          )}
          {activeTab === "warehouse_employees" && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedWarehouseTenantId(user?.tenantId || (tenants.length === 1 ? tenants[0]?.id : "") || "");
                setShowAddWarehouseEmployee(true);
              }}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus className="w-3.5 h-3.5" /> Add Warehouse Employee
            </Button>
          )}
          {activeTab === "clients" && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowAddClient(true)} className="flex items-center gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Client Company
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddEmployee(true)} className="flex items-center gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Client Employee
              </Button>
            </div>
          )}
          {activeTab === "tenants" && (
            <Button size="sm" onClick={() => setShowAddTenant(true)} className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white">
              <Plus className="w-3.5 h-3.5" /> Add Organization
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddTenant(true)}
            className="hidden sm:flex items-center gap-1.5 text-xs text-purple-300 border-purple-800/60 hover:bg-purple-950/40 hover:text-white"
          >
            <Plus className="w-3.5 h-3.5" /> Organization
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card
          onClick={() => setActiveTab("warehouses")}
          className="p-3.5 flex items-center gap-3.5 bg-slate-900/60 border-slate-800 cursor-pointer hover:border-slate-700 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-950/60 border border-teal-800/60 flex items-center justify-center text-teal-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 truncate">Warehouses</p>
            <p className="text-xl font-bold text-white mt-0.5">{warehouses.length}</p>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab("admins")}
          className="p-3.5 flex items-center gap-3.5 bg-slate-900/60 border-slate-800 cursor-pointer hover:border-indigo-600/50 hover:bg-slate-900/80 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 truncate">Platform Admins</p>
            <p className="text-xl font-bold text-white mt-0.5">{platformAdmins.length}</p>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab("warehouse_employees")}
          className="p-3.5 flex items-center gap-3.5 bg-slate-900/60 border-slate-800 cursor-pointer hover:border-blue-600/50 hover:bg-slate-900/80 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/60 flex items-center justify-center text-blue-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 truncate">Warehouse Staff</p>
            <p className="text-xl font-bold text-white mt-0.5">{warehouseEmployees.length}</p>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab("clients")}
          className="p-3.5 flex items-center gap-3.5 bg-slate-900/60 border-slate-800 cursor-pointer hover:border-amber-600/50 hover:bg-slate-900/80 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 truncate">Client Companies</p>
            <p className="text-xl font-bold text-white mt-0.5">{uniqueCompanyNames.length}</p>
            <span className="text-[10px] text-slate-400 block truncate">{clients.length} employee accounts</span>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab("groups")}
          className="p-3.5 flex items-center gap-3.5 bg-slate-900/60 border-slate-800 cursor-pointer hover:border-rose-600/50 hover:bg-slate-900/80 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 truncate">Corp Groups</p>
            <p className="text-xl font-bold text-white mt-0.5">{companyGroups.length}</p>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab("tenants")}
          className="p-3.5 flex items-center gap-3.5 bg-slate-900/60 border-slate-800 cursor-pointer hover:border-purple-600/50 hover:bg-slate-900/80 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 group-hover:text-purple-300 transition-colors truncate">Organizations</p>
            <p className="text-xl font-bold text-white mt-0.5">{tenants.length}</p>
          </div>
        </Card>
      </div>

      {/* Tabs Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("warehouses")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === "warehouses"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Warehouses ({warehouses.length})
        </button>

        <button
          onClick={() => setActiveTab("admins")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === "admins"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Platform Admins ({platformAdmins.length})
        </button>

        <button
          onClick={() => setActiveTab("warehouse_employees")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === "warehouse_employees"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Warehouse Employees ({warehouseEmployees.length})
        </button>

        <button
          onClick={() => setActiveTab("clients")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === "clients"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          Client Companies ({uniqueCompanyNames.length})
        </button>

        <button
          onClick={() => setActiveTab("groups")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === "groups"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Corporate Groups ({companyGroups.length})
        </button>

        <button
          onClick={() => setActiveTab("tenants")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === "tenants"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Organizations ({tenants.length})
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <Card className="p-3 bg-slate-900/60 border-slate-800">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "warehouses"
                  ? "Search warehouses by name, code, address, organization..."
                  : activeTab === "admins"
                  ? "Search platform admins by name, email, phone..."
                  : activeTab === "warehouse_employees"
                  ? "Search warehouse employees by name, email, role, organization..."
                  : activeTab === "groups"
                  ? "Search groups by name, company, or contact..."
                  : activeTab === "tenants"
                  ? "Search organizations by name, slug, email..."
                  : "Search client companies by name, contact, mobile, GSTIN..."
              }
              className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {activeTab !== "admins" && (
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                className="bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Organizations</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}

            {activeTab === "warehouse_employees" && (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Warehouse Roles</option>
                <option value="WAREHOUSE_STAFF">Warehouse Staff</option>
                <option value="WAREHOUSE_MODERATOR">Warehouse Moderator</option>
                <option value="WAREHOUSE_OWNER">Warehouse Owner</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="ACCOUNTS_TEAM">Accounts Team</option>
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>
        </div>
      </Card>

      {/* TAB 1: WAREHOUSES */}
      {activeTab === "warehouses" && (
        <Card className="overflow-hidden border-slate-800 bg-slate-900/60">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white">System Warehouses</h3>
            <span className="text-xs text-slate-400">{filteredWarehouses.length} facilities</span>
          </div>

          {filteredWarehouses.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Building2 className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">No warehouses found</p>
              <p className="text-xs text-slate-400">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Warehouse & Code</th>
                    <th className="px-4 py-3">Tenant Organization</th>
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3 text-center">Bin Locations</th>
                    <th className="px-4 py-3 text-center">Stock Items</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredWarehouses.map((wh) => (
                    <tr key={wh.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{wh.name}</div>
                        <div className="font-mono text-[11px] text-indigo-400">Code: {wh.code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 border border-slate-700 text-slate-300">
                          {wh.tenant?.name || "Global"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-xs truncate">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{wh.address}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-medium text-slate-300">
                        {wh.locationsCount}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">
                        {wh.inventoryCount}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={wh.status === "ACTIVE" ? "success" : "default"}>
                          {wh.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {new Date(wh.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingWarehouse(wh);
                              setEditForm({ name: wh.name, code: wh.code, address: wh.address, status: wh.status, tenantId: wh.tenantId });
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-300 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete warehouse "${wh.name}"?`)) return;
                              try {
                                await deleteAdminWarehouse(wh.id);
                                setActionMessage({ type: "success", text: `Warehouse "${wh.name}" deleted.` });
                                await loadData();
                              } catch (err: any) {
                                setActionMessage({ type: "error", text: err.message });
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: PLATFORM ADMINS */}
      {activeTab === "admins" && (
        <Card className="overflow-hidden border-slate-800 bg-slate-900/60">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Platform Administrators
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Full-access system administrators with global platform oversight.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {filteredPlatformAdmins.length} {filteredPlatformAdmins.length === 1 ? "account" : "accounts"}
            </span>
          </div>

          {filteredPlatformAdmins.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <ShieldCheck className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">No platform admins found</p>
              <p className="text-xs text-slate-400">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPlatformAdmins.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-950/80 border border-indigo-700/80 flex items-center justify-center font-bold text-[11px] text-indigo-300">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{u.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {u.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5 text-[11px]">
                          {u.email && (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span>{u.email}</span>
                            </div>
                          )}
                          {u.mobile && (
                            <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{u.mobile}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${roleBadgeColor(
                            u.role
                          )}`}
                        >
                          PLATFORM ADMIN
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.status === "ACTIVE" ? "success" : "default"}>
                          {u.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setEditForm({
                                name: u.name,
                                email: u.email || "",
                                mobile: u.mobile || "",
                                role: u.role,
                                status: u.status,
                                tenantId: u.tenantId || ""
                              });
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-300"
                            title="Edit platform admin"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {u.email && (
                            <button
                              onClick={() => handleSendResetEmail(u.email, u.name)}
                              className="p-1.5 rounded-lg hover:bg-amber-950/60 text-slate-400 hover:text-amber-400 transition-colors"
                              title="Send password reset email"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: WAREHOUSE EMPLOYEES */}
      {activeTab === "warehouse_employees" && (
        <div className="space-y-4">
          {groupedWarehouseEmployees.length === 0 ? (
            <Card className="p-12 text-center text-slate-500 bg-slate-900/60 border-slate-800">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">No warehouse employees found</p>
              <p className="text-xs text-slate-400">Try adjusting your search criteria or role filters</p>
            </Card>
          ) : (
            groupedWarehouseEmployees.map(({ tenantName, tenantId, items }) => (
              <Card
                key={tenantId}
                className="overflow-hidden border-slate-800 bg-slate-900/60 shadow-lg"
              >
                <div className="p-4 bg-slate-800/50 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-800/80 flex items-center justify-center text-blue-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">{tenantName}</h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span>{items.length} employee account{items.length === 1 ? "" : "s"}</span>
                        <span>• Warehouse Operations & Facility Staff</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedWarehouseTenantId(tenantId === "system" ? (user?.tenantId || (tenants.length === 1 ? tenants[0]?.id : "") || "") : tenantId);
                      setShowAddWarehouseEmployee(true);
                    }}
                    className="text-xs flex items-center gap-1 self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Warehouse Employee
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/30 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">Employee</th>
                        <th className="px-4 py-2.5">Role</th>
                        <th className="px-4 py-2.5">Mobile</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5">Warehouse / Company</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Joined</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {items.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-white flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-blue-400 shrink-0">
                              {emp.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span>{emp.name}</span>
                              <span className="block text-[10px] text-slate-400 font-mono">ID: {emp.id.slice(0, 8)}...</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${roleBadgeColor(
                                emp.role
                              )}`}
                            >
                              {emp.role.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-300">
                            {emp.mobile || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">
                            {emp.email || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-slate-400">
                            {emp.tenant?.name || "System Level"}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant={emp.status === "ACTIVE" ? "success" : "default"}>
                              {emp.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                            {new Date(emp.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingUser(emp);
                                  setEditForm({
                                    name: emp.name,
                                    email: emp.email || "",
                                    mobile: emp.mobile || "",
                                    role: emp.role,
                                    status: emp.status,
                                    tenantId: emp.tenantId || ""
                                  });
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-300"
                                title="Edit warehouse employee"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {emp.email && (
                                <button
                                  onClick={() => handleSendResetEmail(emp.email, emp.name)}
                                  className="p-1.5 rounded-lg hover:bg-amber-950/60 text-slate-400 hover:text-amber-400 transition-colors"
                                  title="Send password reset email"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 3: CLIENT COMPANIES */}
      {activeTab === "clients" && (
        <div className="space-y-4">
          {groupedClientCompanies.length === 0 ? (
            <Card className="p-12 text-center text-slate-500 bg-slate-900/60 border-slate-800">
              <Store className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">No client companies found</p>
              <p className="text-xs text-slate-400">Try adjusting your search criteria</p>
            </Card>
          ) : (
            groupedClientCompanies.map(({ companyName, items }) => {
              const allEmployees: any[] = items.flatMap((i) =>
                (i.employees && i.employees.length > 0
                  ? (i.employees as any[])
                  : [
                      {
                        id: i.id,
                        contactPerson: i.contactPerson,
                        employeeRole: i.employeeRole || "RECEIVER",
                        mobile: i.mobile,
                        email: i.email,
                        shippingAddress: i.shippingAddress,
                        status: i.status
                      }
                    ])
              );
              const totalOrders = items.reduce((sum, item) => sum + item.orders.length, 0);
              const primaryGst = items.find((i) => i.gstNumber)?.gstNumber;

              return (
                <Card
                  key={companyName}
                  className="overflow-hidden border-slate-800 bg-slate-900/60 shadow-lg"
                >
                  <div className="p-4 bg-slate-800/50 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-950/80 border border-teal-800/80 flex items-center justify-center text-teal-400">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white">{companyName}</h4>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
                          {primaryGst && (
                            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-teal-300">
                              GSTIN: {primaryGst}
                            </span>
                          )}
                          <span>{allEmployees.length} employee account(s)</span>
                          <span>• {totalOrders} total orders</span>
                          <span>• Tenant: {items[0]?.tenant?.name || "Global"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const targetClient = items[0];
                          setEditingClient(targetClient);
                          setEditForm({
                            companyName: targetClient?.companyName || companyName,
                            gstNumber: targetClient?.gstNumber || "",
                            billingAddress: targetClient?.billingAddress || "",
                            shippingAddress: targetClient?.shippingAddress || "",
                            companyGroupId: targetClient?.companyGroupId || "",
                            status: targetClient?.status || "ACTIVE"
                          });
                        }}
                        className="text-xs flex items-center gap-1"
                        title="Edit company profile, GSTIN, or group affiliation"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit Company
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const targetClient = items[0];
                          setEmployeeForm((prev) => ({
                            ...prev,
                            clientId: targetClient?.id || "",
                            companyName: companyName,
                            tenantId: targetClient?.tenantId || prev.tenantId
                          }));
                          setShowAddEmployee(true);
                        }}
                        className="text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Employee
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/30 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5">Contact Person</th>
                          <th className="px-4 py-2.5">Employee Role</th>
                          <th className="px-4 py-2.5">Mobile</th>
                          <th className="px-4 py-2.5">Email</th>
                          <th className="px-4 py-2.5">Shipping / Store Address</th>
                          <th className="px-4 py-2.5 text-center">Orders</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {allEmployees.map((emp: any) => (
                          <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-white flex items-center gap-2">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              {emp.contactPerson}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${roleBadgeColor(
                                  emp.employeeRole || "CLIENT"
                                )}`}
                              >
                                {emp.employeeRole || "CLIENT"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-300">{emp.mobile}</td>
                            <td className="px-4 py-2.5 text-slate-400">{emp.email || "—"}</td>
                            <td className="px-4 py-2.5 text-slate-300 max-w-xs truncate">
                              {emp.shippingAddress || items[0]?.shippingAddress || items[0]?.billingAddress}
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold text-white">
                              {items[0]?.orders?.length || 0}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant={emp.status === "ACTIVE" ? "success" : "default"}>
                                {emp.status || "ACTIVE"}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingClientEmployee({
                                      id: emp.id,
                                      clientId: emp.clientId || items[0]?.id || "",
                                      tenantId: items[0]?.tenantId || items[0]?.tenant?.id,
                                      contactPerson: emp.contactPerson,
                                      mobile: emp.mobile,
                                      email: emp.email || "",
                                      employeeRole: emp.employeeRole || "RECEIVER",
                                      status: emp.status || "ACTIVE"
                                    });
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-300"
                                  title="Edit client employee"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {emp.email && (
                                  <button
                                    onClick={() => handleSendResetEmail(emp.email, emp.contactPerson)}
                                    className="p-1.5 rounded-lg hover:bg-amber-950/60 text-slate-400 hover:text-amber-400 transition-colors"
                                    title="Send password reset email"
                                  >
                                    <Key className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleToggleClientEmployeeStatus(emp)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
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
      )}

      {/* TAB 4: CORPORATE GROUPS */}
      {activeTab === "groups" && (
        <div className="space-y-6">
          {/* Explicit Tenant Context Selector for PLATFORM_ADMIN */}
          {role === "PLATFORM_ADMIN" && (
            <Card className="p-4 bg-slate-900/80 border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-indigo-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Corporate Group Tenant Context</h3>
                  <p className="text-xs text-slate-400">
                    Select an organization to manage its corporate groups, create new groups, or attach client companies
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-300 whitespace-nowrap">Tenant:</label>
                <select
                  value={groupTenantId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGroupTenantId(val);
                    setGroupForm((prev) => ({ ...prev, tenantId: val }));
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[220px]"
                >
                  <option value="">[ Select Tenant ▼ ]</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          )}

          {/* If PLATFORM_ADMIN has not selected a tenant, show prompt */}
          {role === "PLATFORM_ADMIN" && !effectiveGroupTenantId ? (
            <Card className="p-12 text-center text-slate-500 bg-slate-900/60 border-slate-800">
              <Layers className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-300">Please select a Tenant</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Select an organization from the Tenant dropdown above to view, create, and manage its corporate groups and client company assignments.
              </p>
            </Card>
          ) : (
            <>
              {/* Create Group Form Card */}
              <Card className="p-5 bg-slate-900/60 border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-400" />
                  Create New Corporate Group
                </h3>
                <form onSubmit={handleCreateGroup} className="grid gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Organization (Context)
                    </label>
                    <div className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-indigo-300 font-medium flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                      {tenants.find((t) => t.id === effectiveGroupTenantId)?.name || effectiveGroupTenantId}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Group Name
                    </label>
                    <input
                      type="text"
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      placeholder="e.g. Apex Retail Holding"
                      required
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={groupForm.description}
                      onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                      placeholder="Corporate conglomerate group"
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <Button type="submit" isLoading={submitting} className="text-xs">
                    Create Group
                  </Button>
                </form>
              </Card>

              {/* List of Corporate Groups */}
              {filteredGroups.length === 0 ? (
                <Card className="p-12 text-center text-slate-500 bg-slate-900/60 border-slate-800">
                  <Layers className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="text-sm font-medium">No corporate groups found for this organization</p>
                  <p className="text-xs text-slate-400">Create a group above to get started</p>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredGroups.map((g) => {
                    const companiesInGroup = groupGroupClients(g.clients);
                    return (
                      <Card key={g.id} className="p-5 border-slate-800 bg-slate-900/60">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base text-white">{g.name}</h4>
                              {g.tenant && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/80">
                                  <Briefcase className="w-2.5 h-2.5" />
                                  {g.tenant.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                              {companiesInGroup.length} {companiesInGroup.length === 1 ? "company" : "companies"}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedAttachGroupId(g.id);
                                setSelectedAttachClientId("");
                                setShowAttachCompany(true);
                              }}
                              className="text-[11px] h-7 px-2.5 flex items-center gap-1 border-indigo-700/60 text-indigo-300 hover:bg-indigo-950/60"
                            >
                              <Plus className="w-3 h-3" /> Attach Company
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mb-4">{g.description || "No description provided."}</p>

                        <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                          <p className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-indigo-400" />
                            Associated Companies
                          </p>
                          {companiesInGroup.length === 0 ? (
                            <p className="text-xs text-slate-500">No companies attached yet.</p>
                          ) : (
                            <div className="space-y-2 max-h-52 overflow-y-auto">
                              {companiesInGroup.map(({ companyName, companyId, employees }) => {
                                const hasGst = employees.find((e) => e.gstNumber)?.gstNumber;
                                return (
                                  <div
                                    key={companyId || companyName}
                                    className="px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700/60"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-sm text-white">{companyName}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400">
                                          {employees.length} {employees.length === 1 ? "employee" : "employees"}
                                        </span>
                                        {companyId && (
                                          <button
                                            onClick={() => handleDetachCompany(companyId, companyName)}
                                            className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-950/40 border border-red-800/60 hover:bg-red-900/50 transition-colors"
                                            title="Remove company from corporate group"
                                          >
                                            Detach
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {hasGst && (
                                      <span className="text-[10px] font-mono text-teal-400 mt-0.5 block">
                                        GSTIN: {hasGst}
                                      </span>
                                    )}
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {employees.slice(0, 4).map((emp) => (
                                        <span
                                          key={emp.id}
                                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300"
                                        >
                                          <UserCheck className="w-2.5 h-2.5 text-slate-500" />
                                          {emp.contactPerson}
                                          {emp.employeeRole && (
                                            <span className="text-slate-500 font-mono">· {emp.employeeRole}</span>
                                          )}
                                        </span>
                                      ))}
                                      {employees.length > 4 && (
                                        <span className="text-[10px] text-slate-500 italic">
                                          +{employees.length - 4} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 5: ORGANIZATIONS / TENANTS */}
      {activeTab === "tenants" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-white">All Tenant Organizations</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-tenant organizations host warehouses, staff accounts, products, and clients.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddTenant(true)}
              className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-950/50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Organization
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((t) => (
              <Card key={t.id} className="p-5 bg-slate-900/60 border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">{t.name}</h4>
                      <p className="text-[11px] font-mono text-purple-400 mt-0.5">slug: {t.slug}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                        {t.status}
                      </span>
                      <button
                        onClick={() => {
                          setEditingTenant(t);
                          setEditForm({ name: t.name, slug: t.slug, status: t.status });
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-300"
                        title="Edit organization"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <p className="text-[10px] text-slate-400">Warehouses</p>
                      <p className="text-sm font-bold text-white mt-0.5">{t.warehousesCount}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <p className="text-[10px] text-slate-400">Users</p>
                      <p className="text-sm font-bold text-white mt-0.5">{t.usersCount}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <p className="text-[10px] text-slate-400">Clients</p>
                      <p className="text-sm font-bold text-white mt-0.5">{t.clientsCount}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono text-[10px] truncate max-w-[160px]">ID: {t.id}</span>
                  <button
                    onClick={() => {
                      setTenantFilter(t.id);
                      setActiveTab("warehouses");
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    View Warehouses →
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ADD TENANT / ORGANIZATION */}
      <Modal
        isOpen={showAddTenant}
        onClose={() => setShowAddTenant(false)}
        title="Add New Organization / Tenant"
        description="Create an organization to isolate warehouses, staff, and inventory data."
      >
        <form onSubmit={handleCreateTenant} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Organization Name *
            </label>
            <input
              type="text"
              value={tenantForm.name}
              onChange={(e) => {
                const name = e.target.value;
                const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                setTenantForm({
                  ...tenantForm,
                  name,
                  slug: !tenantForm.slug || tenantForm.slug === autoSlug.slice(0, -1) ? autoSlug : tenantForm.slug
                });
              }}
              placeholder="e.g. Apex Logistics Global"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Organization Slug / Identifier *
            </label>
            <input
              type="text"
              value={tenantForm.slug}
              onChange={(e) => setTenantForm({ ...tenantForm, slug: e.target.value })}
              placeholder="e.g. apex-logistics-global"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Unique URL/system identifier for this tenant.</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                GST / Tax Number
              </label>
              <input
                type="text"
                value={tenantForm.gstNumber}
                onChange={(e) => setTenantForm({ ...tenantForm, gstNumber: e.target.value })}
                placeholder="29ABCDE1234F1Z5"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Official Email
              </label>
              <input
                type="email"
                value={tenantForm.email}
                onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                placeholder="ops@apex.test"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={tenantForm.phone}
                onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Address
              </label>
              <input
                type="text"
                value={tenantForm.address}
                onChange={(e) => setTenantForm({ ...tenantForm, address: e.target.value })}
                placeholder="City, State"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddTenant(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={submitting}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              Create Organization
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD WAREHOUSE */}
      <Modal
        isOpen={showAddWarehouse}
        onClose={() => setShowAddWarehouse(false)}
        title="Add New Warehouse Facility"
      >
        <form onSubmit={handleCreateWarehouse} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Organization / Tenant *
            </label>
            <select
              value={warehouseForm.tenantId}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, tenantId: e.target.value })}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {tenants.length === 0 && (
                <option value="" disabled>No organizations found</option>
              )}
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Warehouse Name *
            </label>
            <input
              type="text"
              value={warehouseForm.name}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
              placeholder="e.g. Apex Central Hub"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Warehouse Code *
            </label>
            <input
              type="text"
              value={warehouseForm.code}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
              placeholder="e.g. WH-HUB-01"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Facility Address *
            </label>
            <textarea
              value={warehouseForm.address}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
              placeholder="Full warehouse postal address"
              rows={3}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddWarehouse(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={submitting}>
              Create Warehouse
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD PLATFORM ADMIN */}
      <Modal
        isOpen={showAddPlatformAdmin}
        onClose={() => setShowAddPlatformAdmin(false)}
        title="Add Platform Admin"
      >
        <form onSubmit={handleCreatePlatformAdmin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={platformAdminForm.name}
              onChange={(e) => setPlatformAdminForm({ ...platformAdminForm, name: e.target.value })}
              placeholder="e.g. Sarah Connor"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={platformAdminForm.email}
              onChange={(e) => setPlatformAdminForm({ ...platformAdminForm, email: e.target.value })}
              placeholder="admin@example.test"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPlatformAdminPassword ? "text" : "password"}
                value={platformAdminForm.password}
                onChange={(e) => setPlatformAdminForm({ ...platformAdminForm, password: e.target.value })}
                placeholder="Minimum 8 characters"
                minLength={8}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPlatformAdminPassword(!showPlatformAdminPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPlatformAdminPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Securely stored in Supabase Auth only. Never saved in the WMS database.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              value={platformAdminForm.mobile}
              onChange={(e) => setPlatformAdminForm({ ...platformAdminForm, mobile: e.target.value })}
              placeholder="+91 98765 43210"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Assigned Role
            </label>
            <div className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-rose-300 font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              PLATFORM_ADMIN (System Administrator)
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddPlatformAdmin(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={submitting}>
              Create Platform Admin
            </Button>
          </div>
        </form>
      </Modal>

      {/* REUSABLE WAREHOUSE ADD EMPLOYEE MODAL */}
      <AddEmployeeModal
        isOpen={showAddWarehouseEmployee}
        onClose={() => setShowAddWarehouseEmployee(false)}
        onSuccess={async () => {
          setActionMessage({ type: "success", text: "Warehouse employee created successfully with Supabase Auth credentials!" });
          await loadData();
          await refreshUsers();
        }}
        tenantId={selectedWarehouseTenantId || user?.tenantId || (tenants.length === 1 ? tenants[0]?.id : "") || ""}
        isPlatformAdmin={role === "PLATFORM_ADMIN"}
        allTenants={tenants}
      />

      {/* MODAL: ADD CLIENT COMPANY */}
      <Modal
        isOpen={showAddClient}
        onClose={() => setShowAddClient(false)}
        title="Add New Client Company"
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={clientForm.companyName}
                onChange={(e) => setClientForm({ ...clientForm, companyName: e.target.value })}
                placeholder="e.g. Titan Retails Ltd"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Organization *
              </label>
              <select
                value={clientForm.tenantId}
                onChange={(e) => setClientForm({ ...clientForm, tenantId: e.target.value })}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {tenants.length === 0 && (
                  <option value="" disabled>No organizations found</option>
                )}
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Primary Contact Person *
              </label>
              <input
                type="text"
                value={clientForm.contactPerson}
                onChange={(e) => setClientForm({ ...clientForm, contactPerson: e.target.value })}
                placeholder="e.g. John Doe"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                value={clientForm.mobile}
                onChange={(e) => setClientForm({ ...clientForm, mobile: e.target.value })}
                placeholder="+91 98765 43210"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                placeholder="accounts@titan.test"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                GSTIN
              </label>
              <input
                type="text"
                value={clientForm.gstNumber}
                onChange={(e) => setClientForm({ ...clientForm, gstNumber: e.target.value })}
                placeholder="29AAAAA0000A1Z5"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Billing Address *
            </label>
            <input
              type="text"
              value={clientForm.billingAddress}
              onChange={(e) => setClientForm({ ...clientForm, billingAddress: e.target.value })}
              placeholder="Registered corporate address"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Shipping / Store Address *
            </label>
            <input
              type="text"
              value={clientForm.shippingAddress}
              onChange={(e) => setClientForm({ ...clientForm, shippingAddress: e.target.value })}
              placeholder="Default delivery location"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddClient(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={submitting}>
              Create Client Company
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD EMPLOYEE */}
      <Modal
        isOpen={showAddEmployee}
        onClose={() => setShowAddEmployee(false)}
        title="Add Company Employee / Store Account"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Client Company *
            </label>
            <select
              value={employeeForm.clientId}
              onChange={(e) => {
                const selectedId = e.target.value;
                const found = clients.find((c) => c.id === selectedId);
                setEmployeeForm({
                  ...employeeForm,
                  clientId: selectedId,
                  companyName: found?.companyName || "",
                  tenantId: found?.tenantId || ""
                });
              }}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a Client Company...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} {c.tenant?.name ? `(${c.tenant.name})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Employee Contact Name *
              </label>
              <input
                type="text"
                value={employeeForm.contactPerson}
                onChange={(e) => setEmployeeForm({ ...employeeForm, contactPerson: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Role in Company *
              </label>
              <select
                value={employeeForm.employeeRole}
                onChange={(e) => setEmployeeForm({ ...employeeForm, employeeRole: e.target.value as ClientEmployeeRole })}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="RECEIVER">Receiver (Store Delivery Receiver)</option>
                <option value="STORE">Store Incharge</option>
                <option value="ACCOUNT">Accountant</option>
                <option value="MANAGER">Store Manager</option>
                <option value="GM">General Manager (GM)</option>
                <option value="MD">Managing Director (MD)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                value={employeeForm.mobile}
                onChange={(e) => setEmployeeForm({ ...employeeForm, mobile: e.target.value })}
                placeholder="+91 98765 43210"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                placeholder="receiver@store.test"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showEmployeePassword ? "text" : "password"}
                  value={employeeForm.password}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                  placeholder="Min 8 chars"
                  minLength={8}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3 pr-8 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowEmployeePassword(!showEmployeePassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showEmployeePassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
          
          {/* 
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Store / Delivery Location Address
            </label>
            <input
              type="text"
              value={employeeForm.shippingAddress}
              onChange={(e) => setEmployeeForm({ ...employeeForm, shippingAddress: e.target.value })}
              placeholder="Branch/Store address where this receiver accepts delivery"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div> */}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddEmployee(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={submitting}>
              Add Employee
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showAttachCompany}
        onClose={() => {
          setShowAttachCompany(false);
          setSelectedAttachGroupId("");
          setSelectedAttachClientId("");
        }}
        title="Attach Company to Corporate Group"
        description="Select an existing Client Company to attach to the corporate group."
      >
        <form onSubmit={handleAttachCompany} className="space-y-4">
          {(() => {
            const targetGroup = companyGroups.find((g) => g.id === selectedAttachGroupId);
            return (
              <>
                {selectedAttachGroupId && targetGroup ? (
                  <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                        Corporate Group:
                      </span>
                      <span className="text-sm font-bold text-white">{targetGroup.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                        Tenant:
                      </span>
                      <span className="text-xs font-medium text-purple-300 flex items-center gap-1.5 font-mono">
                        <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                        {targetGroup.tenant?.name || "Organization"} ({targetGroup.tenantId})
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Group *</label>
                    <select
                      value={selectedAttachGroupId}
                      onChange={(e) => {
                        setSelectedAttachGroupId(e.target.value);
                        setSelectedAttachClientId("");
                      }}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Select Corporate Group...</option>
                      {companyGroups
                        .filter((g) => !effectiveGroupTenantId || g.tenantId === effectiveGroupTenantId)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.tenant?.name || "Organization"})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company *</label>
                  <select
                    value={selectedAttachClientId}
                    onChange={(e) => setSelectedAttachClientId(e.target.value)}
                    required
                    disabled={!selectedAttachGroupId}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    <option value="">
                      {!selectedAttachGroupId
                        ? "Select a Corporate Group first..."
                        : matchingAttachClients.length === 0
                        ? `No companies found in ${targetGroup?.tenant?.name || "this organization"}`
                        : `Select Client Company in ${targetGroup?.tenant?.name || "organization"}...`}
                    </option>
                    {matchingAttachClients.map((c) => {
                      const isAlreadyInSelected = Boolean(selectedAttachGroupId && c.companyGroupId === selectedAttachGroupId);
                      return (
                        <option key={c.id} value={c.id} disabled={isAlreadyInSelected}>
                          {c.companyName} {c.companyGroupId ? (isAlreadyInSelected ? "(Already in this group)" : "(In another group)") : "(Unassigned)"}
                        </option>
                      );
                    })}
                  </select>
                  {selectedAttachGroupId && matchingAttachClients.length === 0 && (
                    <p className="text-[11px] text-amber-400 mt-1.5">
                      No client companies exist in organization "{targetGroup?.tenant?.name || "selected organization"}". Create a client company under this organization first.
                    </p>
                  )}
                </div>
              </>
            );
          })()}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAttachCompany(false);
                setSelectedAttachGroupId("");
                setSelectedAttachClientId("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={submitting}>
              Attach Company
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT CLIENT EMPLOYEE */}
      <Modal
        isOpen={Boolean(editingClientEmployee)}
        onClose={() => setEditingClientEmployee(null)}
        title={`Edit ${editingClientEmployee?.contactPerson || "Client Employee"}`}
        description="Update contact details, designated role, status, or reassign company within this organization."
      >
        {editingClientEmployee && (
          <form onSubmit={handleUpdateClientEmployee} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Assigned Client Company *
              </label>
              <select
                value={editingClientEmployee.clientId}
                onChange={(e) =>
                  setEditingClientEmployee({
                    ...editingClientEmployee,
                    clientId: e.target.value
                  })
                }
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {clients
                  .filter((c) => !editingClientEmployee.tenantId || c.tenantId === editingClientEmployee.tenantId)
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contact Person *
                </label>
                <input
                  type="text"
                  value={editingClientEmployee.contactPerson}
                  onChange={(e) =>
                    setEditingClientEmployee({
                      ...editingClientEmployee,
                      contactPerson: e.target.value
                    })
                  }
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Designated Role *
                </label>
                <select
                  value={editingClientEmployee.employeeRole}
                  onChange={(e) =>
                    setEditingClientEmployee({
                      ...editingClientEmployee,
                      employeeRole: e.target.value as ClientEmployeeRole
                    })
                  }
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  value={editingClientEmployee.mobile}
                  onChange={(e) =>
                    setEditingClientEmployee({
                      ...editingClientEmployee,
                      mobile: e.target.value
                    })
                  }
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editingClientEmployee.email}
                  onChange={(e) =>
                    setEditingClientEmployee({
                      ...editingClientEmployee,
                      email: e.target.value
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status
              </label>
              <select
                value={editingClientEmployee.status}
                onChange={(e) =>
                  setEditingClientEmployee({
                    ...editingClientEmployee,
                    status: e.target.value as UserStatus
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingClientEmployee(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={submitting}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(editingWarehouse || editingUser || editingClient || editingTenant)}
        onClose={() => {
          setEditingWarehouse(null);
          setEditingUser(null);
          setEditingClient(null);
          setEditingTenant(null);
        }}
        title={`Edit ${editingWarehouse ? "Warehouse" : editingUser ? "User" : editingClient ? "Client Company" : "Organization"}`}
        description="Update the record and save the changes."
      >
        <form onSubmit={handleUpdateRecord} className="space-y-4">
          {(editingWarehouse || editingUser || editingTenant) && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Name</label>
              <input
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          )}
          {editingClient && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name</label>
                  <input value={editForm.companyName || ""} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">GSTIN</label>
                  <input value={editForm.gstNumber || ""} onChange={(e) => setEditForm({ ...editForm, gstNumber: e.target.value })} placeholder="33AABCK1234F1Z5" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Billing Address</label>
                <textarea value={editForm.billingAddress || ""} onChange={(e) => setEditForm({ ...editForm, billingAddress: e.target.value })} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Shipping Address</label>
                <textarea value={editForm.shippingAddress || ""} onChange={(e) => setEditForm({ ...editForm, shippingAddress: e.target.value })} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Group</label>
                <select
                  value={editForm.companyGroupId || ""}
                  onChange={(e) => setEditForm({ ...editForm, companyGroupId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">No Corporate Group</option>
                  {companyGroups
                    .filter((g) => !editingClient.tenantId || g.tenantId === editingClient.tenantId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
          {(editingWarehouse || editingUser) && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{editingWarehouse ? "Code" : "Email"}</label>
              <input value={editForm[editingWarehouse ? "code" : "email"] || ""} onChange={(e) => setEditForm({ ...editForm, [editingWarehouse ? "code" : "email"]: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
            </div>
          )}
          {editingWarehouse && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Address</label>
              <input value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
            </div>
          )}
          {editingUser && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number</label>
              <input value={editForm.mobile || ""} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
            </div>
          )}
          {editingUser && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">System Role *</label>
              <select
                value={editForm.role || ""}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {editingUser.role === "PLATFORM_ADMIN" ? (
                  <option value="PLATFORM_ADMIN">Platform Admin</option>
                ) : editingUser.role === "CLIENT" ? (
                  <option value="CLIENT">Client (External)</option>
                ) : (
                  <>
                    <option value="WAREHOUSE_STAFF">Warehouse Staff</option>
                    <option value="WAREHOUSE_MODERATOR">Warehouse Moderator</option>
                    <option value="WAREHOUSE_OWNER">Warehouse Owner</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="ACCOUNTS_TEAM">Accounts Team</option>
                  </>
                )}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
            <select value={editForm.status || "ACTIVE"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          {editingUser && editForm.role === "CLIENT" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Client Employee Role *</label>
              <select value={editForm.employeeRole || ""} onChange={(e) => setEditForm({ ...editForm, employeeRole: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                <option value="RECEIVER">Receiver (Store Delivery Receiver)</option>
                <option value="STORE">Store Incharge</option>
                <option value="ACCOUNT">Accountant</option>
                <option value="MANAGER">Store Manager</option>
                <option value="GM">General Manager (GM)</option>
                <option value="MD">Managing Director (MD)</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => { setEditingWarehouse(null); setEditingUser(null); setEditingClient(null); setEditingTenant(null); }}>Cancel</Button>
            <Button type="submit" size="sm" isLoading={submitting}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
