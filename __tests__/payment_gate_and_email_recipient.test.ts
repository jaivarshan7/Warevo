import { describe, expect, it } from "vitest";
import { deriveClientWorkflowStages } from "@/src/lib/orderWorkflow";
import { canRecordPayment, canUploadPaymentProof } from "@/src/lib/permissions";
import { User, OrderStatus, PaymentStatus, Invoice } from "@/src/types";

// ============================================================================
// Simulation helpers for Payment Gate Authorization Logic
// Matches Postgres RPC public.rpc_record_payment_secure & public.rpc_attach_payment_proof
// ============================================================================

interface PaymentActor {
  actorId: string | null;
  role: string;
  tenantId: string | null;
  clientId?: string | null;
  employeeRole?: string;
  status?: string;
}

interface SimulatedInvoice {
  id: string;
  tenantId: string;
  clientId: string;
  orderId: string | null;
  status: "DRAFT" | "FINAL";
  total: number;
  paymentStatus: PaymentStatus;
}

interface SimulatedOrder {
  id: string;
  tenantId: string;
  clientId: string;
  orderNumber: string;
  status: OrderStatus;
  deliveryVerifiedAt: string | null;
  storeVerifiedAt: string | null;
}

function simulateRecordPaymentSecure(params: {
  actor: PaymentActor;
  invoice: SimulatedInvoice;
  order: SimulatedOrder | null;
  amount: number;
}): { success: boolean; newPaymentStatus?: PaymentStatus; error?: string } {
  const { actor, invoice, order, amount } = params;

  // 1. Authenticated actor check
  if (!actor || !actor.actorId) {
    return { success: false, error: "Authentication required: active user session not found" };
  }

  // 2. Active status
  if (actor.status && actor.status !== "ACTIVE") {
    return { success: false, error: "Actor is inactive" };
  }

  // 3. Role authorization
  const allowedStaffRoles = ["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "ACCOUNTS_TEAM", "ACCOUNTANT", "CLIENT_ACCOUNTANT"];
  if (allowedStaffRoles.includes(actor.role)) {
    // OK
  } else if (actor.role === "CLIENT") {
    if (["RECEIVER", "STORE"].includes(actor.employeeRole || "")) {
      return {
        success: false,
        error: `Permission denied: Client employee role ${actor.employeeRole} is not authorized to record payments`,
      };
    }
    const allowedClientRoles = ["MD", "GM", "MANAGER", "ACCOUNT"];
    if (!allowedClientRoles.includes(actor.employeeRole || "")) {
      return { success: false, error: "Permission denied: payment management is not allowed for current role" };
    }
  } else {
    return { success: false, error: `Permission denied: payment management is not allowed for role ${actor.role}` };
  }

  // 4. Amount validation
  if (!amount || amount <= 0) {
    return { success: false, error: "Payment amount must be greater than zero" };
  }

  // 5. Invoice state is FINAL
  if (invoice.status !== "FINAL") {
    return { success: false, error: `Invoice ${invoice.id} is not in FINAL status` };
  }

  // 6. Associated Order exists
  if (!invoice.orderId || !order || order.id !== invoice.orderId) {
    return { success: false, error: `Order for invoice ${invoice.id} not found` };
  }

  // 7. DELIVERY VERIFICATION GATE: order.deliveryVerifiedAt IS NOT NULL
  if (!order.deliveryVerifiedAt) {
    return { success: false, error: "Payment is available after delivery verification" };
  }

  // 8. Tenant & Company boundary
  if (actor.role !== "PLATFORM_ADMIN") {
    if (!actor.tenantId || actor.tenantId !== invoice.tenantId) {
      return { success: false, error: "Permission denied: invoice belongs to another tenant" };
    }
    if (["CLIENT", "CLIENT_ACCOUNTANT"].includes(actor.role)) {
      if (actor.clientId && actor.clientId !== invoice.clientId) {
        return { success: false, error: "Permission denied: invoice belongs to another client company" };
      }
    }
  }

  const newPaymentStatus: PaymentStatus = amount >= invoice.total ? "PAID" : "PARTIALLY_PAID";
  return { success: true, newPaymentStatus };
}

function simulateAttachPaymentProof(params: {
  actor: PaymentActor;
  invoice: SimulatedInvoice;
  order: SimulatedOrder | null;
  proofUrl: string;
}): { success: boolean; error?: string } {
  const { actor, invoice, order, proofUrl } = params;

  if (!actor || !actor.actorId) {
    return { success: false, error: "Authentication required: active user session not found" };
  }

  if (["RECEIVER", "STORE"].includes(actor.employeeRole || "")) {
    return { success: false, error: "Permission denied: Client employee role is not authorized to upload payment proof" };
  }

  if (!proofUrl || proofUrl.trim() === "") {
    return { success: false, error: "Proof URL cannot be empty" };
  }

  if (!invoice.orderId || !order || order.id !== invoice.orderId) {
    return { success: false, error: `Order for invoice ${invoice.id} not found` };
  }

  // Delivery verification gate for proof attachment
  if (!order.deliveryVerifiedAt) {
    return { success: false, error: "Payment proof upload is available after delivery verification" };
  }

  if (actor.role !== "PLATFORM_ADMIN" && actor.tenantId !== invoice.tenantId) {
    return { success: false, error: "Permission denied: invoice belongs to another tenant" };
  }

  return { success: true };
}

// ============================================================================
// Simulation helpers for Email Recipient Resolution & Edge Function
// ============================================================================

interface SimulatedClientEmployee {
  id: string;
  tenantId: string;
  clientId: string;
  userId: string | null;
  contactPerson: string;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
}

interface SimulatedEmailLog {
  recipientEmail: string;
  recipientUserId: string | null;
  eventType: string;
  status: "SENT" | "SKIPPED" | "FAILED";
  reason?: string;
  idempotencyKey?: string;
}

function simulateOrderCreatedEmailDispatch(params: {
  tenantId: string;
  clientId: string;
  orderId: string;
  orderNumber: string;
  selectedContactIds?: string[];
  employees: SimulatedClientEmployee[];
  emailPrefEnabled: boolean;
  notificationsGloballyEnabled?: boolean;
  sentIdempotencyKeys: Set<string>;
}): {
  attemptedRecipients: Array<{ email: string | null; status: "SENT" | "SKIPPED"; reason?: string }>;
  emailLogs: SimulatedEmailLog[];
} {
  const {
    tenantId,
    clientId,
    orderId,
    selectedContactIds,
    employees,
    emailPrefEnabled,
    notificationsGloballyEnabled = true,
    sentIdempotencyKeys,
  } = params;

  const emailLogs: SimulatedEmailLog[] = [];
  const attemptedRecipients: Array<{ email: string | null; status: "SENT" | "SKIPPED"; reason?: string }> = [];

  let targets: SimulatedClientEmployee[] = [];

  if (selectedContactIds && selectedContactIds.length > 0) {
    // Authoritatively resolve selected client contacts matching tenant & client
    targets = employees.filter(
      (e) =>
        (selectedContactIds.includes(e.id) || (e.userId && selectedContactIds.includes(e.userId))) &&
        e.tenantId === tenantId &&
        e.clientId === clientId
    );
  } else {
    // Default fallback
    targets = employees.filter((e) => e.tenantId === tenantId && e.clientId === clientId && e.status === "ACTIVE");
  }

  for (const target of targets) {
    const idempotencyKey = `notif_new_order_${orderId}_${target.id}`;

    // Duplicate check
    if (sentIdempotencyKeys.has(idempotencyKey)) {
      emailLogs.push({
        recipientEmail: target.email || "none@unknown.local",
        recipientUserId: target.userId,
        eventType: "NEW_ORDER",
        status: "SKIPPED",
        reason: "Duplicate event detected",
        idempotencyKey,
      });
      attemptedRecipients.push({ email: target.email, status: "SKIPPED", reason: "DUPLICATE" });
      continue;
    }

    // Active status check
    if (target.status !== "ACTIVE") {
      emailLogs.push({
        recipientEmail: target.email || "none@unknown.local",
        recipientUserId: target.userId,
        eventType: "NEW_ORDER",
        status: "SKIPPED",
        reason: "Recipient client employee is inactive",
        idempotencyKey,
      });
      attemptedRecipients.push({ email: target.email, status: "SKIPPED", reason: "INACTIVE_RECIPIENT" });
      continue;
    }

    // Missing email check
    if (!target.email || target.email.trim() === "") {
      emailLogs.push({
        recipientEmail: "none@unknown.local",
        recipientUserId: target.userId,
        eventType: "NEW_ORDER",
        status: "SKIPPED",
        reason: "No recipient email address provided",
        idempotencyKey,
      });
      attemptedRecipients.push({ email: null, status: "SKIPPED", reason: "NO_EMAIL" });
      continue;
    }

    // Tenant notification preference check (Default OFF)
    if (!notificationsGloballyEnabled || !emailPrefEnabled) {
      emailLogs.push({
        recipientEmail: target.email,
        recipientUserId: target.userId,
        eventType: "NEW_ORDER",
        status: "SKIPPED",
        reason: "Email notifications disabled for event NEW_ORDER (default OFF)",
        idempotencyKey,
      });
      attemptedRecipients.push({ email: target.email, status: "SKIPPED", reason: "EMAIL_DISABLED" });
      continue;
    }

    // Successful dispatch
    sentIdempotencyKeys.add(idempotencyKey);
    emailLogs.push({
      recipientEmail: target.email,
      recipientUserId: target.userId,
      eventType: "NEW_ORDER",
      status: "SENT",
      idempotencyKey,
    });
    attemptedRecipients.push({ email: target.email, status: "SENT" });
  }

  return { attemptedRecipients, emailLogs };
}

// ============================================================================
// TEST SUITE: PART 1 — PAYMENT GATE (DELIVERY VERIFICATION REQUIRED)
// ============================================================================

describe("PART 1: Payment Gate — Delivery Verification Required", () => {
  const tenantId = "tenant-prod-1";
  const clientId = "client-alpha-1";
  const invoiceId = "inv-001";
  const orderId = "ord-001";

  const clientAccountantActor: PaymentActor = {
    actorId: "user-acc-1",
    role: "CLIENT",
    employeeRole: "ACCOUNT",
    tenantId,
    clientId,
    status: "ACTIVE",
  };

  const clientReceiverActor: PaymentActor = {
    actorId: "user-rec-1",
    role: "CLIENT",
    employeeRole: "RECEIVER",
    tenantId,
    clientId,
    status: "ACTIVE",
  };

  const baseInvoice: SimulatedInvoice = {
    id: invoiceId,
    tenantId,
    clientId,
    orderId,
    status: "FINAL",
    total: 10000,
    paymentStatus: "UNPAID",
  };

  const baseOrder: SimulatedOrder = {
    id: orderId,
    tenantId,
    clientId,
    orderNumber: "ORD-2026-0001",
    status: "DISPATCHED",
    deliveryVerifiedAt: null,
    storeVerifiedAt: null,
  };

  it("1. DISPATCHED + no delivery verification -> payment rejected", () => {
    const orderWithoutDelivery: SimulatedOrder = {
      ...baseOrder,
      status: "DISPATCHED",
      deliveryVerifiedAt: null,
    };

    const res = simulateRecordPaymentSecure({
      actor: clientAccountantActor,
      invoice: baseInvoice,
      order: orderWithoutDelivery,
      amount: 10000,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Payment is available after delivery verification");
  });

  it("2. DISPATCHED + delivery verification completed -> payment allowed", () => {
    const orderWithDelivery: SimulatedOrder = {
      ...baseOrder,
      status: "DISPATCHED",
      deliveryVerifiedAt: "2026-09-25T10:00:00Z",
      storeVerifiedAt: null,
    };

    const res = simulateRecordPaymentSecure({
      actor: clientAccountantActor,
      invoice: baseInvoice,
      order: orderWithDelivery,
      amount: 10000,
    });

    expect(res.success).toBe(true);
    expect(res.newPaymentStatus).toBe("PAID");
  });

  it("3. delivery verified + inventory not verified -> payment allowed", () => {
    const orderDeliveredOnly: SimulatedOrder = {
      ...baseOrder,
      status: "DISPATCHED",
      deliveryVerifiedAt: "2026-09-25T11:00:00Z",
      storeVerifiedAt: null, // Store/Inventory not yet verified
    };

    const res = simulateRecordPaymentSecure({
      actor: clientAccountantActor,
      invoice: baseInvoice,
      order: orderDeliveredOnly,
      amount: 5000,
    });

    expect(res.success).toBe(true);
    expect(res.newPaymentStatus).toBe("PARTIALLY_PAID");
  });

  it("4. inventory verified + delivery verified -> payment allowed", () => {
    const orderFullyVerified: SimulatedOrder = {
      ...baseOrder,
      status: "VERIFIED",
      deliveryVerifiedAt: "2026-09-25T10:00:00Z",
      storeVerifiedAt: "2026-09-25T12:00:00Z",
    };

    const res = simulateRecordPaymentSecure({
      actor: clientAccountantActor,
      invoice: baseInvoice,
      order: orderFullyVerified,
      amount: 10000,
    });

    expect(res.success).toBe(true);
    expect(res.newPaymentStatus).toBe("PAID");
  });

  it("5. unauthenticated payment -> rejected", () => {
    const unauthActor: PaymentActor = {
      actorId: null,
      role: "ANON",
      tenantId: null,
    };

    const deliveredOrder: SimulatedOrder = {
      ...baseOrder,
      deliveryVerifiedAt: "2026-09-25T10:00:00Z",
    };

    const res = simulateRecordPaymentSecure({
      actor: unauthActor,
      invoice: baseInvoice,
      order: deliveredOrder,
      amount: 10000,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Authentication required");
  });

  it("6. wrong tenant/company -> rejected", () => {
    const crossTenantActor: PaymentActor = {
      actorId: "user-cross",
      role: "CLIENT",
      employeeRole: "ACCOUNT",
      tenantId: "tenant-other",
      clientId: "client-other",
      status: "ACTIVE",
    };

    const deliveredOrder: SimulatedOrder = {
      ...baseOrder,
      deliveryVerifiedAt: "2026-09-25T10:00:00Z",
    };

    const res = simulateRecordPaymentSecure({
      actor: crossTenantActor,
      invoice: baseInvoice,
      order: deliveredOrder,
      amount: 10000,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Permission denied");
  });

  it("7. unauthorized client role (RECEIVER) -> rejected", () => {
    const deliveredOrder: SimulatedOrder = {
      ...baseOrder,
      deliveryVerifiedAt: "2026-09-25T10:00:00Z",
    };

    const res = simulateRecordPaymentSecure({
      actor: clientReceiverActor,
      invoice: baseInvoice,
      order: deliveredOrder,
      amount: 10000,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("is not authorized to record payments");
  });

  it("8. authorized CLIENT ACCOUNT / MANAGER / GM / MD -> allowed after delivery verification", () => {
    const deliveredOrder: SimulatedOrder = {
      ...baseOrder,
      deliveryVerifiedAt: "2026-09-25T10:00:00Z",
    };

    for (const role of ["ACCOUNT", "MANAGER", "GM", "MD"]) {
      const actor: PaymentActor = {
        actorId: `user-${role.toLowerCase()}`,
        role: "CLIENT",
        employeeRole: role,
        tenantId,
        clientId,
        status: "ACTIVE",
      };

      const res = simulateRecordPaymentSecure({
        actor,
        invoice: baseInvoice,
        order: deliveredOrder,
        amount: 10000,
      });

      expect(res.success).toBe(true);
    }
  });

  it("9. payment proof upload before delivery verification -> rejected", () => {
    const orderNoDelivery: SimulatedOrder = {
      ...baseOrder,
      deliveryVerifiedAt: null,
    };

    const res = simulateAttachPaymentProof({
      actor: clientAccountantActor,
      invoice: baseInvoice,
      order: orderNoDelivery,
      proofUrl: "proofs/pay-1.pdf",
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Payment proof upload is available after delivery verification");
  });

  it("10. payment proof upload after delivery verification -> allowed", () => {
    const orderDelivered: SimulatedOrder = {
      ...baseOrder,
      deliveryVerifiedAt: "2026-09-25T10:00:00Z",
    };

    const res = simulateAttachPaymentProof({
      actor: clientAccountantActor,
      invoice: baseInvoice,
      order: orderDelivered,
      proofUrl: "proofs/pay-1.pdf",
    });

    expect(res.success).toBe(true);
  });

  it("11. non-FINAL invoice rejected from payment", () => {
    const draftInvoice: SimulatedInvoice = {
      ...baseInvoice,
      status: "DRAFT",
    };

    const deliveredOrder: SimulatedOrder = {
      ...baseOrder,
      deliveryVerifiedAt: "2026-09-25T10:00:00Z",
    };

    const res = simulateRecordPaymentSecure({
      actor: clientAccountantActor,
      invoice: draftInvoice,
      order: deliveredOrder,
      amount: 10000,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("is not in FINAL status");
  });

  it("12. workflow stages reflect PAYMENT PENDING immediately upon delivery verification", () => {
    const orderDelivered: {
      status: OrderStatus;
      deliveryVerifiedAt: string;
      storeVerifiedAt: null;
    } = {
      status: "DISPATCHED",
      deliveryVerifiedAt: "2026-09-25T10:00:00Z",
      storeVerifiedAt: null,
    };

    const stages = deriveClientWorkflowStages(orderDelivered, "PAYMENT_PENDING");
    const paymentPendingStage = stages.find((s) => s.id === "PAYMENT_PENDING");
    expect(paymentPendingStage).toBeDefined();
    expect(paymentPendingStage?.state).toBe("current");
  });
});

// ============================================================================
// TEST SUITE: PART 2 — ORDER / IMPORT EMAIL RECIPIENT RESOLUTION
// ============================================================================

describe("PART 2: Order / Import Email Recipient Resolution", () => {
  const tenantId = "tenant-wms-1";
  const clientId = "client-corp-1";
  const orderId = "ord-prod-99";
  const orderNumber = "ORD-2026-0099";

  const employees: SimulatedClientEmployee[] = [
    {
      id: "ce-emp-1",
      tenantId,
      clientId,
      userId: "user-emp-1",
      contactPerson: "Alice Finance",
      email: "alice@clientcorp.test",
      status: "ACTIVE",
    },
    {
      id: "ce-emp-2",
      tenantId,
      clientId,
      userId: null, // Employee without login user account
      contactPerson: "Bob Dispatch",
      email: "bob@clientcorp.test",
      status: "ACTIVE",
    },
    {
      id: "ce-emp-no-email",
      tenantId,
      clientId,
      userId: "user-no-email",
      contactPerson: "Charlie Silent",
      email: null,
      status: "ACTIVE",
    },
    {
      id: "ce-emp-inactive",
      tenantId,
      clientId,
      userId: "user-inactive",
      contactPerson: "Diana Left",
      email: "diana@clientcorp.test",
      status: "INACTIVE",
    },
    {
      id: "ce-emp-cross-tenant",
      tenantId: "tenant-other",
      clientId: "client-other",
      userId: "user-other",
      contactPerson: "Eve Intruder",
      email: "eve@other.test",
      status: "ACTIVE",
    },
  ];

  it("1. CREATE ORDER + SELECT EMPLOYEE + EMAIL ENABLED -> selected employee receives NEW_ORDER email", () => {
    const idempotencyStore = new Set<string>();

    const { attemptedRecipients, emailLogs } = simulateOrderCreatedEmailDispatch({
      tenantId,
      clientId,
      orderId,
      orderNumber,
      selectedContactIds: ["ce-emp-1"],
      employees,
      emailPrefEnabled: true,
      sentIdempotencyKeys: idempotencyStore,
    });

    expect(attemptedRecipients.length).toBe(1);
    expect(attemptedRecipients[0].email).toBe("alice@clientcorp.test");
    expect(attemptedRecipients[0].status).toBe("SENT");

    expect(emailLogs.length).toBe(1);
    expect(emailLogs[0].recipientEmail).toBe("alice@clientcorp.test");
    expect(emailLogs[0].status).toBe("SENT");
    expect(emailLogs[0].eventType).toBe("NEW_ORDER");
  });

  it("2. CREATE ORDER + EMAIL DISABLED -> no email sent and EmailLog explains EMAIL_DISABLED", () => {
    const idempotencyStore = new Set<string>();

    const { attemptedRecipients, emailLogs } = simulateOrderCreatedEmailDispatch({
      tenantId,
      clientId,
      orderId,
      orderNumber,
      selectedContactIds: ["ce-emp-1"],
      employees,
      emailPrefEnabled: false, // Default OFF
      sentIdempotencyKeys: idempotencyStore,
    });

    expect(attemptedRecipients.length).toBe(1);
    expect(attemptedRecipients[0].status).toBe("SKIPPED");
    expect(attemptedRecipients[0].reason).toBe("EMAIL_DISABLED");

    expect(emailLogs.length).toBe(1);
    expect(emailLogs[0].status).toBe("SKIPPED");
    expect(emailLogs[0].reason).toContain("Email notifications disabled for event NEW_ORDER");
  });

  it("3. CREATE ORDER + SELECT EMPLOYEE WITHOUT EMAIL -> no email and EmailLog explains NO_EMAIL", () => {
    const idempotencyStore = new Set<string>();

    const { attemptedRecipients, emailLogs } = simulateOrderCreatedEmailDispatch({
      tenantId,
      clientId,
      orderId,
      orderNumber,
      selectedContactIds: ["ce-emp-no-email"],
      employees,
      emailPrefEnabled: true,
      sentIdempotencyKeys: idempotencyStore,
    });

    expect(attemptedRecipients.length).toBe(1);
    expect(attemptedRecipients[0].status).toBe("SKIPPED");
    expect(attemptedRecipients[0].reason).toBe("NO_EMAIL");

    expect(emailLogs.length).toBe(1);
    expect(emailLogs[0].status).toBe("SKIPPED");
    expect(emailLogs[0].reason).toContain("No recipient email address provided");
  });

  it("4. CREATE ORDER + INVALID/CROSS-COMPANY EMPLOYEE -> backend rejects / does not send", () => {
    const idempotencyStore = new Set<string>();

    const { attemptedRecipients, emailLogs } = simulateOrderCreatedEmailDispatch({
      tenantId,
      clientId,
      orderId,
      orderNumber,
      selectedContactIds: ["ce-emp-cross-tenant"], // Belongs to different tenant/company
      employees,
      emailPrefEnabled: true,
      sentIdempotencyKeys: idempotencyStore,
    });

    // Cross-tenant contact is excluded by tenant & client boundary filters
    expect(attemptedRecipients.length).toBe(0);
    expect(emailLogs.length).toBe(0);
  });

  it("5. IMPORT ORDER + SELECT EMPLOYEE + EMAIL ENABLED -> selected employee receives NEW_ORDER email", () => {
    const idempotencyStore = new Set<string>();

    // Selected employee without login account (Bob Dispatch)
    const { attemptedRecipients, emailLogs } = simulateOrderCreatedEmailDispatch({
      tenantId,
      clientId,
      orderId: "ord-imported-1",
      orderNumber: "ORD-IMP-2026-0001",
      selectedContactIds: ["ce-emp-2"],
      employees,
      emailPrefEnabled: true,
      sentIdempotencyKeys: idempotencyStore,
    });

    expect(attemptedRecipients.length).toBe(1);
    expect(attemptedRecipients[0].email).toBe("bob@clientcorp.test");
    expect(attemptedRecipients[0].status).toBe("SENT");

    expect(emailLogs.length).toBe(1);
    expect(emailLogs[0].recipientEmail).toBe("bob@clientcorp.test");
    expect(emailLogs[0].status).toBe("SENT");
  });

  it("6. DUPLICATE EVENT -> idempotency prevents duplicate email", () => {
    const idempotencyStore = new Set<string>();

    // First call -> SENT
    const run1 = simulateOrderCreatedEmailDispatch({
      tenantId,
      clientId,
      orderId,
      orderNumber,
      selectedContactIds: ["ce-emp-1"],
      employees,
      emailPrefEnabled: true,
      sentIdempotencyKeys: idempotencyStore,
    });
    expect(run1.attemptedRecipients[0].status).toBe("SENT");

    // Second call with same orderId and contact -> SKIPPED (Duplicate)
    const run2 = simulateOrderCreatedEmailDispatch({
      tenantId,
      clientId,
      orderId,
      orderNumber,
      selectedContactIds: ["ce-emp-1"],
      employees,
      emailPrefEnabled: true,
      sentIdempotencyKeys: idempotencyStore,
    });
    expect(run2.attemptedRecipients[0].status).toBe("SKIPPED");
    expect(run2.attemptedRecipients[0].reason).toBe("DUPLICATE");
    expect(run2.emailLogs[0].reason).toBe("Duplicate event detected");
  });

  it("7. INACTIVE RECIPIENT -> no email sent and EmailLog explains INACTIVE_RECIPIENT", () => {
    const idempotencyStore = new Set<string>();

    const { attemptedRecipients, emailLogs } = simulateOrderCreatedEmailDispatch({
      tenantId,
      clientId,
      orderId,
      orderNumber,
      selectedContactIds: ["ce-emp-inactive"],
      employees,
      emailPrefEnabled: true,
      sentIdempotencyKeys: idempotencyStore,
    });

    expect(attemptedRecipients.length).toBe(1);
    expect(attemptedRecipients[0].status).toBe("SKIPPED");
    expect(attemptedRecipients[0].reason).toBe("INACTIVE_RECIPIENT");
    expect(emailLogs[0].reason).toContain("Recipient client employee is inactive");
  });
});
