import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { OrdersPage } from "@/pages/operations/OrdersPage";
import { OrderDetailPage } from "@/pages/operations/OrderDetailPage";
import { InventoryPage } from "@/pages/operations/InventoryPage";
import { ClientsPage } from "@/pages/operations/ClientsPage";
import { AccountingPage } from "@/pages/accounting/AccountingPage";
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

          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Operations */}
            <Route path="operations" element={<Navigate to="/operations/orders" replace />} />
            <Route path="operations/orders" element={<OrdersPage />} />
            <Route path="operations/orders/:id" element={<OrderDetailPage />} />
            <Route path="operations/inventory" element={<InventoryPage />} />
            <Route path="operations/clients" element={<ClientsPage />} />

            {/* Accounting */}
            <Route path="accounting" element={<AccountingPage />} />
            <Route path="accounting/invoices/:id" element={<OrderDetailPage />} />

            {/* Reports */}
            <Route path="reports" element={<ReportsPage />} />

            {/* Notifications */}
            <Route path="notifications" element={<NotificationsPage />} />

            {/* Admin Console */}
            <Route path="admin" element={<AdminDashboardPage />} />
            <Route path="admin-dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="platform" element={<Navigate to="/admin" replace />} />

            {/* Settings & Profile */}
            <Route path="settings" element={<SettingsPage />} />
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
