import { Boxes, Plus, ArrowLeft, Layers, Tag, IndianRupee, MapPin } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Prisma } from "@prisma/client";

async function createInventoryItem(formData: FormData) {
  "use server";
  
  const user = await requireUser(["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"]);
  const tenantId = user.role === "PLATFORM_ADMIN" 
    ? String(formData.get("tenantId") ?? "").trim() || user.tenantId
    : user.tenantId;

  if (!tenantId) {
    throw new Error("Tenant / Organization context is required.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const brand = String(formData.get("brand") ?? "").trim();
  const categoryName = String(formData.get("categoryName") ?? "").trim();
  const unit = String(formData.get("unit") ?? "pcs").trim();
  const description = String(formData.get("description") ?? "").trim();
  
  const purchasePrice = parseFloat(String(formData.get("purchasePrice") ?? "0"));
  const sellingPrice = parseFloat(String(formData.get("sellingPrice") ?? "0"));
  const gstRate = parseFloat(String(formData.get("gstRate") ?? "18"));
  const minimumStock = parseInt(String(formData.get("minimumStock") ?? "10"), 10);
  const reorderLevel = parseInt(String(formData.get("reorderLevel") ?? "20"), 10);
  
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const zone = String(formData.get("zone") ?? "A").trim().toUpperCase();
  const rack = String(formData.get("rack") ?? "R1").trim().toUpperCase();
  const shelf = String(formData.get("shelf") ?? "S1").trim().toUpperCase();
  const bin = String(formData.get("bin") ?? "B1").trim().toUpperCase();
  const initialQuantity = parseInt(String(formData.get("initialQuantity") ?? "0"), 10);

  if (!name || !sku || !warehouseId) {
    throw new Error("Product Name, SKU, and Warehouse are required.");
  }

  // Check if SKU already exists for this tenant
  const existingProduct = await prisma.product.findUnique({
    where: {
      tenantId_sku: {
        tenantId,
        sku,
      },
    },
  });

  if (existingProduct) {
    throw new Error(`Product with SKU '${sku}' already exists in this organization.`);
  }

  // Category handling
  let categoryId: string | null = null;
  if (categoryName) {
    const category = await prisma.category.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: categoryName,
        },
      },
      update: {},
      create: {
        tenantId,
        name: categoryName,
      },
    });
    categoryId = category.id;
  }

  // Create Product, Location, Inventory and opening movement in a transaction
  await prisma.$transaction(async (tx) => {
    // 1. Create Product
    const product = await tx.product.create({
      data: {
        tenantId,
        categoryId,
        sku,
        name,
        brand: brand || null,
        description: description || null,
        unit,
        purchasePrice: new Prisma.Decimal(purchasePrice),
        sellingPrice: new Prisma.Decimal(sellingPrice),
        gstRate: new Prisma.Decimal(gstRate),
        minimumStock,
        reorderLevel,
      },
    });

    // 2. Find or create Location
    let location = await tx.warehouseLocation.findFirst({
      where: {
        tenantId,
        warehouseId,
        zone,
        rack,
        shelf,
        bin,
      },
    });

    if (!location) {
      location = await tx.warehouseLocation.create({
        data: {
          tenantId,
          warehouseId,
          zone,
          rack,
          shelf,
          bin,
        },
      });
    }

    // 3. Create Inventory Record
    const inventory = await tx.inventory.create({
      data: {
        tenantId,
        warehouseId,
        locationId: location.id,
        productId: product.id,
        totalQuantity: initialQuantity,
        availableQuantity: initialQuantity,
        reservedQuantity: 0,
        damagedQuantity: 0,
      },
    });

    // 4. Record Opening Movement if quantity > 0
    if (initialQuantity > 0) {
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          inventoryId: inventory.id,
          productId: product.id,
          type: "RECEIPT",
          quantity: initialQuantity,
          previousQuantity: 0,
          newQuantity: initialQuantity,
          notes: "Initial stock entry upon product creation",
          createdById: user.id,
        },
      });
    }

    // 5. Audit Log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        userRole: user.role,
        action: "Created new inventory product",
        entity: "Product",
        entityId: product.id,
        newValue: { sku, name, initialQuantity, warehouseId },
      },
    });
  });

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

