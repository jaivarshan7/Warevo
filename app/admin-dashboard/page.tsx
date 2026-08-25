import { Building2, Shield, ArrowRight, LogOut, LayoutDashboard, ShieldCheck } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminDashboardView } from "@/components/admin-dashboard-view";

async function adminSignOut() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete("admin-user-email");
  redirect("/admin-login");
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const adminEmail = cookieStore.get("admin-user-email")?.value || process.env.ADMIN_EMAIL || "admin@example.com";

  // Fetch all warehouses with tenant info and counts
  const warehouses = await prisma.warehouse.findMany({
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          locations: true,
          inventory: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch all users with tenant info
  const users = await prisma.user.findMany({
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch all client accounts with tenant info and orders
  const clients = await prisma.client.findMany({
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch all tenants
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      _count: {
        select: {
          warehouses: true,
          users: true,
          clients: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Admin Navigation Bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <span>Warevo</span>
                <Badge tone="red">ADMIN CONSOLE</Badge>
              </div>
              <p className="text-xs text-slate-500">Global Warehouse & User Administration</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Warehouse App
            </Link>

            <Link
              href="/platform"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <Shield className="h-3.5 w-3.5" />
              Platform Overview
            </Link>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="hidden text-right text-xs md:block">
                <div className="font-semibold text-slate-800">{adminEmail}</div>
                <div className="text-slate-400">System Admin</div>
              </div>

              <form action={adminSignOut}>
                <Button variant="ghost" type="submit" className="h-9 px-2.5 text-xs text-slate-600 hover:text-red-600">
                  <LogOut className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Warehouse & User Management
            </h1>
            <p className="text-sm text-slate-500">
              Manage multi-tenant warehouses, facility locations, and user access permissions across the system.
            </p>
          </div>
        </div>

        {/* Dashboard View Component with Tabs, Search, Metrics, and Tables */}
        <AdminDashboardView
          warehouses={warehouses}
          users={users}
          tenants={tenants}
          clients={clients}
        />
      </main>
    </div>
  );
}