import { Role, ClientEmployeeRole, User } from "@/types";

export interface RoleDisplaySubject {
  role?: Role | string | null;
  clientEmployee?: {
    employeeRole?: ClientEmployeeRole | string | null;
  } | null;
  client?: {
    employeeRole?: ClientEmployeeRole | string | null;
  } | null;
}

/**
 * Authoritative, reusable role display formatter.
 *
 * Formats roles consistently across the entire application:
 * - CLIENT with employeeRole -> "CLIENT / MD", "CLIENT / GM", "CLIENT / MANAGER", "CLIENT / STORE", "CLIENT / RECEIVER", "CLIENT / ACCOUNT"
 * - CLIENT without employeeRole -> "CLIENT"
 * - CLIENT_ACCOUNTANT -> "CLIENT / ACCOUNT"
 * - PLATFORM_ADMIN -> "PLATFORM ADMIN"
 * - WAREHOUSE_OWNER -> "WAREHOUSE OWNER"
 * - WAREHOUSE_MODERATOR -> "WAREHOUSE MODERATOR"
 * - WAREHOUSE_STAFF -> "WAREHOUSE STAFF"
 * - ACCOUNTANT -> "ACCOUNTANT"
 * - ACCOUNTS_TEAM -> "ACCOUNTS TEAM"
 *
 * Never outputs PRODUCT_RECEIVER.
 */
export function getRoleDisplay(
  subjectOrRole?: RoleDisplaySubject | Role | string | null,
  fallbackEmployeeRole?: ClientEmployeeRole | string | null
): string {
  if (!subjectOrRole) return "USER";

  let baseRole: string = "";
  let empRole: string | null = null;

  if (typeof subjectOrRole === "string") {
    baseRole = subjectOrRole;
    empRole = fallbackEmployeeRole || null;
  } else {
    baseRole = subjectOrRole.role || "";
    empRole =
      fallbackEmployeeRole ||
      subjectOrRole.clientEmployee?.employeeRole ||
      subjectOrRole.client?.employeeRole ||
      null;
  }

  const normalizedRole = baseRole.toUpperCase().trim();
  const normalizedEmpRole = empRole ? empRole.toUpperCase().trim() : null;

  // Handle Client Users
  if (normalizedRole === "CLIENT") {
    if (normalizedEmpRole) {
      // Map valid ClientEmployeeRole
      switch (normalizedEmpRole) {
        case "MD":
          return "CLIENT / MD";
        case "GM":
          return "CLIENT / GM";
        case "MANAGER":
          return "CLIENT / MANAGER";
        case "STORE":
          return "CLIENT / STORE";
        case "RECEIVER":
          return "CLIENT / RECEIVER";
        case "ACCOUNT":
          return "CLIENT / ACCOUNT";
        default:
          return `CLIENT / ${normalizedEmpRole.replace(/_/g, " ")}`;
      }
    }
    return "CLIENT";
  }

  // Handle Client Accountant
  if (normalizedRole === "CLIENT_ACCOUNTANT") {
    return "CLIENT / ACCOUNT";
  }

  // Handle Standard Roles
  switch (normalizedRole) {
    case "PLATFORM_ADMIN":
      return "PLATFORM ADMIN";
    case "WAREHOUSE_OWNER":
      return "WAREHOUSE OWNER";
    case "WAREHOUSE_MODERATOR":
      return "WAREHOUSE MODERATOR";
    case "WAREHOUSE_STAFF":
      return "WAREHOUSE STAFF";
    case "ACCOUNTANT":
      return "ACCOUNTANT";
    case "ACCOUNTS_TEAM":
      return "ACCOUNTS TEAM";
    default:
      return normalizedRole.replace(/_/g, " ");
  }
}

/**
 * Badge style mapping helper for consistent badge coloring.
 */
export function getRoleBadgeStyle(
  subjectOrRole?: RoleDisplaySubject | Role | string | null,
  fallbackEmployeeRole?: ClientEmployeeRole | string | null
): string {
  const display = getRoleDisplay(subjectOrRole, fallbackEmployeeRole);

  if (display.startsWith("PLATFORM ADMIN")) {
    return "bg-purple-950 text-purple-300 border-purple-800";
  }
  if (display.startsWith("WAREHOUSE OWNER")) {
    return "bg-indigo-950 text-indigo-300 border-indigo-800";
  }
  if (display.startsWith("WAREHOUSE MODERATOR")) {
    return "bg-blue-950 text-blue-300 border-blue-800";
  }
  if (display.startsWith("WAREHOUSE STAFF")) {
    return "bg-emerald-950 text-emerald-300 border-emerald-800";
  }
  if (display.startsWith("ACCOUNTANT") || display.startsWith("ACCOUNTS TEAM")) {
    return "bg-amber-950 text-amber-300 border-amber-800";
  }
  if (display.startsWith("CLIENT")) {
    return "bg-teal-950 text-teal-300 border-teal-800";
  }

  return "bg-slate-800 text-slate-300 border-slate-700";
}
