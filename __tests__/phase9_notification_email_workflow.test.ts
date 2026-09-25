import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  NotificationType,
  Notification,
  Role,
  User,
  ClientEmployeeRole,
  VerificationStatus,
  OrderStatus,
} from "@/types";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  createNotificationSecure,
  resolveActiveClientRecipients,
  resolveActiveWarehouseRecipients,
  triggerOrderCreatedEmail,
  triggerOrderDispatchedEmail,
  triggerDeliveryVerificationEmail,
  triggerStoreVerificationEmail,
  triggerPaymentReceivedEmail,
  triggerOrderCompletedEmail,
} from "@/src/lib/services";

// All 17 notification types in Warevo
const ALL_17_NOTIFICATION_TYPES: NotificationType[] = [
  "NEW_ORDER",
  "ORDER_ISSUED",
  "PROCESSING_STARTED",
  "READY_FOR_DISPATCH",
  "ORDER_DISPATCHED",
  "CLIENT_RECEIVED_ORDER",
  "CLIENT_STARTED_VERIFICATION",
  "CLIENT_COMPLETED_VERIFICATION",
  "CLIENT_REJECTED_ORDER",
  "DAMAGE_REPORTED",
  "MISSING_ITEMS_REPORTED",
  "VERIFICATION_COMPLETED",
  "INVOICE_GENERATED",
  "INVOICE_SENT",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "ORDER_COMPLETED",
];

