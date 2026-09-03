"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Plus,
  Search,
  MapPin,
  Layers,
  Mail,
  Phone,
  ShieldCheck,
  Briefcase,
  UserCheck,
  Store,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { statusTone } from "@/lib/utils";

type WarehouseItem = {
  id: string;
  name: string;
  code: string;
  address: string;
  status: string;
  createdAt: Date | string;
  tenant: { id: string; name: string; slug: string } | null;
  _count: { locations: number; inventory: number };
};

type UserItem = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: string;
  status: string;
  createdAt: Date | string;
  tenant: { id: string; name: string; slug: string } | null;
};

type ClientItem = {
  id: string;
  companyGroupId: string | null;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string | null;
  gstNumber: string | null;
  billingAddress: string;
  shippingAddress: string;
  status: string;
  employeeRole: string | null;
  createdAt: Date | string;
  tenant?: { id: string; name: string; slug: string } | null;
  companyGroup?: { id: string; name: string } | null;
  orders: Array<{ id: string; orderNumber: string; status: string }>;
};

type CompanyGroupItem = {
  id: string;
  name: string;
  description: string | null;
  _count: { clients: number };
  clients: ClientItem[];
};

type TenantItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  _count: { warehouses: number; users: number; clients?: number };
};

interface AdminDashboardViewProps {
  warehouses: WarehouseItem[];
  users: UserItem[];
  tenants: TenantItem[];
  clients?: ClientItem[];
  companyGroups?: CompanyGroupItem[];
  createCompanyGroup: (formData: FormData) => Promise<void>;
}

