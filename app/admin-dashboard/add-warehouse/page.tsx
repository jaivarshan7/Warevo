import { Building2, Plus, ArrowLeft, Layers, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TenantStatus } from "@prisma/client";

async function createWarehouse(formData: FormData) {
  "use server";
  
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const address = String(formData.get("address") ?? "").trim();
  const status = (String(formData.get("status") ?? "ACTIVE") as TenantStatus) || TenantStatus.ACTIVE;
  let tenantId = String(formData.get("tenantId") ?? "").trim();
  const newTenantName = String(formData.get("newTenantName") ?? "").trim();

  if (!name || !code || !address) {
    throw new Error("Please fill in all required fields (Name, Code, Address).");
  }

  // Handle new tenant creation if selected
  if (tenantId === "NEW" || (!tenantId && newTenantName)) {
    if (!newTenantName) {
      throw new Error("Organization / Tenant name is required when creating a new organization.");
    }
    const slug = newTenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    
    // Check if slug exists or generate unique
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    const finalSlug = existingTenant ? `${slug}-${Date.now().toString().slice(-4)}` : slug;

    const createdTenant = await prisma.tenant.create({
      data: {
        name: newTenantName,
        slug: finalSlug,
        status: "ACTIVE",
        address,
        settings: {
          create: {
            orderPrefix: "ORD",
            invoicePrefix: "INV"
          }
        }
      }
    });
    tenantId = createdTenant.id;
  }

  if (!tenantId) {
    throw new Error("Please select or create an Organization / Tenant for this warehouse.");
  }

  // Check if warehouse code already exists for this tenant
  const existingWarehouse = await prisma.warehouse.findUnique({
    where: {
      tenantId_code: {
        tenantId,
        code,
      },
    },
  });

  if (existingWarehouse) {
    throw new Error(`A warehouse with code '${code}' already exists for this organization.`);
  }

  // Create warehouse and default initial location zone
  await prisma.warehouse.create({
    data: {
      tenantId,
      name,
      code,
      address,
      status,
      locations: {
        create: [
          { tenantId, zone: "Zone A", rack: "R1", shelf: "S1", bin: "B1" }
        ]
      }
    },
  });

  revalidatePath("/admin-dashboard");
  redirect("/admin-dashboard");
}

export default async function AddWarehousePage() {
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Add New Warehouse</h1>
              <p className="text-sm text-slate-500">
                Register a new warehouse facility and associate it with an organization.
              </p>
            </div>
          </div>

          <form action={createWarehouse} className="space-y-6">
            {/* Warehouse Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-700">
                Warehouse Facility Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Bengaluru Central Hub"
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3.5 text-sm focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            {/* Warehouse Code */}
            <div>
              <label htmlFor="code" className="block text-sm font-semibold text-slate-700">
                Warehouse Code (Identifier) <span className="text-red-500">*</span>
              </label>
              <input
                id="code"
                name="code"
                type="text"
                required
                placeholder="e.g. WH-BLR-01"
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3.5 font-mono text-sm uppercase focus:border-primary focus:bg-white focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">Unique identifier within the organization.</p>
            </div>

            {/* Tenant / Organization Selection */}
            <div>
              <label htmlFor="tenantId" className="block text-sm font-semibold text-slate-700">
                Organization / Tenant <span className="text-red-500">*</span>
              </label>
              <select
                id="tenantId"
                name="tenantId"
                required
                defaultValue={tenants[0]?.id ?? "NEW"}
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} (/{tenant.slug})
                  </option>
                ))}
                <option value="NEW">+ Create New Organization / Tenant</option>
              </select>
            </div>

            {/* Optional New Tenant Name */}
            <div>
              <label htmlFor="newTenantName" className="block text-sm font-semibold text-slate-700">
                New Organization Name (If creating new)
              </label>
              <input
                id="newTenantName"
                name="newTenantName"
                type="text"
                placeholder="e.g. Global Freight Logistics"
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3.5 text-sm focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-semibold text-slate-700">
                Facility Address <span className="text-red-500">*</span>
              </label>
              <textarea
                id="address"
                name="address"
                required
                rows={3}
                placeholder="e.g. Plot 45, Peenya Industrial Area, Bengaluru, Karnataka - 560058"
                className="mt-1 w-full rounded-md border border-border bg-slate-50 p-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-semibold text-slate-700">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue="ACTIVE"
                className="mt-1 h-11 w-full rounded-md border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE - Operational</option>
                <option value="PENDING">PENDING - Setup in Progress</option>
                <option value="SUSPENDED">SUSPENDED - Temporarily Closed</option>
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
                Register Warehouse
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
