import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function InventoryPage() {
  const user = await requireUser();
  const inventory = await prisma.inventory.findMany({
    where: user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" },
    include: { product: true, warehouse: true, location: true, movements: { orderBy: { createdAt: "desc" }, take: 3 } }
  });
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-sm text-slate-500">Stock quantities, locations, and movement audit trail.</p>
      </div>
      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <input className="h-10 rounded border border-border px-3 text-sm" placeholder="SKU, barcode, product" />
          <select className="h-10 rounded border border-border px-3 text-sm"><option>Warehouse</option></select>
          <select className="h-10 rounded border border-border px-3 text-sm"><option>Location</option></select>
          <select className="h-10 rounded border border-border px-3 text-sm"><option>Stock status</option></select>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Product</th><th>Location</th><th>Available</th><th>Reserved</th><th>Damaged</th><th>Status</th></tr></thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="py-3"><div className="font-medium">{item.product.name}</div><div className="text-xs text-slate-500">{item.product.sku}</div></td>
                <td>{item.warehouse.code} / {item.location?.zone}-{item.location?.rack}-{item.location?.bin}</td>
                <td>{item.availableQuantity}</td>
                <td>{item.reservedQuantity}</td>
                <td>{item.damagedQuantity}</td>
                <td><Badge tone={item.availableQuantity <= item.product.reorderLevel ? "amber" : "green"}>{item.availableQuantity <= item.product.reorderLevel ? "LOW STOCK" : "OK"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
