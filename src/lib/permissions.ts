import { Role, ClientEmployeeRole } from "@/types";

export const permissions: Record<Role, string[]> = {
  PLATFORM_ADMIN: [
    "platform:read",
    "platform:write",
    "tenant:read:any",
    "tenant:write:any",
    "audit:read:any",
    "reports:read:any",
    "invoice-import:manage",
    "dashboard:read",
    "orders:manage",
    "inventory:manage",
    "clients:manage",
    "invoices:manage",
    "payments:manage"
  ],
  WAREHOUSE_OWNER: [
    "dashboard:read",
    "tenant:settings",
    "users:manage",
    "employees:manage",
    "clients:manage",
    "products:manage",
    "inventory:manage",
    "orders:manage",
    "verification:configure",
    "accounting:read",
    "invoices:manage",
    "payments:manage",
    "invoice-import:manage",
    "reports:read",
    "audit:read"
  ],
  WAREHOUSE_MODERATOR: [
    "dashboard:read",
    "clients:manage",
    "inventory:operate",
    "orders:manage",
    "invoice-import:manage",
    "verification:read",
    "reports:operations"
  ],
  ACCOUNTS_TEAM: [
    "dashboard:read",
    "orders:financial-read",
    "invoices:manage",
    "invoice-import:manage",
    "payments:manage",
    "reports:financial",
    "accounting:read"
  ],
  WAREHOUSE_STAFF: [
    "dashboard:read",
    "inventory:operate",
    "orders:operate"
  ],
  ACCOUNTANT: [
    "dashboard:read",
    "orders:financial-read",
    "invoices:manage",
    "invoice-import:manage",
    "payments:manage",
    "reports:financial",
    "accounting:read"
  ],
  CLIENT: [
    "client:dashboard",
    "client:orders",
    "client:verify",
    "client:invoices"
  ],
  CLIENT_ACCOUNTANT: [
    "dashboard:read",
    "accounting:read",
    "payments:manage",
    "reports:financial",
    "invoices:manage"
  ]
};

export function hasPermission(role: Role, permission: string): boolean {
  if (role === "PLATFORM_ADMIN") return true;
  return permissions[role]?.includes(permission) ?? false;
}

export function canAccessRoute(
  role: Role,
  route: string,
  employeeRole?: ClientEmployeeRole | null
): boolean {
  if (role === "PLATFORM_ADMIN") return true;

  if (role === "CLIENT" && (employeeRole === "RECEIVER" || employeeRole === "STORE")) {
    return ["/dashboard", "/operations/orders"].includes(route);
  }

  if (role === "WAREHOUSE_STAFF") {
    return ["/dashboard", "/operations/orders", "/operations/inventory"].includes(route);
  }

  if (role === "CLIENT") {
    return [
      "/dashboard",
      "/operations/orders",
      "/accounting",
      "/notifications",
      "/profile"
    ].includes(route);
  }

  if (role === "CLIENT_ACCOUNTANT") {
    return ["/dashboard", "/accounting", "/reports", "/profile"].includes(route);
  }

  if (role === "ACCOUNTS_TEAM" || role === "ACCOUNTANT") {
    return [
      "/dashboard",
      "/operations/orders",
      "/accounting",
      "/reports",
      "/notifications",
      "/profile"
    ].includes(route);
  }

  return true;
}

export function canAccessTenant(
  role: Role,
  sessionTenantId: string | null | undefined,
  resourceTenantId: string
): boolean {
  if (role === "PLATFORM_ADMIN") return true;
  return Boolean(sessionTenantId && sessionTenantId === resourceTenantId);
}
