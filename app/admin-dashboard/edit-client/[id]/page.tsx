import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Store, Save, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientStatus } from "@prisma/client";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [client, tenants] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: { tenant: true },
    }),
    prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!client) {
    notFound();
  }

  async function updateClient(formData: FormData) {
    "use server";

    const companyName = String(formData.get("companyName") ?? "").trim();
    const contactPerson = String(formData.get("contactPerson") ?? "").trim();
    const mobile = String(formData.get("mobile") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const gstNumber = String(formData.get("gstNumber") ?? "").trim();
    const tenantId = String(formData.get("tenantId") ?? "").trim();
    const billingAddress = String(formData.get("billingAddress") ?? "").trim();
    const shippingAddress = String(formData.get("shippingAddress") ?? "").trim();
    const status = (String(formData.get("status") ?? "ACTIVE") as ClientStatus) || ClientStatus.ACTIVE;

    if (!companyName || !contactPerson || !mobile || !tenantId) {
      throw new Error("Company Name, Contact Person, Mobile, and Tenant are required.");
    }

    // Check if mobile already exists for another client under this tenant
    const existing = await prisma.client.findFirst({
      where: {
        tenantId,
        mobile,
        id: { not: id },
      },
    });

    if (existing) {
      throw new Error(`An employee with mobile '${mobile}' is already registered under ${existing.companyName}.`);
    }

    await prisma.client.update({
      where: { id },
      data: {
        companyName,
        contactPerson,
        mobile,
        email: email || null,
        gstNumber: gstNumber || null,
        tenantId,
        billingAddress: billingAddress || shippingAddress || "Client Billing Address",
        shippingAddress: shippingAddress || billingAddress || "Client Shipping Address",
        status,
      },
    });

    revalidatePath("/admin-dashboard");
    revalidatePath("/dashboard/clients");
    redirect("/admin-dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/admin-dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Admin Console
          </Link>
        </div>

        <Card className="p-8 shadow-sm">
          <div className="mb-8 flex items-center gap-3 border-b border-border pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Edit Client Company & Contact</h1>
              <p className="text-sm text-slate-500">
                Update corporate client details, employee contacts, GSTIN, and delivery locations.
              </p>
            </div>
          </div>

          <form action={updateClient} className="space-y-6">
            {/* Tenant Organization */}
            <div>
              <label htmlFor="tenantId" className="block text-xs font-semibold text-slate-700 mb-1">
                Tenant Organization <span className="text-red-500">*</span>
              </label>
              <select
                id="tenantId"
                name="tenantId"
                required
                defaultValue={client.tenantId}
                className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    🏢 {t.name} (/{t.slug})
                  </option>
                ))}
              </select>
            </div>

            {/* Company Name & GSTIN */}
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
                  defaultValue={client.companyName}
                  placeholder="e.g. PSS Multiplex"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none font-bold"
                />
              </div>

              <div>
                <label htmlFor="gstNumber" className="block text-xs font-semibold text-slate-700 mb-1">
                  Company GSTIN
                </label>
                <input
                  id="gstNumber"
                  name="gstNumber"
                  type="text"
                  defaultValue={client.gstNumber ?? ""}
                  placeholder="e.g. 33AAYFP5618B1Z4"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 font-mono text-sm uppercase focus:border-primary focus:bg-white focus:outline-none"
                />
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
                  defaultValue={client.contactPerson}
                  placeholder="e.g. John Doe (Store Manager)"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none font-medium"
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
                  defaultValue={client.mobile}
                  placeholder="e.g. +91 93448 90042"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none font-mono"
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
                  defaultValue={client.email ?? ""}
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
                  defaultValue={client.status}
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
                  defaultValue={client.billingAddress}
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
                  defaultValue={client.shippingAddress}
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
                <Save className="h-4 w-4" />
                Save Client Company
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
