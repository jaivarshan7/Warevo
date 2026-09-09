import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Role } from "@/types";
import { hasPermission } from "@/lib/permissions";

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

  // Still loading auth state
  if (isLoading) {
    return null;
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={fallbackPath} replace />;
  }

  // Check permission-based access
  if (requirePermission && !hasPermission(role, requirePermission)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};
