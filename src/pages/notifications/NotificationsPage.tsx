import React, { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Bell,
  Check,
  ExternalLink,
  Filter,
  Package,
  CircleDollarSign,
  AlertTriangle,
  CheckCircle2,
  Truck,
  FileText,
  CreditCard,
  ShieldCheck,
  XCircle,
  RefreshCw
} from "lucide-react";
import { Link } from "react-router-dom";
import { NotificationType } from "@/types";

function getNotifStyle(type?: string | null) {
  const t = (type || "").toUpperCase();
  switch (t) {
    case "NEW_ORDER":
    case "ORDER_ISSUED":
      return {
        icon: Package,
        bg: "bg-blue-600/20",
        text: "text-blue-400",
        border: "border-blue-500/30"
      };
    case "PROCESSING_STARTED":
    case "READY_FOR_DISPATCH":
      return {
        icon: RefreshCw,
        bg: "bg-amber-600/20",
        text: "text-amber-400",
        border: "border-amber-500/30"
      };
    case "ORDER_DISPATCHED":
      return {
        icon: Truck,
        bg: "bg-cyan-600/20",
        text: "text-cyan-400",
        border: "border-cyan-500/30"
      };
    case "CLIENT_RECEIVED_ORDER":
    case "CLIENT_COMPLETED_VERIFICATION":
    case "VERIFICATION_COMPLETED":
      return {
        icon: ShieldCheck,
        bg: "bg-emerald-600/20",
        text: "text-emerald-400",
        border: "border-emerald-500/30"
      };
    case "CLIENT_STARTED_VERIFICATION":
      return {
        icon: CheckCircle2,
        bg: "bg-teal-600/20",
        text: "text-teal-400",
        border: "border-teal-500/30"
      };
    case "CLIENT_REJECTED_ORDER":
      return {
        icon: XCircle,
        bg: "bg-rose-600/20",
        text: "text-rose-400",
        border: "border-rose-500/30"
      };
    case "DAMAGE_REPORTED":
    case "MISSING_ITEMS_REPORTED":
      return {
        icon: AlertTriangle,
        bg: "bg-red-600/20",
        text: "text-red-400",
        border: "border-red-500/30"
      };
    case "INVOICE_GENERATED":
    case "INVOICE_SENT":
      return {
        icon: FileText,
        bg: "bg-violet-600/20",
        text: "text-violet-400",
        border: "border-violet-500/30"
      };
    case "PAYMENT_RECEIVED":
      return {
        icon: CreditCard,
        bg: "bg-emerald-600/20",
        text: "text-emerald-400",
        border: "border-emerald-500/30"
      };
    case "PAYMENT_OVERDUE":
      return {
        icon: CircleDollarSign,
        bg: "bg-orange-600/20",
        text: "text-orange-400",
        border: "border-orange-500/30"
      };
    case "ORDER_COMPLETED":
      return {
        icon: CheckCircle2,
        bg: "bg-green-600/20",
        text: "text-green-400",
        border: "border-green-500/30"
      };
    default:
      return {
        icon: Bell,
        bg: "bg-indigo-600/20",
        text: "text-indigo-400",
        border: "border-indigo-500/30"
      };
  }
}

function getPriorityBadge(priority?: string | null) {
  const p = (priority || "").toUpperCase();
  switch (p) {
    case "HIGH":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/50 uppercase tracking-wider">
          High
        </span>
      );
    case "MEDIUM":
    case "NORMAL":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/50 uppercase tracking-wider">
          Med
        </span>
      );
    case "LOW":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">
          Low
        </span>
      );
    default:
      return null;
  }
}

function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return "Recently";
  try {
    const now = new Date();
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently";
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return "Just now";
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "Recently";
  }
}

function formatFullDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  } catch {
    return "";
  }
}

export const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, isLoading, markAsRead, refresh } = useNotifications();
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  if (isLoading) return <LoadingSpinner message="Retrieving notification stream..." />;

  const displayed = filterUnreadOnly ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Notification Center</h1>
          <p className="text-sm text-slate-400">
            Real-time warehouse alerts, delivery updates, and status transition notices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-xs font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-1 rounded-lg">
              {unreadCount} Unread
            </span>
          )}
          <Button
            variant={filterUnreadOnly ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
            className="gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            {filterUnreadOnly ? "Showing Unread" : "Filter Unread"}
          </Button>
          <Button variant="outline" size="sm" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {displayed.length === 0 ? (
          <EmptyState
            title={filterUnreadOnly ? "No unread notifications" : "All clear — no notifications yet"}
            description={
              filterUnreadOnly
                ? "All your notifications have been read. Turn off the filter to see everything."
                : "Notifications will appear here as orders progress, invoices are generated, and payments are recorded."
            }
          />
        ) : (
          <div className="divide-y divide-slate-800/60">
            {displayed.map((n) => {
              const style = getNotifStyle(n.type);
              const IconComponent = style.icon;

              return (
                <div
                  key={n.id}
                  className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                    !n.read ? "bg-slate-800/30" : "hover:bg-slate-800/10"
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 border ${
                        !n.read
                          ? `${style.bg} ${style.text} ${style.border}`
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white">{n.title}</h3>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        )}
                        {getPriorityBadge(n.priority)}
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{n.message}</p>
                      <span className="text-[10px] text-slate-500 mt-2 block">
                        {formatTimeAgo(n.createdAt)}
                        {n.createdAt && ` · ${formatFullDate(n.createdAt)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!n.read && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-1"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                        <span className="hidden sm:inline">Read</span>
                      </button>
                    )}
                    {n.actionUrl && (
                      <Link
                        to={n.actionUrl}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden sm:inline">Open</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
