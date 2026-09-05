import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchInventory, adjustInventoryStock, fetchInventoryMovements } from "@/lib/services";
import { Inventory, InventoryMovementType } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { Boxes, ArrowUpDown, AlertCircle, History, Plus, CheckCircle2 } from "lucide-react";

export const InventoryPage: React.FC = () => {
  const { tenant, user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("stock");
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stock Adjustment Modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedInv, setSelectedInv] = useState<Inventory | null>(null);
  const [adjustType, setAdjustType] = useState<InventoryMovementType>("RECEIPT");
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustNotes, setAdjustNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invList, movList] = await Promise.all([
        fetchInventory(tenant?.id),
        fetchInventoryMovements(tenant?.id)
      ]);
      setInventory(invList);
      setMovements(movList);
    } catch (err) {
      console.error("Error loading inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInv) return;
    setIsSubmitting(true);
    setModalError(null);
    setSuccessMsg(null);

    try {
      await adjustInventoryStock(
        selectedInv.id,
        adjustQuantity,
        adjustType,
        adjustNotes,
        user?.id,
        role
      );
      setIsAdjustOpen(false);
      setSuccessMsg(`Successfully processed ${adjustType} of ${adjustQuantity} units.`);
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || "Stock adjustment failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Warehouse Inventory</h1>
          <p className="text-sm text-slate-400">
            Real-time stock tracking, automated negative stock prevention, and movement audit log.
          </p>
        </div>

        {role !== "CLIENT" && (
          <Button
            onClick={() => {
              if (inventory.length > 0) setSelectedInv(inventory[0]);
              setIsAdjustOpen(true);
            }}
            className="gap-1.5 self-start sm:self-auto"
          >
            <ArrowUpDown className="w-4 h-4" /> Adjust / Receive Stock
          </Button>
        )}
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs: Stock vs Movement History */}
      <Tabs
        tabs={[
          { id: "stock", label: "Stock Levels", count: inventory.length, icon: Boxes },
          { id: "movements", label: "Movement History", count: movements.length, icon: History }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {loading ? (
        <LoadingSpinner message="Scanning warehouse inventory..." />
      ) : activeTab === "stock" ? (
        <Card className="p-0 overflow-hidden">
          {inventory.length === 0 ? (
            <EmptyState
              title="No inventory records"
              description="No products are currently tracked in this warehouse."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs uppercase font-semibold">
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-4">Warehouse & Location</th>
                    <th className="py-3 px-4 text-right">Available</th>
                    <th className="py-3 px-4 text-right">Reserved</th>
                    <th className="py-3 px-4 text-right">Damaged</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {inventory.map((inv) => {
                    const isLowStock =
                      inv.availableQuantity <= (inv.product?.reorderLevel || 10);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-semibold text-white text-xs">
                                {inv.product?.name}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400">
                                SKU: {inv.product?.sku}
                              </p>
                            </div>
                            {isLowStock && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                LOW
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-300">
                          <div>{inv.warehouse?.name || "Main Warehouse"}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            Zone {inv.location?.zone || "A"} • Bin {inv.location?.bin || "1"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                          {inv.availableQuantity}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                          {inv.reservedQuantity}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-400">
                          {inv.damagedQuantity}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-white">
                          {inv.totalQuantity} {inv.product?.unit}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {role !== "CLIENT" && (
                            <button
                              onClick={() => {
                                setSelectedInv(inv);
                                setIsAdjustOpen(true);
                              }}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2.5 py-1 rounded bg-indigo-950/60 border border-indigo-800/60"
                            >
                              Adjust
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        /* Movement History Table */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs uppercase font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Delta</th>
                  <th className="py-3 px-4 text-right">Prev → New</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {new Date(mov.createdAt).toLocaleDateString()}{" "}
                      {new Date(mov.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-white">
                      {mov.product?.name || "Product"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-indigo-300 border border-slate-700">
                        {mov.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-xs">
                      {mov.type === "DAMAGE" ? `-${mov.quantity}` : `+${mov.quantity}`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">
                      {mov.previousQuantity} → {mov.newQuantity}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 italic">
                      {mov.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustOpen && (
        <Modal
          isOpen={isAdjustOpen}
          onClose={() => setIsAdjustOpen(false)}
          title="Stock Adjustment / Movement"
          description="Atomic stock movement backed by PostgreSQL RPC transaction"
        >
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            {modalError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {modalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Select Product / Inventory
              </label>
              <select
                value={selectedInv?.id || ""}
                onChange={(e) => {
                  const found = inventory.find((i) => i.id === e.target.value);
                  setSelectedInv(found || null);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                required
              >
                {inventory.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.product?.name} (Available: {inv.availableQuantity})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Movement Type
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as InventoryMovementType)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="RECEIPT">RECEIPT (Add Inbound)</option>
                  <option value="ADJUSTMENT">ADJUSTMENT (Count Reconciliation)</option>
                  <option value="DAMAGE">DAMAGE (Transfer to Damaged)</option>
                  <option value="RETURN">RETURN (Return to Stock)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white text-right"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Audit Notes / Reference
              </label>
              <textarea
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Reason for adjustment, PO number, damage cause..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAdjustOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Execute Adjustment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
