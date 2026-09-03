import { Store, Plus, ArrowLeft, Building2, Phone, Mail, MapPin, ShieldCheck, UserCheck } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientEmployeeRole, ClientStatus, Role } from "@prisma/client";

async function addClient(formData: FormData) {
  "use server";

  const companyName = String(formData.get("companyName") ?? "").trim();
  const contactPerson = String(formData.get("contactPerson") ?? "").trim();
  const mobile = String(formData.get("mobile") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const gstNumber = String(formData.get("gstNumber") ?? "").trim();
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const companyGroupId = String(formData.get("companyGroupId") ?? "").trim();
  const employeeRole = (String(formData.get("employeeRole") ?? "RECEIVER") as ClientEmployeeRole) || ClientEmployeeRole.RECEIVER;
  const billingAddress = String(formData.get("billingAddress") ?? "").trim();
  const shippingAddress = String(formData.get("shippingAddress") ?? "").trim();
  const status = (String(formData.get("status") ?? "ACTIVE") as ClientStatus) || ClientStatus.ACTIVE;

  if (!companyName) {
    throw new Error("Client Company Name is required.");
  }

  if (!contactPerson) {
    throw new Error("Contact Person / Employee Name is required.");
  }

  if (!mobile) {
    throw new Error("Contact Mobile Number is required.");
  }

  if (!tenantId) {
    throw new Error("Please select a Tenant Organization.");
  }

  // Check if mobile already exists under this tenant
  const existingClient = await prisma.client.findFirst({
    where: {
      tenantId,
      mobile,
    },
  });

  if (existingClient) {
    throw new Error(`An employee with mobile '${mobile}' is already registered under ${existingClient.companyName}.`);
  }

  // Check if user already exists with this mobile or email
  let userId: string | null = null;
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { mobile },
        ...(email ? [{ email }] : []),
      ],
    },
  });

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const createdUser = await prisma.user.create({
      data: {
        tenantId,
        name: contactPerson,
        mobile,
        email: email || null,
        role: employeeRole === "ACCOUNT" ? Role.CLIENT_ACCOUNTANT : Role.CLIENT,
        status: "ACTIVE",
      },
    });
    userId = createdUser.id;
  }

  await prisma.client.create({
    data: {
      tenantId,
      userId,
      companyGroupId: companyGroupId || null,
      companyName,
      contactPerson,
      mobile,
      email: email || null,
      gstNumber: gstNumber || null,
      billingAddress: billingAddress || shippingAddress || "Client Billing Address",
      shippingAddress: shippingAddress || billingAddress || "Client Shipping Address",
      employeeRole,
      status,
    },
  });

  revalidatePath("/admin-dashboard");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/orders/new");
  redirect("/admin-dashboard");
}

export default async function AddClientPage() {
  const [tenants, companyGroups] = await Promise.all([
    prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.companyGroup.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        tenantId: true,
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <div className="mb-6">
          <Link
            href="/admin-dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Admin Console
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Register Client Company & Employee</h1>
          <p className="text-sm text-slate-500">
            Create corporate client accounts and assign designated employee contacts to tenant organizations.
          </p>
        </div>

        <Card className="p-6">
          <form action={addClient} className="space-y-6">
            {/* Tenant Organization */}
            <div>
              <label htmlFor="tenantId" className="block text-xs font-semibold text-slate-700 mb-1">
                Tenant Organization <span className="text-red-500">*</span>
              </label>
              <select
                id="tenantId"
                name="tenantId"
                required
                defaultValue={tenants[0]?.id}
                className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="companyName" className="block text-xs font-semibold text-slate-700 mb-1">
                  Client Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  placeholder="e.g. PSS Multiplex"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="companyGroupId" className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Group
                </label>
                <select
                  id="companyGroupId"
                  name="companyGroupId"
                  defaultValue=""
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                >
                  <option value="">No group assigned</option>
                  {companyGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="gstNumber" className="block text-xs font-semibold text-slate-700 mb-1">
                  Company GSTIN
                </label>
                <input
                  id="gstNumber"
                  name="gstNumber"
                  type="text"
                  placeholder="e.g. 33AAYFP5618B1Z4"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 font-mono text-sm uppercase focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="employeeRole" className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee Role
                </label>
                <select
                  id="employeeRole"
                  name="employeeRole"
                  defaultValue="RECEIVER"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                >
                  <option value="RECEIVER">Receiver</option>
                  <option value="STORE">Store</option>
                  <option value="MANAGER">Manager</option>
                  <option value="GM">GM</option>
                  <option value="MD">MD</option>
                </select>
              </div>
            </div>

            {/* Contact Person & Mobile */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-border">
              <div>
                <label htmlFor="contactPerson" className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Person / Employee Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="contactPerson"
                  name="contactPerson"
                  type="text"
                  required
                  placeholder="e.g. John Doe (Store Manager)"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="mobile" className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Mobile Phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  required
                  placeholder="e.g. +91 93448 90042"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Email & Status */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address (optional)
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="e.g. contact@client.com"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue="ACTIVE"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="PENDING">PENDING</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            </div>

            {/* Billing & Shipping Addresses */}
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label htmlFor="billingAddress" className="block text-xs font-semibold text-slate-700 mb-1">
                  Billing Address
                </label>
                <input
                  id="billingAddress"
                  name="billingAddress"
                  type="text"
                  placeholder="e.g. 510 Railway Feeder Road, Tenkasi"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="shippingAddress" className="block text-xs font-semibold text-slate-700 mb-1">
                  Delivery / Shipping Destination Address
                </label>
                <input
                  id="shippingAddress"
                  name="shippingAddress"
                  type="text"
                  placeholder="e.g. Tenkasi Branch Store, Receiving Bay 2"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Link href="/admin-dashboard">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Register Client Company
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
