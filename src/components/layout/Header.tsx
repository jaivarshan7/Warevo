import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "./NotificationBell";
import { Building2, ChevronDown, UserCircle2, LogOut, ShieldCheck, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { config } from "@/lib/config";

export const Header: React.FC = () => {
  const { user, tenant, role, allUsers, allTenants, switchUser, switchTenant, signOut } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTenantMenu, setShowTenantMenu] = useState(false);

  const getRoleBadgeStyle = (r: string) => {
    switch (r) {
      case "PLATFORM_ADMIN":
        return "bg-purple-950 text-purple-300 border-purple-800";
      case "WAREHOUSE_OWNER":
        return "bg-indigo-950 text-indigo-300 border-indigo-800";
      case "WAREHOUSE_MODERATOR":
        return "bg-blue-950 text-blue-300 border-blue-800";
      case "WAREHOUSE_STAFF":
        return "bg-emerald-950 text-emerald-300 border-emerald-800";
      case "ACCOUNTANT":
      case "ACCOUNTS_TEAM":
        return "bg-amber-950 text-amber-300 border-amber-800";
      case "CLIENT":
      case "CLIENT_ACCOUNTANT":
        return "bg-teal-950 text-teal-300 border-teal-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 sm:px-6 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      {/* Left side: Current Tenant & Branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-base shadow-sm shadow-indigo-950">
            W
          </div>
          <span className="font-bold text-white text-base tracking-tight hidden sm:inline">
            Warevo
          </span>
        </div>

        {/* Tenant selector - only show in development or for PLATFORM_ADMIN */}
        {tenant && (config.showDemoFeatures || role === "PLATFORM_ADMIN") && (
          <div className="relative ml-2 sm:ml-4 pl-3 sm:pl-4 border-l border-slate-800">
            <button
              onClick={() => setShowTenantMenu(!showTenantMenu)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-300 border border-slate-700/60 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-medium truncate max-w-[120px] sm:max-w-[200px]">
                {tenant.name}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showTenantMenu && (
              <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 p-1">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Switch Organization / Tenant
                </div>
                {allTenants.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      switchTenant(t.id);
                      setShowTenantMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                      t.id === tenant.id
                        ? "bg-indigo-950/60 text-indigo-300 font-semibold"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{t.slug}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right side: Notifications & User profile & Switcher */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Admin Console Shortcut - only for PLATFORM_ADMIN */}
        {role === "PLATFORM_ADMIN" && (
          <Link
            to="/admin"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/60 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Admin Console</span>
          </Link>
        )}

        {/* Role badge */}
        <span
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${getRoleBadgeStyle(
            role
          )}`}
        >
          <ShieldCheck className="w-3 h-3" />
          {role.replace(/_/g, " ")}
        </span>

        {/* Notifications */}
        <NotificationBell />

        {/* User menu / Demo Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-800 text-slate-200 transition-colors focus:outline-none"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-indigo-400 border border-slate-700">
                {user?.name?.slice(0, 2).toUpperCase() || "U"}
              </div>
            )}
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-white leading-tight">
                {user?.name || "Anonymous"}
              </span>
              <span className="text-[10px] text-slate-400 leading-tight">
                {user?.email || user?.mobile || role}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-2">
              <div className="px-3 py-2 border-b border-slate-800 mb-1">
                <p className="text-xs font-semibold text-white">{user?.name}</p>
                <p className="text-[11px] text-slate-400">{user?.email || user?.mobile}</p>
                <span
                  className={`mt-1.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getRoleBadgeStyle(
                    role
                  )}`}
                >
                  {role}
                </span>
              </div>

              {/* Demo Role Switcher Section - only in development */}
              {config.showDemoFeatures && (
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                    Switch Active Role (Demo)
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {allUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          switchUser(u.id);
                          setShowUserMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center justify-between transition-colors ${
                          u.id === user?.id
                            ? "bg-indigo-950 text-indigo-300 font-semibold"
                            : "text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="truncate">{u.name}</div>
                          <div className="text-[10px] text-slate-500">{u.role}</div>
                        </div>
                        {u.id === user?.id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-800 pt-1 mt-1">
                {role === "PLATFORM_ADMIN" && (
                  <Link
                    to="/admin"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-purple-300 hover:bg-purple-950/40 rounded-lg transition-colors"
                  >
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span>Admin Console</span>
                  </Link>
                )}
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <UserCircle2 className="w-4 h-4 text-slate-400" />
                  <span>My Profile</span>
                </Link>
                <button
                  onClick={async () => {
                    await signOut();
                    setShowUserMenu(false);
                    navigate("/login");
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
