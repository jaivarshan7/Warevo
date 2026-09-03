import Link from "next/link";
import { Boxes, Plus, AlertTriangle, CheckCircle2, MapPin, Tag, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireDashboardRoute } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";

export default async function InventoryPage() {
  const user = await requireDashboardRoute("/dashboard/inventory");
  const tenantWhere = user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" };

  const inventory = await prisma.inventory.findMany({
    where: tenantWhere,
    include: {
      product: {
        include: {
          category: true,
        },
      },
      warehouse: true,
      location: true,
      movements: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const totalItems = inventory.length;
  const totalQuantity = inventory.reduce((acc, item) => acc + item.totalQuantity, 0);
  const lowStockCount = inventory.filter(
    (item) => item.availableQuantity <= item.product.reorderLevel
  ).length;

  return (
    <section className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory & Stock</h1>
          <p className="text-sm text-slate-500">
            Real-time stock quantities, warehouse bin locations, reorder thresholds, and movement audit trail.
          </p>
        </div>

        {["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"].includes(user.role) && (
          <div className="flex items-center gap-3">
            <Link href="/dashboard/inventory/update">
              <Button variant="secondary" className="flex items-center gap-2 shadow-sm">
                <RefreshCw className="h-4 w-4 text-slate-600" />
                Update Inventory
              </Button>
            </Link>
            <Link href="/dashboard/inventory/new">
              <Button className="flex items-center gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Add Stock Item
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-primary">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Catalog SKUs</p>
            <h3 className="text-2xl font-bold text-slate-800">{totalItems}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Tag className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Units in Stock</p>
            <h3 className="text-2xl font-bold text-slate-800">{totalQuantity}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Low Stock Warnings</p>
            <h3 className="text-2xl font-bold text-slate-800">{lowStockCount}</h3>
          </div>
        </Card>
      </div>

      {/* Inventory Table Card */}
      <Card className="overflow-hidden p-0 shadow-sm">
        <div className="border-b border-border bg-slate-50/70 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Stock Records</h2>
              <p className="text-xs text-slate-500">Breakdown of inventory by physical warehouse facility and zone.</p>
            </div>
            <Badge tone="neutral">{inventory.length} records</Badge>
          </div>
        </div>

        {inventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Boxes className="h-12 w-12 text-slate-300" />
            <p className="mt-3 font-medium text-slate-600">No inventory records found</p>
            <p className="text-sm text-slate-400">Add a new stock product to get started.</p>
            <Link href="/dashboard/inventory/new" className="mt-4">
              <Button variant="secondary" className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Stock Item
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Product & SKU</th>
                  <th className="px-6 py-3">Warehouse & Bin</th>
                  <th className="px-6 py-3">Unit Price</th>
                  <th className="px-6 py-3">Available</th>
                  <th className="px-6 py-3">Reserved</th>
                  <th className="px-6 py-3">Damaged</th>
                  <th className="px-6 py-3">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {inventory.map((item) => {
                  const isLow = item.availableQuantity <= item.product.reorderLevel;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{item.product.name}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.product.sku}
                          </span>
                          {item.product.brand && <span>· {item.product.brand}</span>}
                          {item.product.category && <span>· {item.product.category.name}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{item.warehouse.name} ({item.warehouse.code})</span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {item.location ? `Zone ${item.location.zone} · Rack ${item.location.rack || "-"} · Bin ${item.location.bin || "-"}` : "Unassigned"}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {money(item.product.sellingPrice)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {item.availableQuantity} {item.product.unit}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {item.reservedQuantity}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {item.damagedQuantity > 0 ? (
                          <span className="text-red-600 font-medium">{item.damagedQuantity}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={isLow ? "amber" : "green"}>
                          {isLow ? "LOW STOCK" : "OPTIMAL"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
