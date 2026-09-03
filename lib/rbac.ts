import { Role } from "@prisma/client";

export const permissions = {
  PLATFORM_ADMIN: [
    "platform:read",
    "platform:write",
    "tenant:read:any",
    "tenant:write:any",
    "audit:read:any",
    "reports:read:any",
    "invoice-import:manage"
  ],
  MANAGER: [
    "dashboard:read",
    "tenant:settings",
    "users:manage",
    "clients:manage",
    "products:manage",
    "inventory:manage",
    "orders:manage",
    "verification:configure",
    "accounting:read",
    "invoice-import:manage",
    "reports:read",
    "audit:read"
  ],
  GM: [
    "dashboard:read",
    "tenant:settings",
    "users:manage",
    "clients:manage",
    "products:manage",
    "inventory:manage",
    "orders:manage",
    "verification:configure",
    "accounting:read",
    "invoice-import:manage",
    "reports:read",
    "audit:read"
  ],
  WAREHOUSE_OWNER: [
    "dashboard:read",
    "tenant:settings",
    "users:manage",
    "clients:manage",
    "products:manage",
    "inventory:manage",
    "orders:manage",
    "verification:configure",
    "accounting:read",
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
  PRODUCT_RECEIVER: [
    "dashboard:read",
    "orders:operate",
    "verification:read",
    "verification:confirm"
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
} satisfies Record<Role, string[]>;

export function hasPermission(role: Role, permission: string) {
  return permissions[role].includes(permission);
}

export function assertPermission(role: Role, permission: string) {
  if (!hasPermission(role, permission)) {
    throw new Error("You do not have permission to perform this action.");
  }
}

export function canAccessDashboardRoute(role: Role, route: string, employeeRole?: string | null) {
  if (role === "CLIENT" && employeeRole === "RECEIVER") {
    return ["/dashboard", "/dashboard/orders/track"].includes(route);
  }
  if (role === "PRODUCT_RECEIVER") return route === "/dashboard/orders/track";
  if (role === "WAREHOUSE_STAFF") return ["/dashboard/orders", "/dashboard/orders/track"].includes(route);
  if (role === "CLIENT") return ["/dashboard", "/dashboard/orders", "/dashboard/orders/track"].includes(route);
  if (role === "CLIENT_ACCOUNTANT") return route === "/dashboard/accounting";
  return true;
}

export function canAccessTenant(role: Role, sessionTenantId: string | null, resourceTenantId: string) {
  if (role === "PLATFORM_ADMIN") return true;
  return Boolean(sessionTenantId && sessionTenantId === resourceTenantId);
}