export default async function NewInventoryPage() {
  const user = await requireUser(["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"]);
  const tenantWhere = user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" };

  const [warehouses, categories, tenants] = await Promise.all([
    prisma.warehouse.findMany({
      where: tenantWhere,
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: tenantWhere,
      orderBy: { name: "asc" },
    }),
    user.role === "PLATFORM_ADMIN"
      ? prisma.tenant.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/inventory"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Inventory
        </Link>
      </div>

      <Card className="p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3 border-b border-border pb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-primary">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Add Inventory Product & Stock</h1>
            <p className="text-sm text-slate-500">
              Register a new product in the catalog and assign initial physical inventory to a warehouse location.
            </p>
          </div>
        </div>

        <form action={createInventoryItem} className="space-y-8">
          {/* Platform Admin Tenant Select */}
          {user.role === "PLATFORM_ADMIN" && (
            <div className="rounded-lg bg-slate-50 p-4 border border-border">
              <label htmlFor="tenantId" className="block text-sm font-semibold text-slate-800 mb-1">
                Target Organization / Tenant <span className="text-red-500">*</span>
              </label>
              <select
                id="tenantId"
                name="tenantId"
                required
                defaultValue={tenants[0]?.id}
                className="h-10 w-full rounded border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (/{t.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section 1: Basic Product Info */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              1. Product Information
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Heavy Duty Hydraulic Pump"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="sku" className="block text-xs font-semibold text-slate-700 mb-1">
                  SKU (Stock Keeping Unit) <span className="text-red-500">*</span>
                </label>
                <input
                  id="sku"
                  name="sku"
                  type="text"
                  required
                  placeholder="e.g. SKU-PUMP-001"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 font-mono text-sm uppercase focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="brand" className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand / Manufacturer
                </label>
                <input
                  id="brand"
                  name="brand"
                  type="text"
                  placeholder="e.g. Northline Industrial"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="categoryName" className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <input
                  id="categoryName"
                  name="categoryName"
                  type="text"
                  list="categories-list"
                  placeholder="e.g. Industrial Supplies"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
                <datalist id="categories-list">
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label htmlFor="unit" className="block text-xs font-semibold text-slate-700 mb-1">
                  Unit of Measure
                </label>
                <select
                  id="unit"
                  name="unit"
                  defaultValue="pcs"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="units">Units</option>
                  <option value="boxes">Boxes</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="liters">Liters (L)</option>
                  <option value="meters">Meters (m)</option>
                  <option value="sets">Sets</option>
                </select>
              </div>

              <div>
                <label htmlFor="description" className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  id="description"
                  name="description"
                  type="text"
                  placeholder="Brief specifications or notes"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Tax */}
          <div className="border-t border-border pt-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-primary" />
              2. Pricing & Tax Details
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="purchasePrice" className="block text-xs font-semibold text-slate-700 mb-1">
                  Purchase Price (₹)
                </label>
                <input
                  id="purchasePrice"
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  defaultValue="0.00"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="sellingPrice" className="block text-xs font-semibold text-slate-700 mb-1">
                  Selling Price (₹)
                </label>
                <input
                  id="sellingPrice"
                  name="sellingPrice"
                  type="number"
                  step="0.01"
                  defaultValue="0.00"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="gstRate" className="block text-xs font-semibold text-slate-700 mb-1">
                  GST Rate (%)
                </label>
                <select
                  id="gstRate"
                  name="gstRate"
                  defaultValue="18"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                >
                  <option value="0">0% (Exempt)</option>
                  <option value="5">5% (Essential)</option>
                  <option value="12">12% (Standard Low)</option>
                  <option value="18">18% (Standard)</option>
                  <option value="28">28% (Special / Luxury)</option>
                </select>
              </div>

              <div>
                <label htmlFor="minimumStock" className="block text-xs font-semibold text-slate-700 mb-1">
                  Minimum Stock Threshold
                </label>
                <input
                  id="minimumStock"
                  name="minimumStock"
                  type="number"
                  defaultValue="10"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="reorderLevel" className="block text-xs font-semibold text-slate-700 mb-1">
                  Reorder Alert Level
                </label>
                <input
                  id="reorderLevel"
                  name="reorderLevel"
                  type="number"
                  defaultValue="20"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Warehouse Location & Opening Stock */}
          <div className="border-t border-border pt-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              3. Storage Location & Initial Stock Intake
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label htmlFor="warehouseId" className="block text-xs font-semibold text-slate-700 mb-1">
                  Warehouse Facility <span className="text-red-500">*</span>
                </label>
                <select
                  id="warehouseId"
                  name="warehouseId"
                  required
                  defaultValue={warehouses[0]?.id}
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="zone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Zone
                </label>
                <input
                  id="zone"
                  name="zone"
                  type="text"
                  defaultValue="A"
                  placeholder="e.g. A"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm uppercase focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="rack" className="block text-xs font-semibold text-slate-700 mb-1">
                  Rack
                </label>
                <input
                  id="rack"
                  name="rack"
                  type="text"
                  defaultValue="R1"
                  placeholder="e.g. R1"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm uppercase focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="bin" className="block text-xs font-semibold text-slate-700 mb-1">
                  Shelf / Bin
                </label>
                <input
                  id="bin"
                  name="bin"
                  type="text"
                  defaultValue="B1"
                  placeholder="e.g. B1"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm uppercase focus:border-primary focus:bg-white focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-5">
                <label htmlFor="initialQuantity" className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Stock Quantity (Units)
                </label>
                <input
                  id="initialQuantity"
                  name="initialQuantity"
                  type="number"
                  min="0"
                  defaultValue="50"
                  className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none max-w-xs"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Initial inventory will be logged automatically as a RECEIPT stock movement.
                </p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Link href="/dashboard/inventory">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button type="submit" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Inventory Product
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
