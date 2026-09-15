import { AuditLog } from "@/types";

/**
 * Formats currency value in Indian Rupees
 */
function formatCurrency(value: number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

/**
 * Maps action types to human-readable descriptions
 */
const ACTION_DESCRIPTIONS: Record<string, string> = {
  CREATE_ORDER: "Created order",
  UPDATE_ORDER: "Updated order",
  CREATE_INVOICE: "Created invoice",
  UPDATE_INVOICE: "Updated invoice",
  RECORD_PAYMENT: "Recorded payment",
  CREATE_USER: "Created user",
  UPDATE_USER_ROLE: "Updated user role",
  DEACTIVATE_USER: "Deactivated user",
  ACTIVATE_USER: "Activated user",
  CREATE_EMPLOYEE: "Created employee",
  CREATE_CLIENT_EMPLOYEE: "Created client employee",
  UPDATE_INVENTORY: "Updated inventory",
  CREATE_PRODUCT: "Created product",
  UPDATE_PRODUCT: "Updated product",
  CREATE_CLIENT: "Created client",
  UPDATE_CLIENT: "Updated client"
};

/**
 * Maps entity types to display names
 */
const ENTITY_NAMES: Record<string, string> = {
  Order: "Order",
  Invoice: "Invoice",
  User: "User",
  Inventory: "Inventory",
  Product: "Product",
  Client: "Client",
  Tenant: "Tenant"
};

/**
 * Formats a value for display, handling objects, arrays, and primitives
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Extracts readable details from audit log previous/next values
 */
function extractDetails(log: AuditLog): {
  actionText: string;
  detailText: string;
  extraFields: Array<{ label: string; value: string }>;
} {
  const prev = log.previousValue;
  const next = log.newValue;

  // Handle role changes
  if (log.action === "UPDATE_USER_ROLE") {
    const prevRole = typeof prev === "object" && prev !== null ? (prev as any).role : prev;
    const nextRole = typeof next === "object" && next !== null ? (next as any).role : next;
    return {
      actionText: "Updated",
      detailText: `Changed user role from ${prevRole || "N/A"} to ${nextRole || "N/A"}`,
      extraFields: []
    };
  }

  // Handle order creation with invoice
  if (log.action === "CREATE_ORDER" && next && typeof next === "object") {
    const nextObj = next as any;
    const fields: Array<{ label: string; value: string }> = [];
    
    if (nextObj.orderNumber) {
      fields.push({ label: "Order", value: nextObj.orderNumber });
    }
    if (nextObj.totalAmount !== undefined) {
      fields.push({ label: "Amount", value: formatCurrency(nextObj.totalAmount) });
    }
    if (nextObj.status) {
      fields.push({ label: "Status", value: nextObj.status });
    }
    
    return {
      actionText: "Created",
      detailText: "Created order with final invoice",
      extraFields: fields
    };
  }

  // Handle payment recording
  if (log.action === "RECORD_PAYMENT") {
    const fields: Array<{ label: string; value: string }> = [];
    
    if (next && typeof next === "object") {
      const nextObj = next as any;
      if (nextObj.amount !== undefined) {
        fields.push({ label: "Amount", value: formatCurrency(nextObj.amount) });
      }
      if (nextObj.paymentStatus) {
        fields.push({ label: "Payment status", value: nextObj.paymentStatus });
      }
      if (nextObj.orderNumber) {
        fields.push({ label: "Order", value: nextObj.orderNumber });
      }
    }
    
    return {
      actionText: "Recorded",
      detailText: "Recorded payment",
      extraFields: fields
    };
  }

  // Handle employee/client creation
  if (log.action === "CREATE_EMPLOYEE" || log.action === "CREATE_CLIENT_EMPLOYEE") {
    const fields: Array<{ label: string; value: string }> = [];
    
    if (next && typeof next === "object") {
      const nextObj = next as any;
      if (nextObj.email) {
        fields.push({ label: "Email", value: nextObj.email });
      }
      if (nextObj.mobile) {
        fields.push({ label: "Mobile", value: nextObj.mobile });
      }
      if (nextObj.role) {
        fields.push({ label: "Role", value: nextObj.role });
      }
    }
    
    return {
      actionText: "Created",
      detailText: log.action === "CREATE_CLIENT_EMPLOYEE" ? "Created client employee" : "Created employee",
      extraFields: fields
    };
  }

  // Handle generic updates
  if (log.action.startsWith("UPDATE_")) {
    const fields: Array<{ label: string; value: string }> = [];
    
    // Extract changed fields by comparing prev and next
    if (prev && next && typeof prev === "object" && typeof next === "object") {
      const prevObj = prev as Record<string, any>;
      const nextObj = next as Record<string, any>;
      const allKeys = new Set([...Object.keys(prevObj || {}), ...Object.keys(nextObj || {})]);
      
      allKeys.forEach(key => {
        if (key === "updatedAt" || key === "id") return; // Skip metadata fields
        const prevVal = prevObj?.[key];
        const nextVal = nextObj?.[key];
        if (prevVal !== nextVal) {
          fields.push({ 
            label: key.charAt(0).toUpperCase() + key.slice(1), 
            value: `${formatValue(prevVal)} → ${formatValue(nextVal)}`
          });
        }
      });
    }
    
    return {
      actionText: "Updated",
      detailText: `Updated ${ENTITY_NAMES[log.entity] || log.entity.toLowerCase()}`,
      extraFields: fields
    };
  }

  // Handle creation actions
  if (log.action.startsWith("CREATE_")) {
    const fields: Array<{ label: string; value: string }> = [];
    
    if (next && typeof next === "object") {
      const nextObj = next as Record<string, any>;
      Object.entries(nextObj).forEach(([key, value]) => {
        if (key === "id" || key === "createdAt" || key === "updatedAt") return;
        if (typeof value !== "object" && value !== null) {
          fields.push({ 
            label: key.charAt(0).toUpperCase() + key.slice(1), 
            value: formatValue(value)
          });
        }
      });
    }
    
    return {
      actionText: "Created",
      detailText: `Created ${ENTITY_NAMES[log.entity] || log.entity.toLowerCase()}`,
      extraFields: fields.slice(0, 5) // Limit to 5 fields
    };
  }

  // Default fallback
  return {
    actionText: log.action.replace(/_/g, " "),
    detailText: `${log.action} on ${log.entity}`,
    extraFields: []
  };
}

/**
 * Formats an audit log entry for human-readable display
 */
export function formatAuditLogEntry(log: AuditLog): {
  actionText: string;
  detailText: string;
  entityName: string;
  extraFields: Array<{ label: string; value: string }>;
  userName: string;
  roleName: string;
  timestamp: string;
} {
  const { actionText, detailText, extraFields } = extractDetails(log);
  
  const userName = log.user?.name || "System Automated";
  const roleName = log.userRole?.replace(/_/g, " ") || "SYSTEM";
  const timestamp = new Date(log.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  return {
    actionText,
    detailText,
    entityName: ENTITY_NAMES[log.entity] || log.entity,
    extraFields,
    userName,
    roleName,
    timestamp
  };
}

/**
 * Formats order status for display
 */
export function formatOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    DRAFT: "Draft",
    ISSUED: "Order Issued",
    DISPATCHED: "Dispatched",
    RECEIVED: "Received",
    VERIFICATION_PENDING: "Verification Pending",
    VERIFIED: "Verified",
    PARTIALLY_VERIFIED: "Partially Verified",
    REJECTED: "Rejected",
    INVOICED: "Invoiced",
    DELIVERED: "Delivered"
  };
  return statusMap[status] || status.replace(/_/g, " ");
}

/**
 * Gets description for order status
 */
export function getOrderStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    DRAFT: "Order is being prepared",
    ISSUED: "Order has been issued and is ready for processing",
    DISPATCHED: "Order has been dispatched to the client",
    RECEIVED: "Order has been received at the warehouse",
    VERIFICATION_PENDING: "Order is ready for client verification",
    VERIFIED: "Client has verified the delivered order",
    PARTIALLY_VERIFIED: "Order has been partially verified with discrepancies",
    REJECTED: "Order has been rejected due to issues",
    INVOICED: "Invoice has been generated for this order",
    DELIVERED: "Order has been delivered to the client"
  };
  return descriptions[status] || "";
}
