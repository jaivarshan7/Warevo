import Link from "next/link";
import { ArrowLeft, Boxes, RefreshCw, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InventoryMovementType } from "@prisma/client";

async function adjustStockAction(formData: FormData) {
  "use server";

  const user = await requireUser(["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"]);
  const inventoryId = String(formData.get("inventoryId") ?? "").trim();
  const type = (String(formData.get("type") ?? "ADJUSTMENT") as InventoryMovementType) || InventoryMovementType.ADJUSTMENT;
  const quantity = parseInt(String(formData.get("quantity") ?? "0"), 10);
  const notes = String(formData.get("notes") ?? "").trim();

  if (!inventoryId) {
    throw new Error("Please select an inventory item.");
  }

  if (quantity <= 0) {
    throw new Error("Adjustment quantity must be greater than zero.");
  }

  const inventory = await prisma.inventory.findUnique({
    where: { id: inventoryId },
    include: { product: true, warehouse: true },
  });

  if (!inventory || (user.role !== "PLATFORM_ADMIN" && inventory.tenantId !== user.tenantId)) {
    throw new Error("Inventory item not found or unauthorized.");
  }

  let newAvailable = inventory.availableQuantity;
  let newTotal = inventory.totalQuantity;
  let newDamaged = inventory.damagedQuantity;

  if (type === "DAMAGE") {
    if (inventory.availableQuantity < quantity) {
      throw new Error(`Cannot mark ${quantity} units as damaged. Only ${inventory.availableQuantity} units available.`);
    }
    newAvailable = inventory.availableQuantity - quantity;
    newDamaged = inventory.damagedQuantity + quantity;
  } else if (type === "ORDER_ISSUE" || type === "TRANSFER_OUT" || type === "SALE") {
    if (inventory.availableQuantity < quantity) {
      throw new Error(`Insufficient stock. Requested ${quantity}, but only ${inventory.availableQuantity} available.`);
    }
    newAvailable = inventory.availableQuantity - quantity;
    newTotal = inventory.totalQuantity - quantity;
  } else {
    // RECEIPT, RETURN, ADJUSTMENT, TRANSFER_IN, PURCHASE
    newAvailable = inventory.availableQuantity + quantity;
    newTotal = inventory.totalQuantity + quantity;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update Inventory record
    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        availableQuantity: newAvailable,
        totalQuantity: newTotal,
        damagedQuantity: newDamaged,
      },
    });

    // 2. Create Movement Trail
    await tx.inventoryMovement.create({
      data: {
        tenantId: inventory.tenantId,
        inventoryId: inventory.id,
        productId: inventory.productId,
        type,
        quantity,
        previousQuantity: inventory.availableQuantity,
        newQuantity: newAvailable,
        notes: notes || `Stock updated via manual ${type}`,
        createdById: user.id,
      },
    });

    // 3. Create Audit Log
    await tx.auditLog.create({
      data: {
        tenantId: inventory.tenantId,
        userId: user.id,
        userRole: user.role,
        action: `Adjusted inventory stock (${type})`,
        entity: "Inventory",
        entityId: inventory.id,
        previousValue: {
          available: inventory.availableQuantity,
          total: inventory.totalQuantity,
        },
        newValue: {
          available: newAvailable,
          total: newTotal,
          type,
          delta: quantity,
        },
      },
    });
  });

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

export default async function UpdateInventoryPage() {
  const user = await requireUser(["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"]);
  const tenantWhere = user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" };

  const inventoryItems = await prisma.inventory.findMany({
    where: tenantWhere,
    include: {
      product: true,
      warehouse: true,
      location: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <RefreshCw className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Update Stock & Inventory</h1>
            <p className="text-sm text-slate-500">
              Adjust on-hand inventory levels, mark damaged products, or record stock replenishment.
            </p>
          </div>
        </div>

        {inventoryItems.length === 0 ? (
          <div className="text-center py-8">
            <Boxes className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="mt-2 text-sm text-slate-600">No inventory products available to update.</p>
            <Link href="/dashboard/inventory/new" className="mt-3 inline-block">
              <Button variant="secondary">Add New Product First</Button>
            </Link>
          </div>
        ) : (
          <form action={adjustStockAction} className="space-y-6">
            {/* Inventory Item Selector */}
            <div>
              <label htmlFor="inventoryId" className="block text-sm font-semibold text-slate-700 mb-1">
                Select Product & Location <span className="text-red-500">*</span>
              </label>
              <select
                id="inventoryId"
                name="inventoryId"
                required
                defaultValue={inventoryItems[0]?.id}
                className="h-11 w-full rounded-md border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.product.name} ({item.product.sku}) — {item.warehouse.name} [Zone {item.location?.zone ?? "A"}] — Available: {item.availableQuantity} {item.product.unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Movement / Update Type */}
            <div>
              <label htmlFor="type" className="block text-sm font-semibold text-slate-700 mb-1">
                Adjustment Action <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                name="type"
                required
                defaultValue="RECEIPT"
                className="h-11 w-full rounded-md border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              >
                <option value="RECEIPT">📥 Restock / Intake Received (+ Add to Stock)</option>
                <option value="ADJUSTMENT">⚖️ Cycle Count / Inventory Adjustment (+ Add to Stock)</option>
                <option value="RETURN">🔄 Customer Return Received (+ Add to Stock)</option>
                <option value="ORDER_ISSUE">📤 Stock Out / Dispatch (- Deduct from Available)</option>
                <option value="DAMAGE">⚠️ Damaged / Quarantine (- Deduct from Available, Move to Damaged)</option>
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-semibold text-slate-700 mb-1">
                Quantity to Adjust <span className="text-red-500">*</span>
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                required
                defaultValue="10"
                className="h-11 w-full rounded-md border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            {/* Reason / Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-semibold text-slate-700 mb-1">
                Reason / Audit Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="e.g. Received new shipment from supplier PO-4482; or physical count recount discrepancy."
                className="w-full rounded-md border border-border bg-slate-50 p-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Link href="/dashboard/inventory">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Apply Stock Update
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
