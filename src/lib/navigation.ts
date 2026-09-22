import {
  LayoutDashboard,
  Package,
  Boxes,
  CircleDollarSign,
  BarChart3,
  Bell,
  Settings,
  UserCheck,
  Shield,
  Activity,
  Globe,
  Users
} from "lucide-react";
import { Role, ClientEmployeeRole } from "@/types";
import { hasPermission } from "./permissions";

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  badge?: string | number;
  children?: NavSubItem[];
  roles?: Role[];
  permissions?: string[];
  exact?: boolean;
}

export interface NavSubItem {
  id: string;
  label: string;
  path: string;
  icon?: typeof LayoutDashboard;
  roles?: Role[];
  permissions?: string[];
}

export function getNavigationItems(
  role: Role,
  employeeRole?: ClientEmployeeRole | null
): NavItem[] {
  // Staff specialized view: Simplified navigation
  if (role === "WAREHOUSE_STAFF") {
    return [
      {
        id: "dashboard",
        label: "My Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        exact: true
      },
      {
        id: "operations",
        label: "Operations",
        path: "/operations",
        icon: Package,
        children: [
          { id: "orders", label: "My Orders", path: "/operations/orders" },
          { id: "inventory", label: "Inventory Tasks", path: "/operations/inventory" }
        ]
      },
      {
        id: "notifications",
        label: "Notifications",
        path: "/notifications",
        icon: Bell
      },
      {
        id: "profile",
        label: "Profile",
        path: "/profile",
        icon: UserCheck
      }
    ];
  }

  // Receiver / Store client employee
  if (role === "CLIENT" && (employeeRole === "RECEIVER" || employeeRole === "STORE")) {
    return [
      {
        id: "dashboard",
        label: "My Tasks",
        path: "/dashboard",
        icon: LayoutDashboard,
        exact: true
      },
      {
        id: "orders",
        label: "Track / Receive Orders",
        path: "/operations/orders",
        icon: Package
      },
      {
        id: "notifications",
        label: "Notifications",
        path: "/notifications",
        icon: Bell
      },
      {
        id: "profile",
        label: "Profile",
        path: "/profile",
        icon: UserCheck
      }
    ];
  }

  // Client role
  if (role === "CLIENT") {
    return [
      {
        id: "dashboard",
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        exact: true
      },
      {
        id: "orders",
        label: "My Orders & Delivery",
        path: "/operations/orders",
        icon: Package
      },
      {
        id: "accounting",
        label: "My Invoices",
        path: "/accounting",
        icon: CircleDollarSign
      },
      {
        id: "notifications",
        label: "Notifications",
        path: "/notifications",
        icon: Bell
      },
      {
        id: "profile",
        label: "Profile",
        path: "/profile",
        icon: UserCheck
      }
    ];
  }

  // Client Accountant
  if (role === "CLIENT_ACCOUNTANT") {
    return [
      {
        id: "dashboard",
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        exact: true
      },
      {
        id: "accounting",
        label: "Accounting",
        path: "/accounting",
        icon: CircleDollarSign,
        children: [
          { id: "invoices", label: "Invoices", path: "/accounting?tab=invoices" },
          { id: "payments", label: "Payments", path: "/accounting?tab=payments" }
        ]
      },
      {
        id: "reports",
        label: "Reports",
        path: "/reports",
        icon: BarChart3
      },
      {
        id: "notifications",
        label: "Notifications",
        path: "/notifications",
        icon: Bell
      },
      {
        id: "profile",
        label: "Profile",
        path: "/profile",
        icon: UserCheck
      }
    ];
  }

  // Accounts Team & Accountant
  if (role === "ACCOUNTS_TEAM" || role === "ACCOUNTANT") {
    return [
      {
        id: "dashboard",
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        exact: true
      },
      {
        id: "orders",
        label: "Orders (Financial)",
        path: "/operations/orders",
        icon: Package
      },
      {
        id: "accounting",
        label: "Accounting",
        path: "/accounting",
        icon: CircleDollarSign,
        children: [
          { id: "overview", label: "Overview", path: "/accounting" },
          { id: "invoices", label: "Invoices", path: "/accounting?tab=invoices" },
          { id: "payments", label: "Payments", path: "/accounting?tab=payments" },
          { id: "imports", label: "Imports", path: "/accounting?tab=imports" }
        ]
      },
      {
        id: "reports",
        label: "Reports",
        path: "/reports",
        icon: BarChart3
      },
      {
        id: "notifications",
        label: "Notifications",
        path: "/notifications",
        icon: Bell
      },
      {
        id: "profile",
        label: "Profile",
        path: "/profile",
        icon: UserCheck
      }
    ];
  }

  // Standard Management & Operations navigation (Owner, Manager, GM, Moderator, Admin)
  const items: NavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      exact: true
    },
    {
      id: "operations",
      label: "Operations",
      path: "/operations",
      icon: Package,
      children: [
        { id: "orders", label: "Orders", path: "/operations/orders" },
        { id: "track", label: "Live Delivery Tracker", path: "/operations/orders/track" },
        { id: "inventory", label: "Inventory", path: "/operations/inventory" },
        { id: "clients", label: "Clients Directory", path: "/operations/clients" }
      ]
    },
    {
      id: "employees",
      label: "Employees",
      path: "/employees",
      icon: Users,
      permissions: ["employees:manage", "users:manage"]
    },
    {
      id: "accounting",
      label: "Accounting",
      path: "/accounting",
      icon: CircleDollarSign,
      children: [
        { id: "overview", label: "Overview", path: "/accounting" },
        { id: "invoices", label: "Invoices", path: "/accounting?tab=invoices" },
        { id: "payments", label: "Payments", path: "/accounting?tab=payments" },
        { id: "imports", label: "Imports", path: "/accounting?tab=imports" }
      ]
    },
    {
      id: "reports",
      label: "Reports",
      path: "/reports",
      icon: BarChart3
    },
    {
      id: "change-log",
      label: "Change Log",
      path: "/change-log",
      icon: Activity
    },
    {
      id: "notifications",
      label: "Notifications",
      path: "/notifications",
      icon: Bell
    },
    {
      id: "admin",
      label: "Admin Console",
      path: "/admin",
      icon: Shield
    },
    {
      id: "platform",
      label: "Platform Overview",
      path: "/platform",
      icon: Globe
    },
    {
      id: "settings",
      label: "Settings",
      path: "/settings",
      icon: Settings
    },
    {
      id: "profile",
      label: "Profile",
      path: "/profile",
      icon: UserCheck
    }
  ];

  // Filter based on permissions
  return items.filter((item) => {
    // Platform Overview is ONLY for PLATFORM_ADMIN
    if (item.id === "platform" && role !== "PLATFORM_ADMIN") {
      return false;
    }
    // Admin Console is ONLY for PLATFORM_ADMIN
    if (item.id === "admin" && role !== "PLATFORM_ADMIN") {
      return false;
    }
    // Settings requires tenant:settings permission or PLATFORM_ADMIN
    if (item.id === "settings" && !hasPermission(role, "tenant:settings") && role !== "PLATFORM_ADMIN") {
      return false;
    }
    return true;
  });
}

