import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchInventory,
  adjustInventoryStock,
  fetchInventoryMovements,
  fetchWarehouses,
  fetchCategories,
  createProductWithInitialStock
} from "@/lib/services";
import { Inventory, InventoryMovementType } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { Boxes, ArrowUpDown, History, Plus, CheckCircle2, Search, X } from "lucide-react";
import { formatDateTime } from "@/lib/dateUtils";

export const InventoryPage: React.FC = () => {
  const { tenant, user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("stock");
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInventory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return inventory;

    return inventory.filter((inv) => {
      const p = inv.product;
      if (!p) return false;

      const name = (p.name || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      const category = (p.category?.name || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      const productId = (p.id || "").toLowerCase();

      return (
        name.includes(query) ||
        sku.includes(query) ||
        category.includes(query) ||
        barcode.includes(query) ||
        productId.includes(query)
      );
    });
  }, [inventory, searchQuery]);

  // Stock Adjustment Modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedInv, setSelectedInv] = useState<Inventory | null>(null);
  const [adjustType, setAdjustType] = useState<InventoryMovementType>("RECEIPT");
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustNotes, setAdjustNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Stock Item Modal
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    sku: "",
    name: "",
    categoryId: "",
    description: "",
    price: 0,
    costPrice: 0,
    unit: "PCS",
    reorderLevel: 10,
    gstRate: 18,
    hsnCode: "",
    warehouseId: "",
    zone: "A",
    rack: "1",
    shelf: "A",
    bin: "01",
    initialQuantity: 100
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [invList, movList, whList, catList] = await Promise.all([
        fetchInventory(tenant?.id),
        fetchInventoryMovements(tenant?.id),
        fetchWarehouses(tenant?.id),
        fetchCategories(tenant?.id)
      ]);
      setInventory(invList);
      setMovements(movList);
      setWarehouses(whList);
      setCategories(catList);
      if (whList.length > 0 && !newProduct.warehouseId) {
        setNewProduct((prev) => ({ ...prev, warehouseId: whList[0].id }));
      }
      if (catList.length > 0 && !newProduct.categoryId) {
        setNewProduct((prev) => ({ ...prev, categoryId: catList[0].id }));
      }
    } catch (err) {
      console.error("Error loading inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    setSuccessMsg(null);

    try {
      await createProductWithInitialStock({
        tenantId: tenant?.id || "",
        sku: newProduct.sku,
        name: newProduct.name,
        categoryId: newProduct.categoryId || undefined,
        description: newProduct.description,
        price: Number(newProduct.price),
        costPrice: Number(newProduct.costPrice),
        unit: newProduct.unit,
        reorderLevel: Number(newProduct.reorderLevel),
        gstRate: Number(newProduct.gstRate),
        hsnCode: newProduct.hsnCode,
        warehouseId: newProduct.warehouseId,
        zone: newProduct.zone,
        rack: newProduct.rack,
        shelf: newProduct.shelf,
        bin: newProduct.bin,
        initialQuantity: Number(newProduct.initialQuantity),
        userId: user?.id
      });
      setIsAddProductOpen(false);
      setSuccessMsg(`Successfully created product "${newProduct.name}" and initialized ${newProduct.initialQuantity} units.`);
      setNewProduct({
        sku: "",
        name: "",
        categoryId: categories[0]?.id || "",
        description: "",
        price: 0,
        costPrice: 0,
        unit: "PCS",
        reorderLevel: 10,
        gstRate: 18,
        hsnCode: "",
        warehouseId: warehouses[0]?.id || "",
        zone: "A",
        rack: "1",
        shelf: "A",
        bin: "01",
        initialQuantity: 100
      });
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || "Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              onClick={() => setIsAddProductOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Stock Item
            </Button>
            <Button
              onClick={() => {
                if (inventory.length > 0) setSelectedInv(inventory[0]);
                setIsAdjustOpen(true);
              }}
              className="gap-1.5"
            >
              <ArrowUpDown className="w-4 h-4" /> Adjust Stock
            </Button>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          tabs={[
            {
              id: "stock",
              label: "Stock Levels",
              count: searchQuery.trim() ? filteredInventory.length : inventory.length,
              icon: Boxes
            },
            { id: "movements", label: "Movement History", count: movements.length, icon: History }
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "stock" && (
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products, SKU, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Scanning warehouse inventory..." />
      ) : activeTab === "stock" ? (
        <Card className="p-0 overflow-hidden">
          {inventory.length === 0 ? (
            <EmptyState
              title="No inventory items found"
              description="No products are currently tracked in this warehouse."
            />
          ) : filteredInventory.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No products match your search"
              description="Try a different product name, SKU, or category."
              actionLabel="Clear search"
              onAction={() => setSearchQuery("")}
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
                  {filteredInventory.map((inv) => {
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
                      {formatDateTime(mov.createdAt)}
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

      {/* Add New Stock Item Modal */}
      {isAddProductOpen && (
        <Modal
          isOpen={isAddProductOpen}
          onClose={() => setIsAddProductOpen(false)}
          title="Add New Stock Item / SKU"
          description="Create SKU catalog definition, assign physical warehouse bin location, and post opening stock."
        >
          <form onSubmit={handleCreateProduct} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {modalError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {modalError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">SKU / Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ELEC-BAT-001"
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lithium Polymer 5000mAh"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={newProduct.categoryId}
                  onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">None / General</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">HSN Code</label>
                <input
                  type="text"
                  placeholder="8504"
                  value={newProduct.hsnCode}
                  onChange={(e) => setNewProduct({ ...newProduct, hsnCode: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">GST Rate (%)</label>
                <select
                  value={newProduct.gstRate}
                  onChange={(e) => setNewProduct({ ...newProduct, gstRate: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                >
                  <option value={0}>0% (Exempt)</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Selling Price (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white text-right"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Cost Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProduct.costPrice}
                  onChange={(e) => setNewProduct({ ...newProduct, costPrice: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white text-right"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Unit</label>
                <select
                  value={newProduct.unit}
                  onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="PCS">PCS (Pieces)</option>
                  <option value="BOX">BOX (Boxes)</option>
                  <option value="KG">KG (Kilograms)</option>
                  <option value="MTR">MTR (Meters)</option>
                  <option value="SET">SET (Sets)</option>
                </select>
              </div>
            </div>

            {/* Warehouse & Physical Location Mapping */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Warehouse & Bin Location Setup
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Facility / Warehouse *</label>
                  <select
                    value={newProduct.warehouseId}
                    onChange={(e) => setNewProduct({ ...newProduct, warehouseId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Initial Opening Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.initialQuantity}
                    onChange={(e) => setNewProduct({ ...newProduct, initialQuantity: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white text-right font-bold text-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase">Zone</label>
                  <input
                    type="text"
                    value={newProduct.zone}
                    onChange={(e) => setNewProduct({ ...newProduct, zone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase">Rack</label>
                  <input
                    type="text"
                    value={newProduct.rack}
                    onChange={(e) => setNewProduct({ ...newProduct, rack: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase">Shelf</label>
                  <input
                    type="text"
                    value={newProduct.shelf}
                    onChange={(e) => setNewProduct({ ...newProduct, shelf: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase">Bin</label>
                  <input
                    type="text"
                    value={newProduct.bin}
                    onChange={(e) => setNewProduct({ ...newProduct, bin: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddProductOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Product & Place in Warehouse
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
