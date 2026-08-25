import { Users, Plus, ArrowLeft, Mail, Phone, ShieldCheck, UserCheck } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Role, UserStatus } from "@prisma/client";

async function addUser(formData: FormData) {
  "use server";
  
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const mobile = String(formData.get("mobile") ?? "").trim();
  const role = (String(formData.get("role") ?? "WAREHOUSE_STAFF") as Role) || Role.WAREHOUSE_STAFF;
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const status = (String(formData.get("status") ?? "ACTIVE") as UserStatus) || UserStatus.ACTIVE;

  if (!name) {
    throw new Error("Full name is required.");
  }

  if (!email && !mobile) {
    throw new Error("Either email or mobile number is required.");
  }

  // Check if email already exists
  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error(`A user with email '${email}' already exists.`);
    }
  }

  // Determine tenant ID (can be null for PLATFORM_ADMIN)
  const finalTenantId = role === "PLATFORM_ADMIN" || tenantId === "NONE" || !tenantId ? null : tenantId;

  await prisma.user.create({
    data: {
      name,
      email: email || null,
      mobile: mobile || null,
      role,
      tenantId: finalTenantId,
      status,
    },
  });

  revalidatePath("/admin-dashboard");
  redirect("/admin-dashboard");
}

export default async function AddUserPage() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/admin-dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>

        <Card className="p-8 shadow-sm">
          <div className="mb-8 flex items-center gap-3 border-b border-border pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Add New User</h1>
              <p className="text-sm text-slate-500">
                Create a new user account and assign system access permissions.
              </p>
            </div>
          </div>

          <form action={addUser} className="space-y-6">
            {/* Full Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Priya Sharma"
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3.5 text-sm focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="e.g. priya@warevo.test"
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3.5 text-sm focus:border-primary focus:bg-white focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">Used for login and administrative notifications.</p>
            </div>

            {/* Mobile Number */}
            <div>
              <label htmlFor="mobile" className="block text-sm font-semibold text-slate-700">
                Mobile Number
              </label>
              <input
                id="mobile"
                name="mobile"
                type="tel"
                placeholder="e.g. +919876543210"
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3.5 text-sm focus:border-primary focus:bg-white focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">Used for client and staff authentication OTPs.</p>
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-semibold text-slate-700">
                System Role <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                name="role"
                required
                defaultValue="WAREHOUSE_STAFF"
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                <option value="WAREHOUSE_STAFF">Warehouse Staff (Receiving, Picking & Dispatch)</option>
                <option value="WAREHOUSE_OWNER">Warehouse Owner (Full Warehouse Admin)</option>
                <option value="WAREHOUSE_MODERATOR">Warehouse Moderator (Supervision & Orders)</option>
                <option value="ACCOUNTANT">Accountant (Invoices & Payments)</option>
                <option value="CLIENT">Client (Order Tracking & Verification)</option>
                <option value="PLATFORM_ADMIN">Platform Admin (System Superuser)</option>
              </select>
            </div>

            {/* Organization / Tenant Selection */}
            <div>
              <label htmlFor="tenantId" className="block text-sm font-semibold text-slate-700">
                Assigned Organization / Warehouse
              </label>
              <select
                id="tenantId"
                name="tenantId"
                defaultValue={tenants[0]?.id ?? "NONE"}
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                <option value="NONE">None (Global or Unassigned)</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} (/{tenant.slug})
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-semibold text-slate-700">
                Account Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue="ACTIVE"
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Link href="/admin-dashboard">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create User
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}