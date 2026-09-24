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

export function hasPermission(role: Role, permission: string): boolean {
  if (role === "PLATFORM_ADMIN") return true;
  return permissions[role]?.includes(permission) ?? false;
}

/**
 * Check if a client user has a specific granular permission key
 */
export function hasClientPermission(
  actorOrRole?: Partial<User> | ClientEmployeeRole | string | null,
  permissionKey?: PermissionKey
): boolean {
  if (!actorOrRole || !permissionKey) return false;

  let roleKey: ClientEmployeeRole | null = null;
  if (typeof actorOrRole === "object") {
    if (actorOrRole.status === "INACTIVE" || actorOrRole.clientEmployee?.status === "INACTIVE") {
      return false;
    }
    roleKey = getClientEmployeeRole(actorOrRole);
  } else if (typeof actorOrRole === "string") {
    roleKey = actorOrRole.toUpperCase() as ClientEmployeeRole;
  }

  if (!roleKey) return false;
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
 * RECEIVER, MANAGER, GM, MD can verify delivery.
 * STORE and ACCOUNT cannot verify delivery.
 */
export function canVerifyDelivery(user?: Partial<User> | null): boolean {
  if (!user) return false;
  if (user.status === "INACTIVE" || user.clientEmployee?.status === "INACTIVE") return false;
  if (user.role === "PLATFORM_ADMIN" || user.role === "WAREHOUSE_OWNER" || user.role === "WAREHOUSE_MODERATOR") {
    return true;
  }
  if (user.role === "CLIENT") {
    const empRole = getClientEmployeeRole(user);
    if (!empRole) return false;
    return ["RECEIVER", "MANAGER", "GM", "MD"].includes(empRole);
  }
  return false;
}

/**
 * Store / Inventory verification authorization helper:
 * STORE, MANAGER, GM, MD can verify store inventory.
 * RECEIVER and ACCOUNT cannot verify store inventory.
 */
export function canVerifyInventory(user?: Partial<User> | null): boolean {
  if (!user) return false;
  if (user.status === "INACTIVE" || user.clientEmployee?.status === "INACTIVE") return false;
  if (user.role === "PLATFORM_ADMIN" || user.role === "WAREHOUSE_OWNER" || user.role === "WAREHOUSE_MODERATOR") {
    return true;
  }
  if (user.role === "CLIENT") {
    const empRole = getClientEmployeeRole(user);
    if (!empRole) return false;
    return ["STORE", "MANAGER", "GM", "MD"].includes(empRole);
  }
  return false;
}

/**
 * Payment recording authorization helper:
 * MD, GM, MANAGER, ACCOUNT (and accounting staff) can record payments.
 * RECEIVER and STORE cannot record payments.
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
    const empRole = getClientEmployeeRole(user);
    if (!empRole) return false;
    return ["ACCOUNT", "MANAGER", "GM", "MD"].includes(empRole);
  }
  return false;
}

/**
 * Payment proof upload authorization helper:
 * MD, GM, MANAGER, ACCOUNT can upload payment proof.
 */
export function canUploadPaymentProof(user?: Partial<User> | null): boolean {
  return canRecordPayment(user);
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

export function canAccessRoute(
  role: Role,
  route: string,
  employeeRole?: ClientEmployeeRole | null
): boolean {
  if (role === "PLATFORM_ADMIN") return true;

  if (role === "CLIENT") {
    if (employeeRole === "RECEIVER" || employeeRole === "STORE") {
      // Operations and dashboard only; strictly no accounting
      return ["/dashboard", "/operations/orders", "/notifications", "/profile"].some(
        (r) => route === r || route.startsWith(r + "/")
      );
    }

    if (employeeRole === "ACCOUNT") {
      // Accounting and dashboard only; strictly no delivery operations
      return ["/dashboard", "/accounting", "/notifications", "/profile"].some(
        (r) => route === r || route.startsWith(r + "/")
      );
    }

    // MD, GM, MANAGER (and unassigned CLIENT) have full client access
    return [
      "/dashboard",
      "/operations/orders",
      "/accounting",
      "/reports",
      "/notifications",
      "/profile"
    ].some((r) => route === r || route.startsWith(r + "/"));
  }

  if (role === "WAREHOUSE_STAFF") {
    return ["/dashboard", "/operations/orders", "/operations/inventory", "/notifications", "/profile"].some(
      (r) => route === r || route.startsWith(r + "/")
    );
  }

  if (role === "CLIENT_ACCOUNTANT") {
    return ["/dashboard", "/accounting", "/reports", "/notifications", "/profile"].some(
      (r) => route === r || route.startsWith(r + "/")
    );
  }

  if (role === "ACCOUNTS_TEAM" || role === "ACCOUNTANT") {
    return [
      "/dashboard",
      "/operations/orders",
      "/accounting",
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
