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
  Trash2
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  fetchAdminDashboardData,
  createAdminWarehouse,
  createAdminUser,
  createAdminClient,
  createAdminCompanyGroup,
  createAdminTenant,
  updateAdminWarehouse,
  deleteAdminWarehouse,
  updateAdminUser,
  updateAdminClient,
  updateAdminTenant,
  AdminWarehouseItem,
  AdminUserItem,
  AdminClientItem,
  AdminCompanyGroupItem,
  AdminTenantItem
} from "@/lib/services";
import { Role, ClientEmployeeRole } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export const AdminDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warehouses, setWarehouses] = useState<AdminWarehouseItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [clients, setClients] = useState<AdminClientItem[]>([]);
  const [companyGroups, setCompanyGroups] = useState<AdminCompanyGroupItem[]>([]);
  const [tenants, setTenants] = useState<AdminTenantItem[]>([]);

  const { user, role } = useAuth();

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<"warehouses" | "users" | "clients" | "groups" | "tenants">("warehouses");
  const [searchQuery, setSearchQuery] = useState("");
  const [tenantFilter, setTenantFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal states
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit modal states
  const [editingWarehouse, setEditingWarehouse] = useState<AdminWarehouseItem | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [editingClient, setEditingClient] = useState<AdminClientItem | null>(null);
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

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    mobile: "",
    role: "WAREHOUSE_STAFF" as Role,
    tenantId: ""
  });

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
    companyName: "",
    contactPerson: "",
    mobile: "",
    email: "",
    employeeRole: "RECEIVER" as ClientEmployeeRole,
    shippingAddress: "",
    tenantId: ""
  });

  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    tenantId: ""
  });

  const loadData = async () => {
    try {
      const data = await fetchAdminDashboardData(user?.tenantId, role);
      setWarehouses(data.warehouses);
      setUsers(data.users);
      setClients(data.clients);
      setCompanyGroups(data.companyGroups);
      setTenants(data.tenants);

      if (data.tenants.length > 0) {
        setWarehouseForm((prev) => ({ ...prev, tenantId: prev.tenantId || data.tenants[0].id }));
        setUserForm((prev) => ({ ...prev, tenantId: prev.tenantId || data.tenants[0].id }));
        setClientForm((prev) => ({ ...prev, tenantId: prev.tenantId || data.tenants[0].id }));
        setEmployeeForm((prev) => ({ ...prev, tenantId: prev.tenantId || data.tenants[0].id }));
        setGroupForm((prev) => ({ ...prev, tenantId: prev.tenantId || data.tenants[0].id }));
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

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.mobile ?? "").includes(q) ||
        (u.tenant?.name ?? "").toLowerCase().includes(q);
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchesStatus = statusFilter === "ALL" || u.status === statusFilter;
      const matchesTenant = tenantFilter === "ALL" || u.tenant?.id === tenantFilter;
      return matchesSearch && matchesRole && matchesStatus && matchesTenant;
    });
  }, [users, searchQuery, roleFilter, statusFilter, tenantFilter]);

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.companyName.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q) ||
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

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return companyGroups.filter((g) => {
      if (!q) return true;
      const companyNames = g.clients.map((c) => c.companyName).join(" ").toLowerCase();
      return g.name.toLowerCase().includes(q) || companyNames.includes(q);
    });
  }, [companyGroups, searchQuery]);

  // Handlers
  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAdminWarehouse(warehouseForm);
      setShowAddWarehouse(false);
      setWarehouseForm({ name: "", code: "", address: "", tenantId: tenants[0]?.id || "" });
      setActionMessage({ type: "success", text: "Warehouse created successfully!" });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create warehouse." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAdminUser(userForm);
      setShowAddUser(false);
      setUserForm({ name: "", email: "", mobile: "", role: "WAREHOUSE_STAFF", tenantId: tenants[0]?.id || "" });
      setActionMessage({ type: "success", text: "User created successfully!" });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create user." });
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
        tenantId: tenants[0]?.id || ""
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
    setSubmitting(true);
    try {
      await createAdminClient({
        companyName: employeeForm.companyName,
        contactPerson: employeeForm.contactPerson,
        mobile: employeeForm.mobile,
        email: employeeForm.email || undefined,
        billingAddress: employeeForm.shippingAddress || "Main Office",
        shippingAddress: employeeForm.shippingAddress || "Main Office",
        tenantId: employeeForm.tenantId || tenants[0]?.id || "",
        employeeRole: employeeForm.employeeRole
      });
      setShowAddEmployee(false);
      setEmployeeForm({
        companyName: "",
        contactPerson: "",
        mobile: "",
        email: "",
        employeeRole: "RECEIVER",
        shippingAddress: "",
        tenantId: tenants[0]?.id || ""
      });
      setActionMessage({ type: "success", text: "Employee added successfully!" });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to add employee." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAdminCompanyGroup(groupForm);
      setGroupForm({ name: "", description: "", tenantId: tenants[0]?.id || "" });
      setActionMessage({ type: "success", text: "Company group created successfully!" });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create company group." });
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
      if (editingUser) await updateAdminUser(editingUser.id, editForm);
      if (editingClient) await updateAdminClient(editingClient.id, editForm);
      if (editingTenant) await updateAdminTenant(editingTenant.id, editForm);
      setEditingWarehouse(null);
      setEditingUser(null);
      setEditingClient(null);
      setEditingTenant(null);
      setActionMessage({ type: "success", text: "Record updated successfully." });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update record." });
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
          {activeTab === "users" && (
            <Button size="sm" onClick={() => setShowAddUser(true)} className="flex items-center gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add User
            </Button>
          )}
          {activeTab === "clients" && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowAddClient(true)} className="flex items-center gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Client Company
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddEmployee(true)} className="flex items-center gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Employee
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          onClick={() => setActiveTab("warehouses")}
          className="p-4 flex items-center gap-4 bg-slate-900/60 border-slate-800 cursor-pointer hover:border-slate-700 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-teal-950/60 border border-teal-800/60 flex items-center justify-center text-teal-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Total Warehouses</p>
            <p className="text-2xl font-bold text-white mt-0.5">{warehouses.length}</p>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab("users")}
          className="p-4 flex items-center gap-4 bg-slate-900/60 border-slate-800 cursor-pointer hover:border-slate-700 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Total Users</p>
            <p className="text-2xl font-bold text-white mt-0.5">{users.length}</p>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab("clients")}
          className="p-4 flex items-center gap-4 bg-slate-900/60 border-slate-800 cursor-pointer hover:border-slate-700 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Client Companies</p>
            <p className="text-2xl font-bold text-white mt-0.5">{uniqueCompanyNames.length}</p>
            <span className="text-[10px] text-slate-400">{clients.length} employee accounts</span>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab("tenants")}
          className="p-4 flex items-center gap-4 bg-slate-900/60 border-slate-800 cursor-pointer hover:border-purple-600/50 hover:bg-slate-900/80 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 group-hover:text-purple-300 transition-colors">Organizations / Tenants</p>
            <p className="text-2xl font-bold text-white mt-0.5">{tenants.length}</p>
            <span className="text-[10px] text-purple-400/80 font-medium">Click to manage →</span>
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
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === "users"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
              : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Users & Roles ({users.length})
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
                  : activeTab === "users"
                  ? "Search users by name, email, phone, organization..."
                  : activeTab === "groups"
                  ? "Search groups by name, company, or contact..."
                  : "Search client companies by name, contact, mobile, GSTIN..."
              }
              className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
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

            {activeTab === "users" && (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Roles</option>
                <option value="PLATFORM_ADMIN">Platform Admin</option>
                <option value="WAREHOUSE_OWNER">Warehouse Owner</option>
                <option value="WAREHOUSE_MODERATOR">Warehouse Moderator</option>
                <option value="WAREHOUSE_STAFF">Warehouse Staff</option>
                <option value="PRODUCT_RECEIVER">Product Receiver</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="ACCOUNTS_TEAM">Accounts Team</option>
                <option value="CLIENT">Client</option>
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

      {/* TAB 2: USERS */}
      {activeTab === "users" && (
        <Card className="overflow-hidden border-slate-800 bg-slate-900/60">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white">System Users & Roles</h3>
            <span className="text-xs text-slate-400">{filteredUsers.length} accounts</span>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">No users found</p>
              <p className="text-xs text-slate-400">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/40 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Assigned Role</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-indigo-400">
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
                          {u.role.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300 font-medium">
                          {u.tenant?.name || "System Level"}
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
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setEditForm({ name: u.name, email: u.email || "", mobile: u.mobile || "", role: u.role, status: u.status, tenantId: u.tenantId || "" });
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-300"
                          title="Edit user"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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
                          <span>{items.length} employee account(s)</span>
                          <span>• {totalOrders} total orders</span>
                          <span>• Tenant: {items[0]?.tenant?.name || "Global"}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEmployeeForm((prev) => ({
                          ...prev,
                          companyName: companyName,
                          tenantId: items[0]?.tenantId || prev.tenantId
                        }));
                        setShowAddEmployee(true);
                      }}
                      className="text-xs flex items-center gap-1 self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Employee
                    </Button>
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
                        {items.map((emp) => (
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
                              {emp.shippingAddress}
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold text-white">
                              {emp.orders.length}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant={emp.status === "ACTIVE" ? "success" : "default"}>
                                {emp.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={() => {
                                  setEditingClient(emp);
                                  setEditForm({ companyName: emp.companyName, contactPerson: emp.contactPerson, mobile: emp.mobile, email: emp.email || "", status: emp.status, shippingAddress: emp.shippingAddress });
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-300"
                                title="Edit client"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
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
          {/* Create Group Form Card */}
          <Card className="p-5 bg-slate-900/60 border-slate-800">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" />
              Create New Corporate Group
            </h3>
            <form onSubmit={handleCreateGroup} className="grid gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Organization
                </label>
                <select
                  value={groupForm.tenantId}
                  onChange={(e) => setGroupForm({ ...groupForm, tenantId: e.target.value })}
                  required
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              <p className="text-sm font-medium">No corporate groups found</p>
              <p className="text-xs text-slate-400">Create a group above to get started</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredGroups.map((g) => (
                <Card key={g.id} className="p-5 border-slate-800 bg-slate-900/60">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-base text-white">{g.name}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {g.clients.length} companies
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">{g.description || "No description provided."}</p>

                  <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                    <p className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-indigo-400" />
                      Associated Companies
                    </p>
                    {g.clients.length === 0 ? (
                      <p className="text-xs text-slate-500">No companies attached yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {g.clients.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60"
                          >
                            <span className="font-semibold text-white">{c.companyName}</span>
                            <span className="text-[10px] text-slate-400">{c.contactPerson}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
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

      {/* MODAL: ADD USER */}
      <Modal
        isOpen={showAddUser}
        onClose={() => setShowAddUser(false)}
        title="Add New User Account"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              placeholder="e.g. Sarah Connor"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              placeholder="user@example.test"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              value={userForm.mobile}
              onChange={(e) => setUserForm({ ...userForm, mobile: e.target.value })}
              placeholder="+91 98765 43210"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                System Role *
              </label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="WAREHOUSE_STAFF">Warehouse Staff</option>
                <option value="WAREHOUSE_MODERATOR">Warehouse Moderator</option>
                <option value="WAREHOUSE_OWNER">Warehouse Owner</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="ACCOUNTS_TEAM">Accounts Team</option>
                <option value="PRODUCT_RECEIVER">Product Receiver</option>
                <option value="PLATFORM_ADMIN">Platform Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Organization
              </label>
              <select
                value={userForm.tenantId}
                onChange={(e) => setUserForm({ ...userForm, tenantId: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">System-wide (No Tenant)</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddUser(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={submitting}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

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
            <input
              type="text"
              value={employeeForm.companyName}
              onChange={(e) => setEmployeeForm({ ...employeeForm, companyName: e.target.value })}
              placeholder="e.g. Apex Hypermarket"
              list="company-names-list"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <datalist id="company-names-list">
              {uniqueCompanyNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
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

          <div className="grid grid-cols-2 gap-3">
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
                Email
              </label>
              <input
                type="email"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                placeholder="receiver@store.test"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

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
          </div>

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
        isOpen={Boolean(editingWarehouse || editingUser || editingClient || editingTenant)}
        onClose={() => {
          setEditingWarehouse(null);
          setEditingUser(null);
          setEditingClient(null);
          setEditingTenant(null);
        }}
        title={`Edit ${editingWarehouse ? "Warehouse" : editingUser ? "User" : editingClient ? "Client" : "Organization"}`}
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
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name</label>
                <input value={editForm.companyName || ""} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Person</label>
                <input value={editForm.contactPerson || ""} onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
              </div>
            </>
          )}
          {(editingWarehouse || editingUser) && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{editingWarehouse ? "Code" : "Email"}</label>
              <input value={editForm[editingWarehouse ? "code" : "email"] || ""} onChange={(e) => setEditForm({ ...editForm, [editingWarehouse ? "code" : "email"]: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
            </div>
          )}
          {(editingWarehouse || editingClient) && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{editingWarehouse ? "Address" : "Mobile Number"}</label>
              <input value={editForm[editingWarehouse ? "address" : "mobile"] || ""} onChange={(e) => setEditForm({ ...editForm, [editingWarehouse ? "address" : "mobile"]: e.target.value })} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
            </div>
          )}
          {editingUser && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number</label>
              <input value={editForm.mobile || ""} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
            </div>
          )}
          {editingClient && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
              <input type="email" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
            <select value={editForm.status || "ACTIVE"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DEACTIVATED">DEACTIVATED</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => { setEditingWarehouse(null); setEditingUser(null); setEditingClient(null); setEditingTenant(null); }}>Cancel</Button>
            <Button type="submit" size="sm" isLoading={submitting}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