export function AdminDashboardView({
  warehouses,
  users,
  tenants,
  clients = [],
  companyGroups = [],
  createCompanyGroup,
}: AdminDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<"warehouses" | "users" | "clients" | "groups">("warehouses");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tenantFilter, setTenantFilter] = useState<string>("ALL");

  const filteredWarehouses = warehouses.filter((wh) => {
    const matchesSearch =
      wh.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wh.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wh.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (wh.tenant?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || wh.status === statusFilter;
    const matchesTenant = tenantFilter === "ALL" || wh.tenant?.id === tenantFilter;
    return matchesSearch && matchesStatus && matchesTenant;
  });

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.mobile ?? "").includes(searchQuery) ||
      (u.tenant?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchesStatus = statusFilter === "ALL" || u.status === statusFilter;
    const matchesTenant = tenantFilter === "ALL" || u.tenant?.id === tenantFilter;
    return matchesSearch && matchesRole && matchesStatus && matchesTenant;
  });

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mobile.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.gstNumber ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.tenant?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesTenant = tenantFilter === "ALL" || c.tenant?.id === tenantFilter;
    return matchesSearch && matchesStatus && matchesTenant;
  });

  const groupedClientCompanies = useMemo(() => {
    const map = new Map<string, ClientItem[]>();
    for (const client of filteredClients) {
      const key = client.companyName.trim() || "Unnamed Client";
      const current = map.get(key) ?? [];
      current.push(client);
      map.set(key, current);
    }
    return Array.from(map.entries()).map(([companyName, items]) => ({ companyName, items }));
  }, [filteredClients]);

  const filteredCompanyGroups = useMemo(() => {
    return companyGroups.filter((group) => {
      const term = searchQuery.toLowerCase();
      if (!term) return true;
      const companyNames = group.clients.map((client) => client.companyName).join(" ");
      const contacts = group.clients.map((client) => client.contactPerson).join(" ");
      return (
        group.name.toLowerCase().includes(term) ||
        companyNames.toLowerCase().includes(term) ||
        contacts.toLowerCase().includes(term)
      );
    });
  }, [companyGroups, searchQuery]);

  const uniqueClientCompanies = Array.from(new Set(clients.map((c) => c.companyName)));

  const roleColors: Record<string, "neutral" | "green" | "amber" | "red" | "blue"> = {
    PLATFORM_ADMIN: "red",
    WAREHOUSE_OWNER: "blue",
    WAREHOUSE_MODERATOR: "amber",
    ACCOUNTANT: "neutral",
    WAREHOUSE_STAFF: "green",
    CLIENT: "neutral",
    RECEIVER: "neutral",
    STORE: "blue",
    MANAGER: "green",
    GM: "amber",
    MD: "red",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Warehouses</p>
            <h3 className="text-2xl font-bold text-slate-800">{warehouses.length}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Users</p>
            <h3 className="text-2xl font-bold text-slate-800">{users.length}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Client Companies</p>
            <h3 className="text-2xl font-bold text-slate-800">{uniqueClientCompanies.length}</h3>
            <span className="text-[11px] text-slate-400">({clients.length} employee accounts)</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Organizations / Tenants</p>
            <h3 className="text-2xl font-bold text-slate-800">{tenants.length}</h3>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-border bg-slate-100 p-1">
          <button onClick={() => setActiveTab("warehouses")} className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${activeTab === "warehouses" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
            <Building2 className="h-4 w-4" /> Warehouses ({warehouses.length})
          </button>
          <button onClick={() => setActiveTab("users")} className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${activeTab === "users" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
            <Users className="h-4 w-4" /> Users ({users.length})
          </button>
          <button onClick={() => setActiveTab("clients")} className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${activeTab === "clients" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
            <Store className="h-4 w-4" /> Client Companies ({uniqueClientCompanies.length})
          </button>
          <button onClick={() => setActiveTab("groups")} className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${activeTab === "groups" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
            <Layers className="h-4 w-4" /> Groups ({companyGroups.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "warehouses" ? (
            <Link href="/admin-dashboard/add-warehouse"><Button className="flex items-center gap-2 shadow-sm"><Plus className="h-4 w-4" /> Add Warehouse</Button></Link>
          ) : activeTab === "users" ? (
            <Link href="/admin-dashboard/add-user"><Button className="flex items-center gap-2 shadow-sm"><Plus className="h-4 w-4" /> Add User</Button></Link>
          ) : activeTab === "clients" ? (
            <div className="flex items-center gap-2">
              <Link href="/admin-dashboard/add-client"><Button className="flex items-center gap-2 shadow-sm"><Plus className="h-4 w-4" /> Add Client Company</Button></Link>
              <Link href="/admin-dashboard/add-employee"><Button variant="secondary" className="flex items-center gap-2 shadow-sm"><Plus className="h-4 w-4" /> Add Employee</Button></Link>
            </div>
          ) : (
            <Link href="/admin-dashboard/add-client"><Button className="flex items-center gap-2 shadow-sm"><Plus className="h-4 w-4" /> Add Client Company</Button></Link>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
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
              className="h-10 w-full rounded-md border border-border bg-slate-50 pl-9 pr-4 text-sm focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)} className="h-10 rounded-md border border-border bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:border-primary focus:bg-white focus:outline-none">
              <option value="ALL">All Organizations</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {activeTab === "users" && (
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-10 rounded-md border border-border bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:border-primary focus:bg-white focus:outline-none">
                <option value="ALL">All Roles</option>
                <option value="PLATFORM_ADMIN">Platform Admin</option>
                <option value="WAREHOUSE_OWNER">Warehouse Owner</option>
                <option value="WAREHOUSE_MODERATOR">Warehouse Moderator</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="WAREHOUSE_STAFF">Warehouse Staff</option>
                <option value="CLIENT">Client</option>
              </select>
            )}

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border border-border bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:border-primary focus:bg-white focus:outline-none">
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>
        </div>
      </Card>

      {activeTab === "warehouses" && (
        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="border-b border-border bg-slate-50/70 px-6 py-4">
            <div>
              <h2 className="font-semibold text-slate-900">System Warehouses</h2>
              <p className="text-xs text-slate-500">Total {filteredWarehouses.length} warehouse facility entries found.</p>
            </div>
          </div>

          {filteredWarehouses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-slate-300" />
              <p className="mt-3 font-medium text-slate-600">No warehouses found</p>
              <p className="text-sm text-slate-400">Try adjusting your search terms or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Warehouse Name & Code</th>
                    <th className="px-6 py-3">Tenant Organization</th>
                    <th className="px-6 py-3">Address & Location</th>
                    <th className="px-6 py-3 text-center">Bin Locations</th>
                    <th className="px-6 py-3 text-center">Stock Items</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Created Date</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredWarehouses.map((warehouse) => (
                    <tr key={warehouse.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4"><div className="font-semibold text-slate-900">{warehouse.name}</div><div className="font-mono text-xs font-medium text-primary">Code: {warehouse.code}</div></td>
                      <td className="px-6 py-4">{warehouse.tenant ? <Badge tone="neutral">{warehouse.tenant.name}</Badge> : <span className="text-xs text-slate-400">Global</span>}</td>
                      <td className="px-6 py-4"><div className="flex items-center gap-1.5 text-xs text-slate-600"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span className="truncate max-w-xs">{warehouse.address}</span></div></td>
                      <td className="px-6 py-4 text-center font-medium text-slate-700">{warehouse._count.locations}</td>
                      <td className="px-6 py-4 text-center font-semibold text-slate-900">{warehouse._count.inventory}</td>
                      <td className="px-6 py-4"><Badge tone={statusTone(warehouse.status)}>{warehouse.status}</Badge></td>
                      <td className="px-6 py-4 text-xs text-slate-500">{new Date(warehouse.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right"><Link href={`/admin-dashboard/edit-warehouse/${warehouse.id}`}><Button variant="secondary" className="h-8 px-2.5 text-xs flex items-center gap-1 ml-auto"><Pencil className="h-3 w-3" /> Edit</Button></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === "users" && (
        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="border-b border-border bg-slate-50/70 px-6 py-4"><h2 className="font-semibold text-slate-900">System Users & Roles</h2><p className="text-xs text-slate-500">Total {filteredUsers.length} user accounts found across all organizations.</p></div>
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center"><Users className="h-12 w-12 text-slate-300" /><p className="mt-3 font-medium text-slate-600">No users found</p><p className="text-sm text-slate-400">Try adjusting your search terms or filters.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500"><tr><th className="px-6 py-3">User Name</th><th className="px-6 py-3">Email & Phone</th><th className="px-6 py-3">Assigned Role</th><th className="px-6 py-3">Tenant Organization</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Joined Date</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4"><div className="font-semibold text-slate-900 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{user.name.slice(0, 2).toUpperCase()}</div>{user.name}</div></td>
                      <td className="px-6 py-4"><div className="space-y-0.5 text-xs text-slate-600">{user.email && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" />{user.email}</div>}{user.mobile && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" />{user.mobile}</div>}</div></td>
                      <td className="px-6 py-4"><Badge tone={roleColors[user.role] || "neutral"}>{user.role}</Badge></td>
                      <td className="px-6 py-4">{user.tenant ? <span className="font-medium text-slate-800 text-xs">{user.tenant.name}</span> : <span className="text-xs text-slate-400">System Level</span>}</td>
                      <td className="px-6 py-4"><Badge tone={statusTone(user.status)}>{user.status}</Badge></td>
                      <td className="px-6 py-4 text-xs text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right"><Link href={`/admin-dashboard/edit-user/${user.id}`}><Button variant="secondary" className="h-8 px-2.5 text-xs flex items-center gap-1 ml-auto"><Pencil className="h-3 w-3" /> Edit</Button></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === "clients" && (
        <div className="space-y-4">
          {groupedClientCompanies.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">No client companies match your search.</Card>
          ) : groupedClientCompanies.map(({ companyName, items }) => {
            const companyOrders = items.reduce((sum, item) => sum + item.orders.length, 0);
            const leadership = items.filter((item) => item.employeeRole && ["GM", "MD"].includes(item.employeeRole));
            return (
              <Card key={companyName} className="overflow-hidden p-0 shadow-sm border border-border">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-800 font-bold text-sm"><Building2 className="h-5 w-5" /></div>
                    <div>
                      <h2 className="font-bold text-base text-slate-900">{companyName}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                        {items[0]?.gstNumber && <span className="font-mono bg-white px-2 py-0.5 rounded border border-border">GSTIN: {items[0].gstNumber}</span>}
                        <span>{items.length} employee(s)</span>
                        <span>· {companyOrders} total orders</span>
                        {leadership.length > 0 && <span>· {leadership.length} leadership</span>}
                      </div>
                    </div>
                  </div>
                  <Link href="/admin-dashboard/add-employee"><Button variant="secondary" className="text-xs h-8 flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Employee</Button></Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-white text-[11px] font-semibold uppercase text-slate-500"><tr><th className="px-6 py-2.5">Employee / Contact</th><th className="px-6 py-2.5">Role</th><th className="px-6 py-2.5">Mobile</th><th className="px-6 py-2.5">Email</th><th className="px-6 py-2.5">Delivery Address</th><th className="px-6 py-2.5 text-center">Orders</th><th className="px-6 py-2.5">Status</th><th className="px-6 py-2.5 text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {items.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-6 py-3 font-semibold text-slate-900 flex items-center gap-2"><UserCheck className="h-3.5 w-3.5 text-slate-400" />{emp.contactPerson}</td>
                          <td className="px-6 py-3"><Badge tone={roleColors[emp.employeeRole ?? "CLIENT"] || "neutral"}>{emp.employeeRole ?? "CLIENT"}</Badge></td>
                          <td className="px-6 py-3 font-mono text-slate-700">{emp.mobile}</td>
                          <td className="px-6 py-3 text-slate-500">{emp.email || "—"}</td>
                          <td className="px-6 py-3 text-slate-600 max-w-xs truncate">{emp.shippingAddress}</td>
                          <td className="px-6 py-3 text-center font-bold text-slate-800">{emp.orders.length}</td>
                          <td className="px-6 py-3"><Badge tone={statusTone(emp.status)}>{emp.status}</Badge></td>
                          <td className="px-6 py-3 text-right"><Link href={`/admin-dashboard/edit-client/${emp.id}`}><Button variant="secondary" className="h-7 px-2 text-xs flex items-center gap-1 ml-auto"><Pencil className="h-3 w-3" /> Edit</Button></Link></td>
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

      {activeTab === "groups" && (
        <div className="space-y-4">
          <Card className="p-5">
            <form action={createCompanyGroup} className="grid gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-end">
              <div>
                <label htmlFor="groupTenantId" className="mb-1 block text-xs font-semibold text-slate-700">Organization</label>
                <select id="groupTenantId" name="tenantId" required defaultValue={tenants[0]?.id ?? ""} className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none">
                  <option value="" disabled>Select organization</option>
                  {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="groupName" className="mb-1 block text-xs font-semibold text-slate-700">Group Name</label>
                <input id="groupName" name="name" required placeholder="e.g. South India Retail Group" className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label htmlFor="groupDescription" className="mb-1 block text-xs font-semibold text-slate-700">Description</label>
                <input id="groupDescription" name="description" placeholder="Optional description" className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none" />
              </div>
              <Button type="submit" className="h-10"><Plus className="h-4 w-4" /> Create Group</Button>
            </form>
          </Card>
          {filteredCompanyGroups.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">No company groups found.</Card>
          ) : filteredCompanyGroups.map((group) => {
            const gmMd = group.clients.filter((client) => client.employeeRole && ["GM", "MD"].includes(client.employeeRole));
            return (
              <Card key={group.id} className="overflow-hidden p-0 shadow-sm border border-border">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-base text-slate-900">{group.name}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{group.description || "Corporate group of companies"}</p>
                    </div>
                    <Badge tone="blue">{group._count.clients} companies</Badge>
                  </div>
                </div>

                <div className="grid gap-4 p-6 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Store className="h-4 w-4 text-slate-500" /> Companies in group</div>
                    <div className="space-y-2">
                      {group.clients.length === 0 ? <p className="text-sm text-slate-400">No companies assigned yet.</p> : group.clients.map((company) => (
                        <div key={company.id} className="rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-700">
                          {company.companyName}
                          <div className="mt-1 text-[11px] text-slate-500">{company.contactPerson} • {company.mobile}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><ShieldCheck className="h-4 w-4 text-slate-500" /> Group leadership</div>
                    <div className="space-y-2">
                      {gmMd.length === 0 ? <p className="text-sm text-slate-400">No MD / GM assigned to this group.</p> : gmMd.map((person) => (
                        <div key={person.id} className="rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-700">
                          <div className="flex items-center justify-between gap-2"><span className="font-semibold">{person.contactPerson}</span><Badge tone={roleColors[person.employeeRole ?? "CLIENT"] || "neutral"}>{person.employeeRole}</Badge></div>
                          <div className="mt-1 text-[11px] text-slate-500">{person.email || person.mobile} • {person.companyName}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
