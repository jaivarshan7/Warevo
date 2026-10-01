import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UserCheck, Building, ShieldCheck, Mail, Phone } from "lucide-react";

import { getRoleDisplay, getRoleBadgeStyle } from "@/lib/permissions";
import { fetchEmailSentCount } from "@/lib/services";

export const ProfilePage: React.FC = () => {
  const { user, tenant, role } = useAuth();
  const [emailSentCount, setEmailSentCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState<boolean>(false);

  const isWarehouseUser =
    role === "WAREHOUSE_OWNER" ||
    role === "WAREHOUSE_MODERATOR" ||
    role === "WAREHOUSE_STAFF" ||
    role === "ACCOUNTANT" ||
    role === "ACCOUNTS_TEAM";

  const isPlatformAdmin = role === "PLATFORM_ADMIN";
  const shouldShowEmailStats = isPlatformAdmin || isWarehouseUser;

  useEffect(() => {
    if (!shouldShowEmailStats) return;

    let isMounted = true;
    setLoadingCount(true);

    fetchEmailSentCount({
      tenantId: isPlatformAdmin ? null : tenant?.id,
      role: role || undefined
    })
      .then((count) => {
        if (isMounted) {
          setEmailSentCount(count);
        }
      })
      .catch((err) => {
        console.warn("Failed to load email sent count:", err);
        if (isMounted) {
          setEmailSentCount(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingCount(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [shouldShowEmailStats, isPlatformAdmin, tenant?.id, role, user?.id]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">User Profile</h1>
        <p className="text-sm text-slate-400">
          Account identity, assigned role credentials, and tenant authorization.
        </p>
      </div>

      {shouldShowEmailStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400">Emails Sent</span>
              <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
                <Mail className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {loadingCount ? "..." : emailSentCount !== null ? emailSentCount.toLocaleString() : "—"}
            </div>
            <p className="text-xs text-slate-500 mt-1">Successfully delivered</p>
          </Card>
        </div>
      )}

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-950">
            {user?.name?.slice(0, 2).toUpperCase() || "U"}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{user?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getRoleBadgeStyle(user, user?.clientEmployee?.employeeRole)}`}>
                {getRoleDisplay(user, user?.clientEmployee?.employeeRole)}
              </span>
              <span className="text-xs text-slate-400">Status: {user?.status}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" /> Email Address
            </span>
            <span className="font-medium text-white">{user?.email || "Not specified"}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-400" /> Mobile Number
            </span>
            <span className="font-medium text-white">{user?.mobile || "Not specified"}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-400" /> Tenant Organization
            </span>
            <span className="font-medium text-white">{tenant?.name} ({tenant?.slug})</span>
          </div>

          {user?.client && (
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Building className="w-4 h-4 text-teal-400" /> Linked Client Company
              </span>
              <span className="font-medium text-teal-300">
                {user.client.companyName}
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
