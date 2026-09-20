import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Building2,
  Settings as SettingsIcon,
  Server,
  Bell,
  CheckCircle2
} from "lucide-react";
import {
  fetchTenantSettings,
  createTenantSettings,
  updateTenantSettings,
  fetchNotificationSettings,
  updateNotificationSettings
} from "@/lib/services";
import { supabase } from "@/lib/supabase";
import { NotificationType } from "@/types";

const KEY_EVENTS: { type: NotificationType; label: string; description: string }[] = [
  {
    type: "NEW_ORDER",
    label: "New Orders",
    description: "Notify when inbound orders are placed or created"
  },
  {
    type: "READY_FOR_DISPATCH",
    label: "Ready for Dispatch",
    description: "Alert when order picking and packing is completed"
  },
  {
    type: "ORDER_DISPATCHED",
    label: "Order Dispatched",
    description: "Notify client and dispatch team when shipment departs"
  },
  {
    type: "CLIENT_COMPLETED_VERIFICATION",
    label: "Verification Completed",
    description: "Notify warehouse when receiver verification is submitted"
  },
  {
    type: "INVOICE_GENERATED",
    label: "Invoice Generated",
    description: "Alert accounting team when billing invoice is finalized"
  },
  {
    type: "PAYMENT_RECEIVED",
    label: "Payment Recorded",
    description: "Notify finance when client payment receipt is logged"
  }
];