// Mobile bottom navigation bar items (max 4-5 core items)
export function getMobileNavItems(
  role: Role,
  employeeRole?: ClientEmployeeRole | null
): Array<{ label: string; path: string; icon: typeof LayoutDashboard }> {
  if (role === "CLIENT" && (employeeRole === "RECEIVER" || employeeRole === "STORE")) {
    return [
      { label: "Tasks", path: "/dashboard", icon: LayoutDashboard },
      { label: "Verify", path: "/operations/orders", icon: Package },
      { label: "Alerts", path: "/notifications", icon: Bell },
      { label: "Profile", path: "/profile", icon: UserCheck }
    ];
  }

  if (role === "WAREHOUSE_STAFF") {
    return [
      { label: "Home", path: "/dashboard", icon: LayoutDashboard },
      { label: "Orders", path: "/operations/orders", icon: Package },
      { label: "Stock", path: "/operations/inventory", icon: Boxes },
      { label: "Alerts", path: "/notifications", icon: Bell },
      { label: "Profile", path: "/profile", icon: UserCheck }
    ];
  }

  if (role === "CLIENT" || role === "CLIENT_ACCOUNTANT") {
    return [
      { label: "Home", path: "/dashboard", icon: LayoutDashboard },
      { label: "Orders", path: "/operations/orders", icon: Package },
      { label: "Billing", path: "/accounting", icon: CircleDollarSign },
      { label: "Alerts", path: "/notifications", icon: Bell },
      { label: "Profile", path: "/profile", icon: UserCheck }
    ];
  }

  const canAccessSettings = role === "PLATFORM_ADMIN" || role === "WAREHOUSE_OWNER";

  return [
    { label: "Home", path: "/dashboard", icon: LayoutDashboard },
    { label: "Orders", path: "/operations/orders", icon: Package },
    { label: "Stock", path: "/operations/inventory", icon: Boxes },
    { label: "Finance", path: "/accounting", icon: CircleDollarSign },
    canAccessSettings
      ? { label: "More", path: "/settings", icon: Settings }
      : { label: "Profile", path: "/profile", icon: UserCheck }
  ];
}