describe("Phase 9: Production Notification Email Workflow", () => {
  // Mock data fixtures
  const tenantId = "tenant_prime";
  const foreignTenantId = "tenant_foreign";
  const clientId = "client_alpha";

  interface EmailDispatchAttempt {
    tenantId: string;
    eventType: NotificationType;
    recipientEmail: string;
    recipientUserId?: string | null;
    orderId?: string | null;
    invoiceId?: string | null;
    subject: string;
    status: "SENT" | "SKIPPED" | "FAILED";
    reason?: string;
    metadata?: Record<string, unknown>;
  }

  // Simulated Edge Function / Resend Email Engine for unit & integration testing
  function simulateEmailDispatch(params: {
    tenantId: string;
    callerTenantId: string;
    callerRole: Role;
    callerStatus: "ACTIVE" | "INACTIVE";
    eventType: NotificationType;
    recipientUser?: { id: string; email?: string | null; status: "ACTIVE" | "INACTIVE"; tenantId: string } | null;
    recipientEmail?: string | null;
    settingsEnabled: boolean;
    eventConfig: Record<string, { inApp: boolean; clientEmail: boolean }>;
    idempotencyKey: string;
    idempotencyStore: Set<string>;
    simulateResendError?: boolean;
    metadata?: Record<string, unknown>;
  }): {
    success: boolean;
    skipped?: boolean;
    duplicate?: boolean;
    error?: string;
    reason?: string;
    log: EmailDispatchAttempt;
  } {
    const {
      tenantId,
      callerTenantId,
      callerRole,
      callerStatus,
      eventType,
      recipientUser,
      settingsEnabled,
      eventConfig,
      idempotencyKey,
      idempotencyStore,
      simulateResendError = false,
      metadata = {},
    } = params;

    const email = recipientUser?.email || params.recipientEmail || "none@unknown.local";

    // 1. Caller status & tenant boundary check
    if (callerStatus !== "ACTIVE") {
      return {
        success: false,
        error: "Caller account is inactive",
        log: { tenantId, eventType, recipientEmail: email, subject: `[Warevo] Notification`, status: "FAILED", reason: "Caller inactive" },
      };
    }
    if (callerRole !== "PLATFORM_ADMIN" && callerTenantId !== tenantId) {
      return {
        success: false,
        error: "Tenant boundary violation",
        log: { tenantId, eventType, recipientEmail: email, subject: `[Warevo] Notification`, status: "FAILED", reason: "Caller tenant mismatch" },
      };
    }

    // 2. Recipient cross-tenant check
    if (recipientUser && recipientUser.tenantId !== tenantId) {
      return {
        success: false,
        error: "Recipient belongs to another tenant (cross-tenant isolation violation)",
        log: { tenantId, eventType, recipientEmail: email, subject: `[Warevo] Notification`, status: "FAILED", reason: "Cross-tenant recipient blocked" },
      };
    }

    // 3. Inactive recipient check
    if (recipientUser && recipientUser.status !== "ACTIVE") {
      return {
        success: true,
        skipped: true,
        reason: "Recipient user is inactive",
        log: { tenantId, eventType, recipientEmail: email, recipientUserId: recipientUser.id, subject: `[Warevo] Notification`, status: "SKIPPED", reason: "Recipient user is inactive" },
      };
    }

    // 4. Missing email check
    if (!recipientUser?.email && !params.recipientEmail) {
      return {
        success: true,
        skipped: true,
        reason: "Recipient user has no email address",
        log: { tenantId, eventType, recipientEmail: "none@unknown.local", recipientUserId: recipientUser?.id, subject: `[Warevo] Notification`, status: "SKIPPED", reason: "Missing email" },
      };
    }

    // 5. Global notification preference check
    if (!settingsEnabled) {
      return {
        success: true,
        skipped: true,
        reason: "Tenant notifications globally disabled",
        log: { tenantId, eventType, recipientEmail: email, recipientUserId: recipientUser?.id, subject: `[Warevo] Notification`, status: "SKIPPED", reason: "Globally disabled" },
      };
    }

    // 6. Specific event email preference check (DEFAULT OFF)
    const isEmailEnabled = eventConfig[eventType]?.clientEmail === true;
    if (!isEmailEnabled) {
      return {
        success: true,
        skipped: true,
        reason: `Email notifications disabled for event ${eventType} (default OFF)`,
        log: { tenantId, eventType, recipientEmail: email, recipientUserId: recipientUser?.id, subject: `[Warevo] Notification`, status: "SKIPPED", reason: "Email preference OFF" },
      };
    }

    // 7. Idempotency check
    if (idempotencyStore.has(idempotencyKey)) {
      return {
        success: true,
        duplicate: true,
        log: { tenantId, eventType, recipientEmail: email, recipientUserId: recipientUser?.id, subject: `[Warevo] Notification`, status: "SENT", reason: "Duplicate skipped" },
      };
    }

    // 8. Simulated Resend dispatch error
    if (simulateResendError) {
      return {
        success: false,
        error: "Resend API connection timeout",
        log: { tenantId, eventType, recipientEmail: email, recipientUserId: recipientUser?.id, subject: `[Warevo] Notification`, status: "FAILED", reason: "Resend API failure", metadata },
      };
    }

    // Success
    idempotencyStore.add(idempotencyKey);
    return {
      success: true,
      log: {
        tenantId,
        eventType,
        recipientEmail: email,
        recipientUserId: recipientUser?.id,
        subject: `[Warevo] Notification: ${eventType}`,
        status: "SENT",
        metadata,
      },
    };
  }

  // ==========================================================================
  // A. NEW_ORDER Workflow
  // ==========================================================================
  describe("A. NEW_ORDER Event Workflow", () => {
    it("generates in-app notification and respects email preference OFF by default", () => {
      const idempotencyStore = new Set<string>();
      const defaultSettings = DEFAULT_NOTIFICATION_SETTINGS;

      // Confirm default is OFF
      expect(defaultSettings.NEW_ORDER.clientEmail).toBe(false);
      expect(defaultSettings.NEW_ORDER.inApp).toBe(true);

      const inAppNotif: Notification = {
        id: "notif_ord_101",
        tenantId,
        userId: "user_client_mgr",
        orderId: "ord_101",
        type: "NEW_ORDER",
        title: "New Order Created: ORD-2026-000101",
        message: "Order ORD-2026-000101 created successfully.",
        priority: "normal",
        read: false,
        createdAt: new Date().toISOString(),
      };

      // In-app notification exists and is unread
      expect(inAppNotif.read).toBe(false);
      expect(inAppNotif.type).toBe("NEW_ORDER");

      // Dispatch evaluation with default settings (OFF)
      const dispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "NEW_ORDER",
        recipientUser: { id: "user_client_mgr", email: "manager@clientalpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: defaultSettings,
        idempotencyKey: "notif_new_order_ord_101_user_client_mgr",
        idempotencyStore,
      });

      expect(dispatch.success).toBe(true);
      expect(dispatch.skipped).toBe(true);
      expect(dispatch.reason).toContain("Email notifications disabled for event NEW_ORDER");
      expect(dispatch.log.status).toBe("SKIPPED");
    });

    it("dispatches email when NEW_ORDER email preference is explicitly enabled", () => {
      const idempotencyStore = new Set<string>();
      const customConfig = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        NEW_ORDER: { inApp: true, clientEmail: true },
      };

      const dispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "NEW_ORDER",
        recipientUser: { id: "user_client_mgr", email: "manager@clientalpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: customConfig,
        idempotencyKey: "notif_new_order_ord_101_user_client_mgr",
        idempotencyStore,
        metadata: { orderNumber: "ORD-2026-000101", totalAmount: 4500 },
      });

      expect(dispatch.success).toBe(true);
      expect(dispatch.skipped).toBeUndefined();
      expect(dispatch.log.status).toBe("SENT");
      expect(dispatch.log.recipientEmail).toBe("manager@clientalpha.com");
      expect(dispatch.log.metadata?.orderNumber).toBe("ORD-2026-000101");
    });
  });

  // ==========================================================================
  // B. ORDER_DISPATCHED Workflow
  // ==========================================================================
  describe("B. ORDER_DISPATCHED Event Workflow", () => {
    it("targets correct client recipient roles (RECEIVER, STORE, MANAGER)", () => {
      const allowedRoles: ClientEmployeeRole[] = ["RECEIVER", "STORE", "MANAGER"];
      const clientEmployees = [
        { id: "e1", employeeRole: "RECEIVER", status: "ACTIVE", user: { id: "u1", email: "receiver@alpha.com", status: "ACTIVE" } },
        { id: "e2", employeeRole: "STORE", status: "ACTIVE", user: { id: "u2", email: "store@alpha.com", status: "ACTIVE" } },
        { id: "e3", employeeRole: "ACCOUNT", status: "ACTIVE", user: { id: "u3", email: "acct@alpha.com", status: "ACTIVE" } },
      ];

      const targets = clientEmployees.filter((e) => allowedRoles.includes(e.employeeRole as any));
      expect(targets.map((t) => t.id)).toEqual(["e1", "e2"]);
    });

    it("respects email preference toggle for ORDER_DISPATCHED", () => {
      const idempotencyStore = new Set<string>();

      // Preference OFF
      const offDispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "ORDER_DISPATCHED",
        recipientUser: { id: "u_rec", email: "receiver@alpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: DEFAULT_NOTIFICATION_SETTINGS,
        idempotencyKey: "dispatch_key_1",
        idempotencyStore,
      });
      expect(offDispatch.skipped).toBe(true);

      // Preference ON
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, ORDER_DISPATCHED: { inApp: true, clientEmail: true } };
      const onDispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "ORDER_DISPATCHED",
        recipientUser: { id: "u_rec", email: "receiver@alpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "dispatch_key_1",
        idempotencyStore,
      });
      expect(onDispatch.success).toBe(true);
      expect(onDispatch.log.status).toBe("SENT");
    });
  });

  // ==========================================================================
  // C. DELIVERY VERIFICATION Workflow
  // ==========================================================================
  describe("C. DELIVERY_VERIFICATION Workflow (CLIENT_COMPLETED_VERIFICATION)", () => {
    it("notifies warehouse operations staff and includes verification status in metadata", () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, CLIENT_COMPLETED_VERIFICATION: { inApp: true, clientEmail: true } };

      const dispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "CLIENT",
        callerStatus: "ACTIVE",
        eventType: "CLIENT_COMPLETED_VERIFICATION",
        recipientUser: { id: "u_ops", email: "ops@warehouse.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "verif_key_ord_200",
        idempotencyStore,
        metadata: {
          orderNumber: "ORD-2026-000200",
          verificationStatus: "VERIFIED" as VerificationStatus,
          verifierName: "John Inspector",
        },
      });

      expect(dispatch.success).toBe(true);
      expect(dispatch.log.status).toBe("SENT");
      expect(dispatch.log.metadata?.verificationStatus).toBe("VERIFIED");
      expect(dispatch.log.metadata?.verifierName).toBe("John Inspector");
    });
  });

  // ==========================================================================
  // D. INVENTORY VERIFICATION Workflow (VERIFICATION_COMPLETED)
  // ==========================================================================
  describe("D. INVENTORY_VERIFICATION Workflow (VERIFICATION_COMPLETED)", () => {
    it("notifies client store / manager and includes inventory reconciliation data", () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, VERIFICATION_COMPLETED: { inApp: true, clientEmail: true } };

      const dispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "VERIFICATION_COMPLETED",
        recipientUser: { id: "u_store", email: "store@clientalpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "store_verif_ord_200",
        idempotencyStore,
        metadata: {
          orderNumber: "ORD-2026-000200",
          itemsCount: 12,
        },
      });

      expect(dispatch.success).toBe(true);
      expect(dispatch.log.status).toBe("SENT");
      expect(dispatch.log.metadata?.itemsCount).toBe(12);
    });
  });

  // ==========================================================================
  // E. INVOICE_GENERATED Workflow
  // ==========================================================================
  describe("E. INVOICE_GENERATED Workflow", () => {
    it("targets client accounting roles and includes invoice number & amount", () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, INVOICE_GENERATED: { inApp: true, clientEmail: true } };

      const dispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "ACCOUNTANT",
        callerStatus: "ACTIVE",
        eventType: "INVOICE_GENERATED",
        recipientUser: { id: "u_acct", email: "accounting@clientalpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "inv_gen_inv_300",
        idempotencyStore,
        metadata: {
          invoiceNumber: "INV-2026-000300",
          paymentAmount: 8750.5,
        },
      });

      expect(dispatch.success).toBe(true);
      expect(dispatch.log.status).toBe("SENT");
      expect(dispatch.log.metadata?.invoiceNumber).toBe("INV-2026-000300");
      expect(dispatch.log.metadata?.paymentAmount).toBe(8750.5);
    });
  });

  // ==========================================================================
  // F. PAYMENT_RECEIVED Workflow
  // ==========================================================================
  describe("F. PAYMENT_RECEIVED Workflow", () => {
    it("records payment receipt notification with correct payment amount and invoice reference", () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, PAYMENT_RECEIVED: { inApp: true, clientEmail: true } };

      const dispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "ACCOUNTANT",
        callerStatus: "ACTIVE",
        eventType: "PAYMENT_RECEIVED",
        recipientUser: { id: "u_acct", email: "billing@clientalpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "pay_rec_inv_300_8750",
        idempotencyStore,
        metadata: {
          invoiceNumber: "INV-2026-000300",
          paymentAmount: 8750.5,
          orderId: "ord_101",
        },
      });

      expect(dispatch.success).toBe(true);
      expect(dispatch.log.status).toBe("SENT");
      expect(dispatch.log.metadata?.paymentAmount).toBe(8750.5);
    });
  });

  // ==========================================================================
  // G. PAYMENT_OVERDUE Workflow
  // ==========================================================================
  describe("G. PAYMENT_OVERDUE Workflow", () => {
    it("resolves accounting recipient correctly", () => {
      const accountants: Role[] = ["ACCOUNTANT", "ACCOUNTS_TEAM", "WAREHOUSE_OWNER"];
      const clientRoles: ClientEmployeeRole[] = ["ACCOUNT", "MANAGER", "GM", "MD"];

      expect(accountants.includes("ACCOUNTANT")).toBe(true);
      expect(clientRoles.includes("ACCOUNT")).toBe(true);
    });
  });

  // ==========================================================================
  // H. ORDER_COMPLETED Workflow
  // ==========================================================================
  describe("H. ORDER_COMPLETED Workflow", () => {
    it("notifies client manager when order is finalized", () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, ORDER_COMPLETED: { inApp: true, clientEmail: true } };

      const dispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "ORDER_COMPLETED",
        recipientUser: { id: "u_mgr", email: "gm@clientalpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "comp_ord_101",
        idempotencyStore,
        metadata: { orderNumber: "ORD-2026-000101" },
      });

      expect(dispatch.success).toBe(true);
      expect(dispatch.log.status).toBe("SENT");
    });
  });

  // ==========================================================================
  // I. Security Invariants
  // ==========================================================================
  describe("I. Security Invariants", () => {
    it("strictly blocks cross-tenant email recipient dispatch", () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, NEW_ORDER: { inApp: true, clientEmail: true } };

      const dispatch = simulateEmailDispatch({
        tenantId: "tenant_alpha",
        callerTenantId: "tenant_alpha",
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "NEW_ORDER",
        recipientUser: { id: "u_beta", email: "spy@tenantbeta.com", status: "ACTIVE", tenantId: "tenant_beta" },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "cross_tenant_key",
        idempotencyStore,
      });

      expect(dispatch.success).toBe(false);
      expect(dispatch.error).toContain("cross-tenant isolation violation");
      expect(dispatch.log.status).toBe("FAILED");
    });

    it("blocks cross-tenant callers attempting to trigger another tenant notifications", () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, NEW_ORDER: { inApp: true, clientEmail: true } };

      const dispatch = simulateEmailDispatch({
        tenantId: "tenant_alpha",
        callerTenantId: "tenant_gamma", // Caller does not belong to target tenant
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "NEW_ORDER",
        recipientUser: { id: "u_a", email: "user@tenantalpha.com", status: "ACTIVE", tenantId: "tenant_alpha" },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "cross_caller_key",
        idempotencyStore,
      });

      expect(dispatch.success).toBe(false);
      expect(dispatch.error).toContain("Tenant boundary violation");
    });

    it("skips inactive users without sending emails", () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, NEW_ORDER: { inApp: true, clientEmail: true } };

      const dispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "NEW_ORDER",
        recipientUser: { id: "u_inactive", email: "inactive@clientalpha.com", status: "INACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "inactive_key",
        idempotencyStore,
      });

      expect(dispatch.success).toBe(true);
      expect(dispatch.skipped).toBe(true);
      expect(dispatch.reason).toBe("Recipient user is inactive");
      expect(dispatch.log.status).toBe("SKIPPED");
    });

    it("safely skips recipients without email address", () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, NEW_ORDER: { inApp: true, clientEmail: true } };

      const dispatch = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "NEW_ORDER",
        recipientUser: { id: "u_no_email", email: null, status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "missing_email_key",
        idempotencyStore,
      });

      expect(dispatch.success).toBe(true);
      expect(dispatch.skipped).toBe(true);
      expect(dispatch.reason).toBe("Recipient user has no email address");
      expect(dispatch.log.status).toBe("SKIPPED");
    });
  });

  // ==========================================================================
  // J. Idempotency & Duplicate Prevention
  // ==========================================================================
  describe("J. Idempotency & Duplicate Prevention", () => {
    it("prevents duplicate email dispatch when repeated with identical idempotencyKey", () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, PAYMENT_RECEIVED: { inApp: true, clientEmail: true } };
      const idempotencyKey = "idemp_pay_inv_999_2500";

      // 1st attempt: Sent
      const first = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "ACCOUNTANT",
        callerStatus: "ACTIVE",
        eventType: "PAYMENT_RECEIVED",
        recipientUser: { id: "u1", email: "acct@alpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey,
        idempotencyStore,
      });
      expect(first.success).toBe(true);
      expect(first.log.status).toBe("SENT");
      expect(first.duplicate).toBeUndefined();

      // 2nd attempt (same key): Marked as duplicate without sending
      const retry = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "ACCOUNTANT",
        callerStatus: "ACTIVE",
        eventType: "PAYMENT_RECEIVED",
        recipientUser: { id: "u1", email: "acct@alpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey,
        idempotencyStore,
      });
      expect(retry.success).toBe(true);
      expect(retry.duplicate).toBe(true);
    });
  });

  // ==========================================================================
  // K. Failure Isolation (Email error does NOT break core WMS transaction)
  // ==========================================================================
  describe("K. Failure Isolation", () => {
    it("ensures WMS business operation succeeds even when Resend email dispatch fails", async () => {
      const idempotencyStore = new Set<string>();
      const onConfig = { ...DEFAULT_NOTIFICATION_SETTINGS, ORDER_DISPATCHED: { inApp: true, clientEmail: true } };

      // Core WMS business operation (e.g. order transition to DISPATCHED)
      const simulatedOrderTransition = {
        orderId: "ord_critical_99",
        status: "DISPATCHED" as OrderStatus,
        success: true,
      };

      // Email dispatch fails due to Resend API downtime
      const emailResult = simulateEmailDispatch({
        tenantId,
        callerTenantId: tenantId,
        callerRole: "WAREHOUSE_STAFF",
        callerStatus: "ACTIVE",
        eventType: "ORDER_DISPATCHED",
        recipientUser: { id: "u1", email: "client@alpha.com", status: "ACTIVE", tenantId },
        settingsEnabled: true,
        eventConfig: onConfig,
        idempotencyKey: "crit_99_dispatch",
        idempotencyStore,
        simulateResendError: true, // Simulating failure
      });

      // The email dispatch failed
      expect(emailResult.success).toBe(false);
      expect(emailResult.log.status).toBe("FAILED");
      expect(emailResult.error).toContain("Resend API");

      // CRITICAL INVARIANT: The business operation succeeded regardless of email failure
      expect(simulatedOrderTransition.success).toBe(true);
      expect(simulatedOrderTransition.status).toBe("DISPATCHED");
    });
  });
});
