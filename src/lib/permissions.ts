import { Role, ClientEmployeeRole, PermissionKey, User } from "@/types";
import { getRoleDisplay, getRoleBadgeStyle } from "./roleDisplay";

export { getRoleDisplay, getRoleBadgeStyle };

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
    "orders:operate",
    "verification:operate"
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

/**
 * Authoritative default granular permissions by ClientEmployeeRole
 */
export const DEFAULT_CLIENT_ROLE_PERMISSIONS: Record<ClientEmployeeRole, PermissionKey[]> = {
  MD: [
    "ORDERS_VIEW",
    "ORDERS_PROCESS",
    "ORDERS_DISPATCH",
    "DELIVERY_VERIFY",
    "INVENTORY_VERIFY",
    "INVOICES_VIEW",
    "INVOICES_MANAGE",
    "ACCOUNTS_VIEW",
    "PAYMENTS_VIEW",
    "PAYMENTS_RECORD",
    "PAYMENT_PROOF_UPLOAD",
    "REPORTS_VIEW"
  ],
  GM: [
    "ORDERS_VIEW",
    "ORDERS_PROCESS",
    "ORDERS_DISPATCH",
    "DELIVERY_VERIFY",
    "INVENTORY_VERIFY",
    "INVOICES_VIEW",
    "INVOICES_MANAGE",
    "ACCOUNTS_VIEW",
    "PAYMENTS_VIEW",
    "PAYMENTS_RECORD",
    "PAYMENT_PROOF_UPLOAD",
    "REPORTS_VIEW"
  ],
  MANAGER: [
    "ORDERS_VIEW",
    "ORDERS_PROCESS",
    "ORDERS_DISPATCH",
    "DELIVERY_VERIFY",
    "INVENTORY_VERIFY",
    "INVOICES_VIEW",
    "INVOICES_MANAGE",
    "ACCOUNTS_VIEW",
    "PAYMENTS_VIEW",
    "PAYMENTS_RECORD",
    "PAYMENT_PROOF_UPLOAD",
    "REPORTS_VIEW"
  ],
  RECEIVER: [
    "ORDERS_VIEW",
    "DELIVERY_VERIFY"
  ],
  STORE: [
    "ORDERS_VIEW",
    "INVENTORY_VERIFY"
  ],
  ACCOUNT: [
    "INVOICES_VIEW",
    "INVOICES_MANAGE",
    "ACCOUNTS_VIEW",
    "PAYMENTS_VIEW",
    "PAYMENTS_RECORD",
    "PAYMENT_PROOF_UPLOAD"
  ]
};

export function hasPermission(role: Role, permission: string, user?: Partial<User> | null): boolean {
  if (role === "PLATFORM_ADMIN") return true;
  if (role === "CLIENT" && user) {
    if (hasClientPermission(user, permission as PermissionKey)) return true;
  }
  return permissions[role]?.includes(permission) ?? false;
}

/**
 * Check if a client user has a specific granular permission key.
 * Authoritatively inspects:
 * 1. user.permissions (from rpc_get_my_permissions)
 * 2. user.clientEmployee.roleDefinition.permissions (from RoleDefinition/RolePermission)
 * 3. Built-in default permissions for the employeeRole as fallback
 */
export function hasClientPermission(
  actorOrRole?: Partial<User> | ClientEmployeeRole | string | null,
  permissionKey?: PermissionKey
): boolean {
  if (!actorOrRole || !permissionKey) return false;

  if (typeof actorOrRole === "object") {
    if (actorOrRole.status === "INACTIVE" || actorOrRole.clientEmployee?.status === "INACTIVE") {
      return false;
    }

    // 1. Authoritative resolved permissions array (from rpc_get_my_permissions / User.permissions)
    const userPerms = (actorOrRole as any).permissions;
    if (Array.isArray(userPerms) && userPerms.length > 0) {
      return userPerms.includes(permissionKey);
    }

    // 2. Check if user.clientEmployee has loaded roleDefinition with permissions
    const roleDef = actorOrRole.clientEmployee?.roleDefinition;
    if (roleDef && Array.isArray(roleDef.permissions) && roleDef.permissions.length > 0) {
      return roleDef.permissions.some(
        (p: any) => (p.key || p.permission?.key) === permissionKey
      );
    }

    // 3. Fallback to employeeRole resolution using DEFAULT_CLIENT_ROLE_PERMISSIONS
    const roleKey = getClientEmployeeRole(actorOrRole);
    if (!roleKey) return false;
    const perms = DEFAULT_CLIENT_ROLE_PERMISSIONS[roleKey];
    return perms ? perms.includes(permissionKey) : false;
  }

  // String role key passed directly
  const roleKey = actorOrRole.toUpperCase() as ClientEmployeeRole;
  const perms = DEFAULT_CLIENT_ROLE_PERMISSIONS[roleKey];
  return perms ? perms.includes(permissionKey) : false;
}

