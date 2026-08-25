"use client";

import { useState } from "react";
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
  Boxes,
  CheckCircle2,
  AlertCircle
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
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
  _count: {
    locations: number;
    inventory: number;
  };
};

type UserItem = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: string;
  status: string;
  createdAt: Date | string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type TenantItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  _count: {
    warehouses: number;
    users: number;
  };
};

interface AdminDashboardViewProps {
  warehouses: WarehouseItem[];
  users: UserItem[];
  tenants: TenantItem[];
}

export function AdminDashboardView({ warehouses, users, tenants }: AdminDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<"warehouses" | "users">("warehouses");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredWarehouses = warehouses.filter((wh) => {
    const matchesSearch =
      wh.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wh.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wh.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (wh.tenant?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || wh.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.mobile ?? "").includes(searchQuery) ||
      (u.tenant?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchesStatus = statusFilter === "ALL" || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const roleColors: Record<string, "neutral" | "green" | "amber" | "red" | "blue"> = {
    PLATFORM_ADMIN: "red",
    WAREHOUSE_OWNER: "blue",
    WAREHOUSE_MODERATOR: "amber",
    ACCOUNTANT: "neutral",
    WAREHOUSE_STAFF: "green",
    CLIENT: "neutral",
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Organizations / Tenants</p>
            <h3 className="text-2xl font-bold text-slate-800">{tenants.length}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Inventory Items</p>
            <h3 className="text-2xl font-bold text-slate-800">
              {warehouses.reduce((acc, w) => acc + (w._count.inventory || 0), 0)}
            </h3>
          </div>
        </Card>
      </div>

      {/* Main Section Header with Tabs & Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex rounded-lg border border-border bg-slate-100 p-1">
          <button
            onClick={() => {
              setActiveTab("warehouses");
              setStatusFilter("ALL");
            }}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
              activeTab === "warehouses"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Warehouses ({warehouses.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("users");
              setStatusFilter("ALL");
            }}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
              activeTab === "users"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="h-4 w-4" />
            Users ({users.length})
          </button>
        </div>

        {/* Add Actions */}
        <div className="flex items-center gap-3">
          {activeTab === "warehouses" ? (
            <Link href="/admin-dashboard/add-warehouse">
              <Button className="flex items-center gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Add Warehouse
              </Button>
            </Link>
          ) : (
            <Link href="/admin-dashboard/add-user">
              <Button className="flex items-center gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search & Filters Card */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === "warehouses"
                  ? "Search warehouse by name, code, address, or tenant..."
                  : "Search user by name, email, phone, or organization..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-slate-50 pl-9 pr-4 text-sm focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "users" && (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 rounded-md border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:outline-none"
              >
                <option value="ALL">All Roles</option>
                <option value="PLATFORM_ADMIN">Platform Admin</option>
                <option value="WAREHOUSE_OWNER">Warehouse Owner</option>
                <option value="WAREHOUSE_MODERATOR">Warehouse Moderator</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="WAREHOUSE_STAFF">Warehouse Staff</option>
                <option value="CLIENT">Client</option>
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Content Tables */}
      {activeTab === "warehouses" ? (
        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="border-b border-border bg-slate-50/70 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Registered Warehouses</h2>
                <p className="text-xs text-slate-500">Physical facilities, inventory nodes, and storage locations.</p>
              </div>
              <Badge tone="neutral">{filteredWarehouses.length} records</Badge>
            </div>
          </div>

          {filteredWarehouses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-slate-300" />
              <p className="mt-3 font-medium text-slate-600">No warehouses found</p>
              <p className="text-sm text-slate-400">Try adjusting your search query or add a new warehouse.</p>
              <Link href="/admin-dashboard/add-warehouse" className="mt-4">
                <Button variant="secondary" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add Warehouse
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Warehouse Details</th>
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Organization / Tenant</th>
                    <th className="px-6 py-3">Locations / Zones</th>
                    <th className="px-6 py-3">Inventory Records</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredWarehouses.map((wh) => (
                    <tr key={wh.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-primary">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{wh.name}</div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              <span>{wh.address}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-medium text-slate-700">
                        <span className="rounded bg-slate-100 px-2 py-1">{wh.code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{wh.tenant?.name ?? "Independent"}</div>
                        <div className="text-xs text-slate-400">/{wh.tenant?.slug ?? "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Layers className="h-4 w-4 text-slate-400" />
                          <span>{wh._count.locations} zones/racks</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Boxes className="h-4 w-4 text-slate-400" />
                          <span>{wh._count.inventory} stock items</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={statusTone(wh.status)}>{wh.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-500">
                        {new Date(wh.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="border-b border-border bg-slate-50/70 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">User Accounts</h2>
                <p className="text-xs text-slate-500">System administrators, warehouse managers, accountants, staff, and clients.</p>
              </div>
              <Badge tone="neutral">{filteredUsers.length} records</Badge>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-slate-300" />
              <p className="mt-3 font-medium text-slate-600">No users found</p>
              <p className="text-sm text-slate-400">Try adjusting your filters or add a new user account.</p>
              <Link href="/admin-dashboard/add-user" className="mt-4">
                <Button variant="secondary" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add User
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">User Name & Info</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Assigned Tenant / Warehouse</th>
                    <th className="px-6 py-3">Account Status</th>
                    <th className="px-6 py-3 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-border">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-400">ID: {u.id.substring(0, 10)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5 text-xs">
                          {u.email && (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              <span>{u.email}</span>
                            </div>
                          )}
                          {u.mobile && (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              <span>{u.mobile}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={roleColors[u.role] ?? "neutral"}>
                          {u.role.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">
                          {u.tenant?.name ?? (u.role === "PLATFORM_ADMIN" ? "Cross-tenant Platform" : "None")}
                        </div>
                        {u.tenant?.slug && <div className="text-xs text-slate-400">/{u.tenant.slug}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
