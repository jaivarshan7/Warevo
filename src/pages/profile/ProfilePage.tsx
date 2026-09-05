import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UserCheck, Building, ShieldCheck, Mail, Phone } from "lucide-react";

export const ProfilePage: React.FC = () => {
  const { user, tenant, role } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">User Profile</h1>
        <p className="text-sm text-slate-400">
          Account identity, assigned role credentials, and tenant authorization.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-950">
            {user?.name?.slice(0, 2).toUpperCase() || "U"}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{user?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                {role}
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
