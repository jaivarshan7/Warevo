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
  ACCOUNTANT: [
    "dashboard:read",
    "orders:financial-read",
    "invoices:manage",
    "invoice-import:manage",
    "payments:manage",
    "reports:financial"
  ],
  WAREHOUSE_STAFF: [
    "dashboard:read",
    "inventory:operate",
    "orders:operate"
  ],
  CLIENT: [
    "client:dashboard",
    "client:orders",
    "client:verify",
    "client:invoices"
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

export function canAccessTenant(role: Role, sessionTenantId: string | null, resourceTenantId: string) {
  if (role === "PLATFORM_ADMIN") return true;
  return Boolean(sessionTenantId && sessionTenantId === resourceTenantId);
}
