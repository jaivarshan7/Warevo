import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, canAccessRoute, canAccessTenant } from "@/lib/permissions";

export function usePermissions() {
  const { user, tenant, role } = useAuth();

  return {
    role,
    user,
    tenant,
    can: (permission: string) => hasPermission(role, permission),
    canRoute: (route: string) => canAccessRoute(role, route, user?.clientEmployee?.employeeRole || user?.client?.employeeRole),
    canTenant: (resourceTenantId: string) => canAccessTenant(role, user?.tenantId, resourceTenantId)
  };
}
