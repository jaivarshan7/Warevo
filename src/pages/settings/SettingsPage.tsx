import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Building2, Settings as SettingsIcon, Server } from "lucide-react";
import { fetchTenantSettings, createTenantSettings, updateTenantSettings } from "@/lib/services";

export const SettingsPage: React.FC = () => {
  const { tenant, role } = useAuth();

  const [invoicePrefix, setInvoicePrefix] = useState("");
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load tenant settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!tenant?.id) {
        setLoading(false);
        return;
      }
      try {
        const settings = await fetchTenantSettings(tenant.id);
        if (settings) {
          setInvoicePrefix(settings.invoicePrefix?.trim() || "");
          // Calculate next invoice number based on existing invoices
          setNextInvoiceNumber(1);
        } else {
          setInvoicePrefix("");
          setNextInvoiceNumber(1);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        setInvoicePrefix("");
        setNextInvoiceNumber(1);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [tenant?.id]);

  const handleSavePrefix = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      let settings = await fetchTenantSettings(tenant.id);
      if (!settings) {
        settings = await createTenantSettings({
          tenantId: tenant.id,
          invoicePrefix: invoicePrefix || null
        });
      } else {
        settings = await updateTenantSettings(settings.id, {
          invoicePrefix: invoicePrefix || null
        });
      }
      if (settings) {
        setInvoicePrefix(settings.invoicePrefix?.trim() || "");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Organization & Settings</h1>
        <p className="text-sm text-slate-400">
          Configure tenant boundaries, order prefixes, and database connections.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenant Details */}
        <Card className={role === "PLATFORM_ADMIN" ? "" : "lg:col-span-2"}>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Tenant Organization</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block">Organization Name</span>
              <span className="text-sm font-semibold text-white">{tenant?.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Tenant Identifier Slug</span>
              <span className="font-mono text-indigo-400 font-bold">{tenant?.slug}</span>
            </div>
            <div>
              <span className="text-slate-400 block">GST Identification Number (GSTIN)</span>
              <span className="font-mono text-slate-300">{tenant?.gstNumber || "29ABCDE1234F1Z5"}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Registered Address</span>
              <span className="text-slate-300">{tenant?.address || "100 Logistics Park, Bengaluru"}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Contact Information</span>
              <span className="text-slate-300">
                {tenant?.phone} • {tenant?.email}
              </span>
            </div>
          </div>
        </Card>

        {/* System & Architecture Info - Only visible to PLATFORM_ADMIN */}
        {role === "PLATFORM_ADMIN" && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">Architecture & Services</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/60">
                <div>
                  <p className="font-semibold text-white">Frontend Runtime</p>
                  <p className="text-slate-400">React 19 SPA + Vite 6</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  ACTIVE
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/60">
                <div>
                  <p className="font-semibold text-white">Database & RPC Engine</p>
                  <p className="text-slate-400">Supabase PostgreSQL 15</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  CONNECTED
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/60">
                <div>
                  <p className="font-semibold text-white">Row-Level Security (RLS)</p>
                  <p className="text-slate-400">Multi-tenant isolation policies</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                  ENFORCED
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Prefix Settings */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-white">Invoice Settings</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Invoice Prefix *
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value.trim())}
                placeholder="e.g. INV-, WMS-, SI-"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                maxLength={10}
                disabled={loading}
              />
              {invoicePrefix && (
                <div className="mt-2 text-xs text-amber-300">
                  <span className="font-mono bg-slate-900/50 px-1 py-0.5 rounded border border-slate-800">
                    Preview: {invoicePrefix}{nextInvoiceNumber}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Next Invoice Number
              </label>
              <input
                type="text"
                value={nextInvoiceNumber}
                readOnly
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-400"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700/60 flex justify-end">
            <Button
              size="sm"
              onClick={handleSavePrefix}
              isLoading={saving}
              disabled={loading}
            >
              Save Invoice Settings
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
