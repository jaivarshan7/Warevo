import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Role } from "@/types";
import { hasPermission } from "@/lib/permissions";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
  requirePermission?: string;
  fallbackPath?: string;
}

/**
 * ProtectedRoute component that checks user authorization before rendering children.
 * If user doesn't have permission, redirects to fallback path (default: /dashboard).
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requirePermission,
  fallbackPath = "/dashboard"
}) => {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();

  console.debug("[ProtectedRoute] pathname:", location.pathname);
  console.debug("[ProtectedRoute] loading:", isLoading);
  console.debug("[ProtectedRoute] user exists:", Boolean(user));

  // Still loading auth state
  if (isLoading) {
    console.debug("[ProtectedRoute] redirect decision: loading screen (hydrating auth)");
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner message="Verifying session..." />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    console.debug("[ProtectedRoute] redirect decision: redirecting to /login (no user)");
    return <Navigate to="/login" replace />;
  }

  // Only genuine INACTIVE status directs to ?error=inactive
  if (user.status === "INACTIVE" || (user.clientEmployee && user.clientEmployee.status === "INACTIVE")) {
    console.debug("[ProtectedRoute] redirect decision: redirecting to /login?error=inactive (inactive user/employee)");
    return <Navigate to="/login?error=inactive" replace />;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(role)) {
    console.debug("[ProtectedRoute] redirect decision: redirecting to fallback (role unauthorized)", fallbackPath);
    return <Navigate to={fallbackPath} replace />;
  }

  // Check permission-based access
  if (requirePermission && !hasPermission(role, requirePermission)) {
    console.debug("[ProtectedRoute] redirect decision: redirecting to fallback (permission denied)", fallbackPath);
    return <Navigate to={fallbackPath} replace />;
  }

  console.debug("[ProtectedRoute] redirect decision: authorized -> rendering children");
  return <>{children}</>;
};
