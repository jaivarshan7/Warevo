"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Building2, Store, Plus, Save, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Role, UserStatus } from "@prisma/client";

type TenantOption = {
  id: string;
  name: string;
  slug: string;
};

type ClientCompanyOption = {
  id: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  tenantId: string;
};

interface UserAccountFormProps {
  mode: "create" | "edit";
  initialData?: {
    id?: string;
    name: string;
    email: string | null;
    mobile: string | null;
    role: Role;
    tenantId: string | null;
    status: UserStatus;
    clientCompanyId?: string | null;
    newCompanyName?: string;
  };
  tenants: TenantOption[];
  clientCompanies: ClientCompanyOption[];
  action: (formData: FormData) => Promise<void>;
}

export function UserAccountForm({
  mode,
  initialData,
  tenants,
  clientCompanies,
  action,
}: UserAccountFormProps) {
  const [selectedRole, setSelectedRole] = useState<Role>(
    initialData?.role ?? Role.WAREHOUSE_STAFF
  );
  const [selectedClientMode, setSelectedClientMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    initialData?.clientCompanyId ?? clientCompanies[0]?.id ?? "NEW"
  );
  const [newCompanyName, setNewCompanyName] = useState<string>(
    initialData?.newCompanyName ?? ""
  );

  // Group unique client company names
  const uniqueCompanies = Array.from(new Set(clientCompanies.map((c) => c.companyName)));

  const isClientRole = selectedRole === Role.CLIENT;
  const isPlatformAdmin = selectedRole === Role.PLATFORM_ADMIN;

  return (
    <form action={action} className="space-y-6">
      {initialData?.id && <input type="hidden" name="userId" value={initialData.id} />}

      {/* Full Name */}
      <div>
        <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={initialData?.name ?? ""}
          placeholder="e.g. John Doe"
          className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none font-medium text-slate-900"
        />
      </div>

      {/* Email Address */}
      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={initialData?.email ?? ""}
          placeholder="e.g. john@company.com"
          className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
        />
        <p className="mt-1 text-[11px] text-slate-400">Used for email login and administrative access.</p>
      </div>

      {/* Mobile Number */}
      <div>
        <label htmlFor="mobile" className="block text-xs font-semibold text-slate-700 mb-1">
          Mobile Number
        </label>
        <input
          id="mobile"
          name="mobile"
          type="tel"
          defaultValue={initialData?.mobile ?? ""}
          placeholder="e.g. +91 93448 90042"
          className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none font-mono"
        />
        <p className="mt-1 text-[11px] text-slate-400">Used for OTP sign-in and delivery notifications.</p>
      </div>

      {/* Role Selection */}
      <div className="pt-2 border-t border-border">
        <label htmlFor="role" className="block text-xs font-semibold text-slate-700 mb-1">
          System Role <span className="text-red-500">*</span>
        </label>
        <select
          id="role"
          name="role"
          required
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as Role)}
          className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm font-semibold focus:border-primary focus:bg-white focus:outline-none"
        >
          <option value="WAREHOUSE_STAFF">Warehouse Staff (Receiving, Picking & Dispatch)</option>
          <option value="WAREHOUSE_OWNER">Warehouse Owner (Full Warehouse Admin)</option>
          <option value="WAREHOUSE_MODERATOR">Warehouse Moderator (Supervision & Orders)</option>
          <option value="ACCOUNTANT">Accountant (Invoices & Payments)</option>
          <option value="CLIENT_ACCOUNTANT">Client Accountant (Accounting only)</option>
          <option value="CLIENT">Client (Order Tracking, Delivery Verification & Invoices)</option>
          <option value="PLATFORM_ADMIN">Platform Admin (System Superuser)</option>
        </select>
      </div>

      {/* Contextual Selector based on Role */}
      {isClientRole ? (
        /* CLIENT ROLE: Show Client Company Selector NOT Warehouse */
        <div className="rounded-lg border-2 border-teal-300 bg-teal-50/40 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-xs font-bold text-slate-900">Client Company Assignment</h3>
              <p className="text-[11px] text-slate-500">
                Link this client user to their corporate company account.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="clientCompanySelect" className="block text-xs font-semibold text-slate-700 mb-1">
                Client Company <span className="text-red-500">*</span>
              </label>
              <select
                id="clientCompanySelect"
                name="clientCompanyId"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="h-10 w-full rounded border border-border bg-white px-3 text-sm font-medium focus:border-primary focus:outline-none"
              >
                {clientCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏢 {c.companyName} ({c.contactPerson})
                  </option>
                ))}
                <option value="NEW">+ Register New Client Company</option>
              </select>
            </div>

            {selectedCompanyId === "NEW" && (
              <div>
                <label htmlFor="newCompanyNameInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  New Client Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="newCompanyNameInput"
                  name="newCompanyName"
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. PSS Multiplex"
                  className="h-10 w-full rounded border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Tenant association for the client */}
          <div>
            <label htmlFor="clientTenantId" className="block text-xs font-semibold text-slate-700 mb-1">
              Associated Warehouse Tenant
            </label>
            <select
              id="clientTenantId"
              name="tenantId"
              defaultValue={initialData?.tenantId ?? tenants[0]?.id}
              className="h-9 w-full rounded border border-border bg-white px-3 text-xs focus:border-primary focus:outline-none"
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} (/{tenant.slug})
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : isPlatformAdmin ? (
        /* PLATFORM ADMIN: System level */
        <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
          <span className="font-semibold">System Superuser:</span> Platform Admins have global access across all warehouse organizations.
          <input type="hidden" name="tenantId" value="NONE" />
        </div>
      ) : (
        /* WAREHOUSE STAFF / OWNER / MODERATOR / ACCOUNTANT: Show Warehouse Tenant */
        <div>
          <label htmlFor="warehouseTenantId" className="block text-xs font-semibold text-slate-700 mb-1">
            Assigned Warehouse Organization <span className="text-red-500">*</span>
          </label>
          <select
            id="warehouseTenantId"
            name="tenantId"
            required
            defaultValue={initialData?.tenantId ?? tenants[0]?.id}
            className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                🏢 {tenant.name} (/{tenant.slug})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Account Status */}
      <div>
        <label htmlFor="status" className="block text-xs font-semibold text-slate-700 mb-1">
          Account Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={initialData?.status ?? "ACTIVE"}
          className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="PENDING">PENDING</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Link href="/admin-dashboard">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
        <Button type="submit" className="flex items-center gap-2">
          {mode === "create" ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {mode === "create" ? "Create User Account" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
