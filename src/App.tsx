import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoginPage } from "@/pages/auth/LoginPage";
import { AuthCallbackPage } from "@/pages/auth/AuthCallbackPage";
import { UpdatePasswordPage } from "@/pages/auth/UpdatePasswordPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { OrdersPage } from "@/pages/operations/OrdersPage";
import { OrderCreatePage } from "@/pages/operations/OrderCreatePage";
import { OrderEditPage } from "@/pages/operations/OrderEditPage";
import { InvoiceImportPage } from "@/pages/operations/InvoiceImportPage";
import { OrderDetailPage } from "@/pages/operations/OrderDetailPage";
import { OrderTrackPage } from "@/pages/operations/OrderTrackPage";
import { InventoryPage } from "@/pages/operations/InventoryPage";
import { ClientsPage } from "@/pages/operations/ClientsPage";
import { EmployeesPage } from "@/pages/operations/EmployeesPage";
import { AccountingPage } from "@/pages/accounting/AccountingPage";
import { InvoiceDetailPage } from "@/pages/accounting/InvoiceDetailPage";
import { ChangeLogPage } from "@/pages/audit/ChangeLogPage";
import { PlatformOverviewPage } from "@/pages/admin/PlatformOverviewPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { NotificationsPage } from "@/pages/notifications/NotificationsPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/update-password" element={<UpdatePasswordPage />} />

          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Operations - Protected for specific roles */}
            <Route path="operations" element={<Navigate to="/operations/orders" replace />} />
            <Route
              path="operations/orders"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF", "CLIENT", "CLIENT_ACCOUNTANT", "ACCOUNTS_TEAM", "ACCOUNTANT"]}>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="operations/orders/new"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"]}>
                  <OrderCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="operations/orders/import"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR"]}>
                  <InvoiceImportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="operations/orders/track"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF", "CLIENT"]}>
                  <OrderTrackPage />
                </ProtectedRoute>
              }
            />
            <Route path="orders" element={<Navigate to="/operations/orders" replace />} />
            <Route
              path="orders/:id"
              element={
                <ProtectedRoute>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="operations/orders/:id/edit"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"]}>
                  <OrderEditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="operations/orders/:id"
              element={
                <ProtectedRoute>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="operations/inventory"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"]}>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="operations/clients"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR"]}>
                  <ClientsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="operations/employees"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR"]}>
                  <EmployeesPage />
                </ProtectedRoute>
              }
            />

            {/* Employees route (alias) */}
            <Route
              path="employees"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR"]}>
                  <EmployeesPage />
                </ProtectedRoute>
              }
            />

            {/* Accounting */}
            <Route
              path="accounting"
              element={
                <ProtectedRoute>
                  <AccountingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="accounting/invoices/:id"
              element={
                <ProtectedRoute>
                  <InvoiceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="invoices/:id"
              element={
                <ProtectedRoute>
                  <InvoiceDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Change Log */}
            <Route path="change-log" element={<ChangeLogPage />} />
            <Route path="dashboard/change-log" element={<Navigate to="/change-log" replace />} />

            {/* Reports */}
            <Route
              path="reports"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />

            {/* Notifications */}
            <Route path="notifications" element={<NotificationsPage />} />

            {/* Admin Console & Platform Overview - Protected */}
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN"]}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="admin-dashboard" element={<Navigate to="/admin" replace />} />
            <Route
              path="platform"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN"]}>
                  <PlatformOverviewPage />
                </ProtectedRoute>
              }
            />

            {/* Settings & Profile */}
            <Route
              path="settings"
              element={
                <ProtectedRoute allowedRoles={["PLATFORM_ADMIN", "WAREHOUSE_OWNER"]}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="profile" element={<ProfilePage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
