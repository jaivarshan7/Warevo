import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Building2, Save, ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TenantStatus } from "@prisma/client";

export default async function EditWarehousePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [warehouse, tenants] = await Promise.all([
    prisma.warehouse.findUnique({
      where: { id },
      include: { tenant: true },
    }),
    prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!warehouse) {
    notFound();
  }

  async function updateWarehouse(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    const address = String(formData.get("address") ?? "").trim();
    const status = (String(formData.get("status") ?? "ACTIVE") as TenantStatus) || TenantStatus.ACTIVE;
    const tenantId = String(formData.get("tenantId") ?? "").trim();

    if (!name || !code || !address || !tenantId) {
      throw new Error("All warehouse fields are required.");
    }

    // Check if another warehouse has this code under the tenant
    const existing = await prisma.warehouse.findFirst({
      where: {
        tenantId,
        code,
        id: { not: id },
      },
    });

    if (existing) {
      throw new Error(`A warehouse with code '${code}' already exists under this tenant.`);
    }

    await prisma.warehouse.update({
      where: { id },
      data: {
        name,
        code,
        address,
        status,
        tenantId,
      },
    });

    revalidatePath("/admin-dashboard");
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Edit Warehouse Facility</h1>
              <p className="text-sm text-slate-500">
                Update warehouse details, location address, code, and organization assignment.
              </p>
            </div>
          </div>

          <form action={updateWarehouse} className="space-y-6">
            {/* Tenant Organization */}
            <div>
              <label htmlFor="tenantId" className="block text-xs font-semibold text-slate-700 mb-1">
                Tenant Organization <span className="text-red-500">*</span>
              </label>
              <select
                id="tenantId"
                name="tenantId"
                required
                defaultValue={warehouse.tenantId}
                className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    🏢 {t.name} (/{t.slug})
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse Name */}
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
                Warehouse Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={warehouse.name}
                placeholder="e.g. North Distribution Hub"
                className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none font-medium"
              />
            </div>

            {/* Warehouse Code */}
            <div>
              <label htmlFor="code" className="block text-xs font-semibold text-slate-700 mb-1">
                Warehouse Code <span className="text-red-500">*</span>
              </label>
              <input
                id="code"
                name="code"
                type="text"
                required
                defaultValue={warehouse.code}
                placeholder="e.g. WH-NORTH-01"
                className="h-10 w-full rounded border border-border bg-slate-50 px-3 font-mono text-sm uppercase focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-xs font-semibold text-slate-700 mb-1">
                Physical Facility Address <span className="text-red-500">*</span>
              </label>
              <textarea
                id="address"
                name="address"
                required
                rows={3}
                defaultValue={warehouse.address}
                placeholder="e.g. Plot 42, Logistics Park, Phase II"
                className="w-full rounded border border-border bg-slate-50 p-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-xs font-semibold text-slate-700 mb-1">
                Facility Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={warehouse.status}
                className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Link href="/admin-dashboard">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Warehouse
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