/**
 * Helper to extract client employee role from user object
 */
export function getClientEmployeeRole(user?: Partial<User> | null): ClientEmployeeRole | null {
  if (!user) return null;
  const rawRole =
    user.clientEmployee?.employeeRole ||
    (user as any).client?.employeeRole ||
    null;
  return rawRole as ClientEmployeeRole | null;
}

/**
 * Delivery verification authorization helper:
 * Evaluates DELIVERY_VERIFY permission for client employees.
 * Platform and warehouse operations staff retain administrative access.
 */
export function canVerifyDelivery(user?: Partial<User> | null): boolean {
  if (!user) return false;
  if (user.status === "INACTIVE" || user.clientEmployee?.status === "INACTIVE") return false;
  if (
    user.role === "PLATFORM_ADMIN" ||
    user.role === "WAREHOUSE_OWNER" ||
    user.role === "WAREHOUSE_MODERATOR" ||
    user.role === "WAREHOUSE_STAFF"
  ) {
    return true;
  }
  if (user.role === "CLIENT") {
    return hasClientPermission(user, "DELIVERY_VERIFY");
  }
  return false;
}

/**
 * Store / Inventory verification authorization helper:
 * Evaluates INVENTORY_VERIFY permission for client employees.
 * Platform and warehouse operations staff retain administrative access.
 */
export function canVerifyInventory(user?: Partial<User> | null): boolean {
  if (!user) return false;
  if (user.status === "INACTIVE" || user.clientEmployee?.status === "INACTIVE") return false;
  if (
    user.role === "PLATFORM_ADMIN" ||
    user.role === "WAREHOUSE_OWNER" ||
    user.role === "WAREHOUSE_MODERATOR" ||
    user.role === "WAREHOUSE_STAFF"
  ) {
    return true;
  }
  if (user.role === "CLIENT") {
    return hasClientPermission(user, "INVENTORY_VERIFY");
  }
  return false;
}

/**
 * Payment recording authorization helper:
 * Evaluates PAYMENTS_RECORD permission for client employees.
 * Warehouse accounting team / accountant retain administrative payment access.
 */
export function canRecordPayment(user?: Partial<User> | null): boolean {
  if (!user) return false;
  if (user.status === "INACTIVE" || user.clientEmployee?.status === "INACTIVE") return false;
  if (
    user.role === "PLATFORM_ADMIN" ||
    user.role === "WAREHOUSE_OWNER" ||
    user.role === "ACCOUNTANT" ||
    user.role === "ACCOUNTS_TEAM" ||
    user.role === "CLIENT_ACCOUNTANT"
  ) {
    return true;
  }
  if (user.role === "CLIENT") {
    return hasClientPermission(user, "PAYMENTS_RECORD");
  }
  return false;
}

/**
 * Payment proof upload authorization helper:
 * MD, GM, MANAGER, ACCOUNT can upload payment proof.
 */
export function canUploadPaymentProof(user?: Partial<User> | null): boolean {
  if (!user) return false;
  if (user.status === "INACTIVE" || user.clientEmployee?.status === "INACTIVE") return false;
  if (
    user.role === "PLATFORM_ADMIN" ||
    user.role === "WAREHOUSE_OWNER" ||
    user.role === "ACCOUNTANT" ||
    user.role === "ACCOUNTS_TEAM" ||
    user.role === "CLIENT_ACCOUNTANT"
  ) {
    return true;
  }
  if (user.role === "CLIENT") {
    return (
      hasClientPermission(user, "PAYMENT_PROOF_UPLOAD") ||
      hasClientPermission(user, "PAYMENTS_RECORD")
    );
  }
  return false;
}