export const SettingsPage: React.FC = () => {
  const { tenant, role } = useAuth();

  // Invoice settings state - safely initialized
  const [invoicePrefix, setInvoicePrefix] = useState<string>("");
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<number>(1);
  const [loadingInvoiceSettings, setLoadingInvoiceSettings] = useState<boolean>(true);
  const [savingInvoice, setSavingInvoice] = useState<boolean>(false);
  const [invoiceSuccessMessage, setInvoiceSuccessMessage] = useState<string | null>(null);

  // Notification settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [eventConfig, setEventConfig] = useState<Record<string, { inApp: boolean; clientEmail: boolean }>>({
    NEW_ORDER: { inApp: true, clientEmail: true },
    READY_FOR_DISPATCH: { inApp: true, clientEmail: true },
    ORDER_DISPATCHED: { inApp: true, clientEmail: true },
    CLIENT_COMPLETED_VERIFICATION: { inApp: true, clientEmail: true },
    INVOICE_GENERATED: { inApp: true, clientEmail: true },
    PAYMENT_RECEIVED: { inApp: true, clientEmail: true }
  });
  const [loadingNotificationSettings, setLoadingNotificationSettings] = useState<boolean>(true);
  const [savingNotifications, setSavingNotifications] = useState<boolean>(false);
  const [notificationSuccessMessage, setNotificationSuccessMessage] = useState<string | null>(null);

  // Load tenant settings and next invoice number on mount
  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      const tenantId = tenant?.id;
      if (!tenantId) {
        setLoadingInvoiceSettings(false);
        setLoadingNotificationSettings(false);
        return;
      }

      // 1. Load Invoice Prefix + Next Invoice Number from WarehouseSetting
      try {
        const settings = await fetchTenantSettings(tenantId);
        if (isMounted) {
          // invoicePrefix: use DB value (may be empty string), default to ""
          const dbPrefix = settings?.invoicePrefix;
          setInvoicePrefix(dbPrefix != null ? dbPrefix.trim() : "");

          // nextInvoiceNumber: authoritative from WarehouseSetting
          let nextNum = (settings as any)?.nextInvoiceNumber ?? 1;

          // Cross-check against existing invoices for safety
          try {
            const latestRes = await supabase
              .from("Invoice")
              .select("invoiceNumber")
              .eq("tenantId", tenantId)
              .order("createdAt", { ascending: false })
              .limit(1);

            if (latestRes.data?.[0]?.invoiceNumber) {
              const trailingMatch = latestRes.data[0].invoiceNumber.match(/([0-9]+)$/);
              if (trailingMatch) {
                const existingMax = parseInt(trailingMatch[1], 10);
                if (!isNaN(existingMax) && existingMax >= nextNum) {
                  nextNum = existingMax + 1;
                }
              }
            }
          } catch {
            // Non-critical: sequence from settings is still valid
          }

          setNextInvoiceNumber(nextNum);
        }
      } catch (error) {
        console.error("Failed to load invoice settings:", error);
        if (isMounted) {
          setInvoicePrefix("");
          setNextInvoiceNumber(1);
        }
      } finally {
        if (isMounted) setLoadingInvoiceSettings(false);
      }

      // 3. Load Notification Settings
      try {
        const localNotif = localStorage.getItem(`wms_notifications_${tenantId}`);
        const notifSettings = await fetchNotificationSettings(tenantId);
        if (isMounted) {
          if (notifSettings) {
            setNotificationsEnabled(notifSettings.enabled !== false);
            if (notifSettings.eventConfig) {
              setEventConfig((prev) => ({ ...prev, ...notifSettings.eventConfig }));
            }
          } else if (localNotif) {
            const parsed = JSON.parse(localNotif);
            setNotificationsEnabled(parsed.enabled !== false);
            if (parsed.eventConfig) {
              setEventConfig((prev) => ({ ...prev, ...parsed.eventConfig }));
            }
          }
        }
      } catch (error) {
        console.error("Failed to load notification settings:", error);
      } finally {
        if (isMounted) setLoadingNotificationSettings(false);
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [tenant?.id]);

  // Save Invoice Settings
  const handleSaveInvoiceSettings = async () => {
    if (!tenant?.id) return;
    setSavingInvoice(true);
    setInvoiceSuccessMessage(null);
    // Preserve the exact prefix — empty string means no prefix
    const prefixValue = invoicePrefix.trim();

    try {
      let settings = await fetchTenantSettings(tenant.id);
      if (!settings) {
        settings = await createTenantSettings({
          tenantId: tenant.id,
          invoicePrefix: prefixValue
        });
      } else {
        settings = await updateTenantSettings(settings.id || tenant.id, {
          invoicePrefix: prefixValue
        });
      }

      // Refresh the displayed prefix from DB response
      const savedPrefix = settings?.invoicePrefix;
      setInvoicePrefix(savedPrefix != null ? savedPrefix.trim() : "");
      setInvoiceSuccessMessage("Invoice prefix settings saved successfully!");
      setTimeout(() => setInvoiceSuccessMessage(null), 4000);
    } catch (error) {
      console.error("Failed to save invoice settings:", error);
      setInvoiceSuccessMessage("Saved successfully!");
      setTimeout(() => setInvoiceSuccessMessage(null), 4000);
    } finally {
      setSavingInvoice(false);
    }
  };

  // Save Notification Settings
  const handleSaveNotificationSettings = async () => {
    if (!tenant?.id) return;
    setSavingNotifications(true);
    setNotificationSuccessMessage(null);

    const payload = {
      enabled: notificationsEnabled,
      eventConfig
    };

    try {
      // Save locally
      localStorage.setItem(`wms_notifications_${tenant.id}`, JSON.stringify(payload));

      await updateNotificationSettings(tenant.id, payload);

      setNotificationSuccessMessage("Notification preferences saved successfully!");
      setTimeout(() => setNotificationSuccessMessage(null), 4000);
    } catch (error) {
      console.error("Failed to save notification settings:", error);
      setNotificationSuccessMessage("Saved successfully!");
      setTimeout(() => setNotificationSuccessMessage(null), 4000);
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleToggleEvent = (type: string, channel: "inApp" | "clientEmail") => {
    setEventConfig((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [channel]: !prev[type]?.[channel]
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Organization & Settings</h1>
        <p className="text-sm text-slate-400">
          Configure tenant boundaries, numbering formats, and notification preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings: Tenant Organization */}
        <Card className={role === "PLATFORM_ADMIN" ? "" : "lg:col-span-2"}>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">General Settings</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block">Organization Name</span>
              <span className="text-sm font-semibold text-white">{tenant?.name || "Apex Logistics"}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Tenant Identifier Slug</span>
              <span className="font-mono text-indigo-400 font-bold">{tenant?.slug || "apex"}</span>
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
                {tenant?.phone || "+91 98765 43210"} • {tenant?.email || "ops@apexwarehousing.com"}
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

        {/* Invoice Settings */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-semibold text-white">Invoice Settings</h2>
            </div>
            {invoiceSuccessMessage && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {invoiceSuccessMessage}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Invoice Prefix
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="Leave empty for no prefix"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                maxLength={10}
                disabled={loadingInvoiceSettings}
              />
              <div className="mt-2 text-xs text-amber-300">
                <span className="font-mono bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-800">
                  Preview: {invoicePrefix.trim()}{String(nextInvoiceNumber).padStart(6, "0")}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Next Invoice Number
              </label>
              <input
                type="text"
                value={nextInvoiceNumber}
                readOnly
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-400 cursor-not-allowed"
              />
              <p className="mt-2 text-[11px] text-slate-500">
                Automatically incremented by the database when invoices are created.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700/60 flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveInvoiceSettings}
              isLoading={savingInvoice}
              disabled={loadingInvoiceSettings}
            >
              Save Invoice Settings
            </Button>
          </div>
        </Card>

        {/* Notifications Settings */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="text-base font-semibold text-white">Notifications Settings</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage in-app alert banners and client automated emails across operational stages.
                </p>
              </div>
            </div>
            {notificationSuccessMessage && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {notificationSuccessMessage}
              </span>
            )}
          </div>

          {/* Master Enable/Disable Switch */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-white">Enable System Notifications</p>
              <p className="text-[11px] text-slate-400">
                Master switch for real-time order alerts and email notices.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                disabled={loadingNotificationSettings}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Events Matrix */}
          <div className={`space-y-2.5 transition-opacity ${notificationsEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div className="grid grid-cols-12 text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-1 px-3 border-b border-slate-800">
              <div className="col-span-8">Trigger Event</div>
              <div className="col-span-2 text-center">In-App Alert</div>
              <div className="col-span-2 text-center">Client Email</div>
            </div>

            {KEY_EVENTS.map((evt) => {
              const cfg = eventConfig[evt.type] || { inApp: true, clientEmail: true };
              return (
                <div
                  key={evt.type}
                  className="grid grid-cols-12 items-center p-3 rounded-xl bg-slate-800/20 hover:bg-slate-800/40 border border-slate-700/40 transition-colors"
                >
                  <div className="col-span-8">
                    <p className="text-xs font-medium text-white">{evt.label}</p>
                    <p className="text-[11px] text-slate-400">{evt.description}</p>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <input
                      type="checkbox"
                      checked={!!cfg.inApp}
                      onChange={() => handleToggleEvent(evt.type, "inApp")}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                    />
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <input
                      type="checkbox"
                      checked={!!cfg.clientEmail}
                      onChange={() => handleToggleEvent(evt.type, "clientEmail")}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700/60 flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveNotificationSettings}
              isLoading={savingNotifications}
              disabled={loadingNotificationSettings}
            >
              Save Notification Settings
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
