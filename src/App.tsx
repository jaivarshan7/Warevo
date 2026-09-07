import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { OrdersPage } from "@/pages/operations/OrdersPage";
import { InvoiceImportPage } from "@/pages/operations/InvoiceImportPage";
import { OrderDetailPage } from "@/pages/operations/OrderDetailPage";
import { OrderTrackPage } from "@/pages/operations/OrderTrackPage";
import { InventoryPage } from "@/pages/operations/InventoryPage";
import { ClientsPage } from "@/pages/operations/ClientsPage";
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

          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Operations */}
            <Route path="operations" element={<Navigate to="/operations/orders" replace />} />
            <Route path="operations/orders" element={<OrdersPage />} />
            <Route path="operations/orders/import" element={<InvoiceImportPage />} />
            <Route path="operations/orders/track" element={<OrderTrackPage />} />
            <Route path="operations/orders/:id" element={<OrderDetailPage />} />
            <Route path="operations/inventory" element={<InventoryPage />} />
            <Route path="operations/clients" element={<ClientsPage />} />

            {/* Accounting */}
            <Route path="accounting" element={<AccountingPage />} />
            <Route path="accounting/invoices/:id" element={<InvoiceDetailPage />} />

            {/* Change Log */}
            <Route path="change-log" element={<ChangeLogPage />} />
            <Route path="dashboard/change-log" element={<Navigate to="/change-log" replace />} />

            {/* Reports */}
            <Route path="reports" element={<ReportsPage />} />

            {/* Notifications */}
            <Route path="notifications" element={<NotificationsPage />} />

            {/* Admin Console & Platform Overview */}
            <Route path="admin" element={<AdminDashboardPage />} />
            <Route path="admin-dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="platform" element={<PlatformOverviewPage />} />

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
