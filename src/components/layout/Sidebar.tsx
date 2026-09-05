import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getNavigationItems } from "@/lib/navigation";
import { ChevronRight } from "lucide-react";

export const Sidebar: React.FC = () => {
  const { role, user } = useAuth();
  const location = useLocation();
  const navItems = getNavigationItems(role, user?.client?.employeeRole);

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0">
      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isParentActive =
            item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);

          return (
            <div key={item.id} className="space-y-1">
              <NavLink
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    isActive || (isParentActive && !item.exact)
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-950/60 font-semibold"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.children && item.children.length > 0 && (
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      isParentActive ? "rotate-90 text-white" : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />
                )}
              </NavLink>

              {/* Sub-items */}
              {item.children && isParentActive && (
                <div className="pl-9 pr-2 py-1 space-y-1">
                  {item.children.map((sub) => {
                    const isSubActive = location.pathname + location.search === sub.path || location.pathname === sub.path;
                    return (
                      <NavLink
                        key={sub.id}
                        to={sub.path}
                        className={`block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isSubActive
                            ? "bg-indigo-950/60 text-indigo-300 font-semibold border-l-2 border-indigo-500"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                        }`}
                      >
                        {sub.label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* System Status / Version Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[11px]">Warevo v2.0 (SPA)</span>
        </div>
        <p className="text-[10px] text-slate-600 mt-1">Supabase Cloud + PostgreSQL</p>
      </div>
    </aside>
  );
};
