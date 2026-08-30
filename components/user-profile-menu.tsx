"use client";

import Link from "next/link";
import { LogOut, Settings, User, ChevronDown, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { buildInitials } from "@/lib/notifications";

export function UserProfileMenu({ user }: { user: { id: string; name: string; email?: string | null; role: string; avatarUrl?: string | null } }) {
  const [open, setOpen] = useState(false);
  const initials = buildInitials(user.name);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Open profile menu"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-left shadow-sm transition hover:bg-slate-50"
      >
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-100 to-sky-100 text-xs font-semibold text-primary">
          {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" /> : initials}
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-medium text-slate-800">{user.name}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{user.role}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(90vw,20rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-200 p-4">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-100 to-sky-100 text-sm font-semibold text-primary">
              {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-800">{user.name}</div>
              <div className="truncate text-xs text-slate-500">{user.email || "No email on file"}</div>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                <ShieldCheck className="h-3 w-3" /> {user.role}
              </div>
            </div>
          </div>

          <div className="p-2">
            <Link href="/dashboard/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              <User className="h-4 w-4" /> Profile
            </Link>
            <Link href="/dashboard/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <form action="/logout" method="POST" className="mt-1">
              <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