/**
 * Order view authorization helper:
 * MD, GM, MANAGER, RECEIVER, STORE can view orders.
 * ACCOUNT cannot view orders directly (accounting only).
 */
export function canViewOrders(user?: Partial<User> | null): boolean {
  if (!user) return false;
  if (user.role !== "CLIENT") return true;
  const empRole = getClientEmployeeRole(user);
  if (!empRole) return true; // generic client
  return ["MD", "GM", "MANAGER", "RECEIVER", "STORE"].includes(empRole);
}

/**
 * Invoices and accounting authorization helper:
 * MD, GM, MANAGER, ACCOUNT can access invoices/accounting.
 * RECEIVER and STORE cannot access accounting.
 */
export function canAccessAccounting(user?: Partial<User> | null): boolean {
  if (!user) return false;
  if (user.role === "PLATFORM_ADMIN" || user.role === "WAREHOUSE_OWNER" || user.role === "ACCOUNTANT" || user.role === "ACCOUNTS_TEAM" || user.role === "CLIENT_ACCOUNTANT") {
    return true;
  }
  if (user.role === "CLIENT") {
    const empRole = getClientEmployeeRole(user);
    if (!empRole) return true;
    return ["ACCOUNT", "MANAGER", "GM", "MD"].includes(empRole);
  }
  return false;
}

export type DashboardType =
  | "WAREHOUSE_STAFF"
  | "CLIENT_RECEIVER"
  | "CLIENT_STORE"
  | "CLIENT_ACCOUNT"
  | "CLIENT_MANAGEMENT"
  | "WAREHOUSE_OVERVIEW";

export function resolveDashboardType(
  role: Role,
  employeeRole?: ClientEmployeeRole | null
): DashboardType {
  if (role === "WAREHOUSE_STAFF") {
    return "WAREHOUSE_STAFF";
  }
  if (role === "CLIENT") {
    if (employeeRole === "RECEIVER") return "CLIENT_RECEIVER";
    if (employeeRole === "STORE") return "CLIENT_STORE";
    if (employeeRole === "ACCOUNT") return "CLIENT_ACCOUNT";
    return "CLIENT_MANAGEMENT";
  }
  if (role === "ACCOUNTS_TEAM" || role === "ACCOUNTANT" || role === "CLIENT_ACCOUNTANT") {
    return "CLIENT_ACCOUNT";
  }
  return "WAREHOUSE_OVERVIEW";
}

export function canAccessRoute(
  role: Role,
  route: string,
  employeeRole?: ClientEmployeeRole | null
): boolean {
  if (role === "PLATFORM_ADMIN") return true;

  if (role === "CLIENT") {
    if (employeeRole === "RECEIVER" || employeeRole === "STORE") {
      // Operations and dashboard only; strictly no accounting or warehouse admin
      return ["/dashboard", "/operations/orders", "/orders", "/notifications", "/profile"].some(
        (r) => route === r || route.startsWith(r + "/")
      );
    }

    if (employeeRole === "ACCOUNT") {
      // Accounting and dashboard only; strictly no delivery operations or warehouse admin
      return ["/dashboard", "/accounting", "/invoices", "/notifications", "/profile"].some(
        (r) => route === r || route.startsWith(r + "/")
      );
    }

    // MD, GM, MANAGER (and unassigned CLIENT) have full client access; strictly no warehouse admin
    return [
      "/dashboard",
      "/operations/orders",
      "/orders",
      "/accounting",
      "/invoices",
      "/reports",
      "/notifications",
      "/profile"
    ].some((r) => route === r || route.startsWith(r + "/"));
  }

  if (role === "WAREHOUSE_STAFF") {
    return ["/dashboard", "/operations/orders", "/orders", "/operations/inventory", "/notifications", "/profile"].some(
      (r) => route === r || route.startsWith(r + "/")
    );
  }

  if (role === "CLIENT_ACCOUNTANT") {
    return ["/dashboard", "/accounting", "/invoices", "/reports", "/notifications", "/profile"].some(
      (r) => route === r || route.startsWith(r + "/")
    );
  }

  if (role === "ACCOUNTS_TEAM" || role === "ACCOUNTANT") {
    return [
      "/dashboard",
      "/operations/orders",
      "/orders",
      "/accounting",
      "/invoices",
      "/reports",
      "/notifications",
      "/profile"
    ].some((r) => route === r || route.startsWith(r + "/"));
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
