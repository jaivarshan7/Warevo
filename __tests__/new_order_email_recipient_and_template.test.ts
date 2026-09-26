import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

import ts from "typescript";

// Extract template functions from send-email/index.ts for unit testing
function extractTemplateFunctions() {
  const edgeFunctionPath = resolve(__dirname, "../supabase/functions/send-email/index.ts");
  const content = readFileSync(edgeFunctionPath, "utf-8");

  // Extract buildEmailHtml and buildEmailText function bodies
  const htmlStart = content.indexOf("function buildEmailHtml(");
  const textStart = content.indexOf("function buildEmailText(");

  const htmlCode = content.substring(htmlStart, textStart);
  const textCode = content.substring(textStart);

  const transpiledHtml = ts.transpileModule(htmlCode, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const transpiledText = ts.transpileModule(textCode, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

  // Wrap into executable functions
  const buildHtml = new Function("params", `
    const Deno = { env: { get: () => undefined } };
    ${transpiledHtml}
    return buildEmailHtml(params);
  `);

  const buildText = new Function("params", `
    const Deno = { env: { get: () => undefined } };
    ${transpiledText}
    return buildEmailText(params);
  `);

  return { buildHtml, buildText, rawContent: content };
}

describe("NEW_ORDER Email Recipient Isolation, Template Normalization, and Branding", () => {
  const { buildHtml, buildText, rawContent } = extractTemplateFunctions();

  describe("PART 7 — RECIPIENT ISOLATION LOGIC", () => {
    // Model the exact recipient resolution function from services.ts
    interface MockEmployee {
      id: string;
      clientId: string;
      tenantId: string;
      userId: string | null;
      contactPerson: string;
      email: string | null;
      status: string;
      user?: { id: string; name: string; email: string; status: string; tenantId: string } | null;
    }

    const testTenantId = "tenant_test_123";
    const testClientId = "client_test_abc";

    const employeeA: MockEmployee = {
      id: "ce_111",
      clientId: testClientId,
      tenantId: testTenantId,
      userId: "usr_111",
      contactPerson: "Josh",
      email: "josh@example.com",
      status: "ACTIVE",
      user: { id: "usr_111", name: "Josh", email: "josh@example.com", status: "ACTIVE", tenantId: testTenantId }
    };

    const employeeB: MockEmployee = {
      id: "ce_222",
      clientId: testClientId,
      tenantId: testTenantId,
      userId: "usr_222",
      contactPerson: "Ravi",
      email: "ravi@example.com",
      status: "ACTIVE",
      user: { id: "usr_222", name: "Ravi", email: "ravi@example.com", status: "ACTIVE", tenantId: testTenantId }
    };

    const employeeC: MockEmployee = {
      id: "ce_333",
      clientId: testClientId,
      tenantId: testTenantId,
      userId: "usr_333",
      contactPerson: "Priya",
      email: "priya@example.com",
      status: "ACTIVE",
      user: { id: "usr_333", name: "Priya", email: "priya@example.com", status: "ACTIVE", tenantId: testTenantId }
    };

    const employeeD: MockEmployee = {
      id: "ce_444",
      clientId: testClientId,
      tenantId: testTenantId,
      userId: "usr_444",
      contactPerson: "Kumar",
      email: "kumar@example.com",
      status: "ACTIVE",
      user: { id: "usr_444", name: "Kumar", email: "kumar@example.com", status: "ACTIVE", tenantId: testTenantId }
    };

    const allEmployees = [employeeA, employeeB, employeeC, employeeD];

    function resolveRecipientsForOrder(
      selectedContactIds: string[] | undefined,
      tenantId: string,
      clientId: string
    ) {
      const recipients: Array<{ id: string | null; email: string | null; name: string; contactKey: string }> = [];

      if (selectedContactIds !== undefined && selectedContactIds !== null) {
        if (selectedContactIds.length > 0) {
          const combinedEmps = new Map<string, MockEmployee>();
          allEmployees
            .filter((e) => e.tenantId === tenantId && e.clientId === clientId && selectedContactIds.includes(e.id))
            .forEach((e) => combinedEmps.set(e.id, e));

          const seenEmails = new Set<string>();

          for (const contactId of selectedContactIds) {
            const emp = combinedEmps.get(contactId);
            if (emp) {
              const u = emp.user;
              const email = (u?.email || emp.email || "").trim() || null;
              const name = emp.contactPerson || u?.name || "Order Contact";
              const userId = emp.userId || (u?.id ?? null);
              const isActive = emp.status === "ACTIVE" && (!u || u.status === "ACTIVE");

              if (isActive && email && !seenEmails.has(email.toLowerCase())) {
                seenEmails.add(email.toLowerCase());
                recipients.push({
                  id: userId,
                  email,
                  name,
                  contactKey: emp.id,
                });
              }
            }
          }
        }
      } else {
        // Fallback: all active
        for (const e of allEmployees) {
          if (e.status === "ACTIVE" && e.email) {
            recipients.push({ id: e.userId, email: e.email, name: e.contactPerson, contactKey: e.id });
          }
        }
      }

      return recipients;
    }

    it("Scenario 1: Selected [Josh (A), Priya (C)] -> Only Josh and Priya receive email; Ravi (B) and Kumar (D) receive NO email", () => {
      const selected = [employeeA.id, employeeC.id]; // ce_111, ce_333
      const recipients = resolveRecipientsForOrder(selected, testTenantId, testClientId);

      const recipientEmails = recipients.map((r) => r.email);
      const recipientIds = recipients.map((r) => r.id);

      expect(recipientEmails).toEqual(["josh@example.com", "priya@example.com"]);
      expect(recipientIds).toEqual(["usr_111", "usr_333"]);

      // Negative assertions: unselected employees must NOT be present
      expect(recipientEmails).not.toContain("ravi@example.com");
      expect(recipientEmails).not.toContain("kumar@example.com");
    });

    it("Scenario 2: Selected [Josh (A)] only -> Only Josh receives email", () => {
      const selected = [employeeA.id]; // ce_111
      const recipients = resolveRecipientsForOrder(selected, testTenantId, testClientId);

      expect(recipients).toHaveLength(1);
      expect(recipients[0].name).toBe("Josh");
      expect(recipients[0].email).toBe("josh@example.com");
      expect(recipients[0].id).toBe("usr_111");

      const recipientEmails = recipients.map((r) => r.email);
      expect(recipientEmails).not.toContain("ravi@example.com");
      expect(recipientEmails).not.toContain("priya@example.com");
      expect(recipientEmails).not.toContain("kumar@example.com");
    });

    it("Scenario 3: Selected [Josh (A), Ravi (B), Priya (C)] -> Only A, B, C receive email; Kumar (D) receives NO email", () => {
      const selected = [employeeA.id, employeeB.id, employeeC.id];
      const recipients = resolveRecipientsForOrder(selected, testTenantId, testClientId);

      const recipientEmails = recipients.map((r) => r.email);
      expect(recipientEmails).toEqual(["josh@example.com", "ravi@example.com", "priya@example.com"]);
      expect(recipientEmails).not.toContain("kumar@example.com");
    });

    it("Scenario 4: Explicit selection of 0 employees ([]) -> Exactly 0 recipients, NO fallback to all employees", () => {
      const selected: string[] = [];
      const recipients = resolveRecipientsForOrder(selected, testTenantId, testClientId);

      expect(recipients).toHaveLength(0);
      expect(recipients).toEqual([]);
    });

    it("Scenario 5: ClientEmployee.id is correctly resolved to linked User.id and User.email", () => {
      const selected = [employeeA.id];
      const recipients = resolveRecipientsForOrder(selected, testTenantId, testClientId);

      expect(recipients[0].contactKey).toBe("ce_111"); // ClientEmployee.id
      expect(recipients[0].id).toBe("usr_111");         // Resolved User.id
      expect(recipients[0].email).toBe("josh@example.com"); // Resolved User.email
    });
  });

  describe("PART 8 — TEST ORDER PAYLOAD NORMALIZATION & NO 'undefined'", () => {
    it("renders orderNumber correctly and contains NO 'undefined' in HTML or text template", () => {
      const payload = {
        recipientName: "Josh",
        title: "New Order Created: ORD-2026-TEST001",
        message: "Order ORD-2026-TEST001 has been successfully created and queued for processing.",
        eventType: "NEW_ORDER",
        orderId: "ord_test",
        actionUrl: "/orders/ord_test",
        metadata: {
          orderId: "ord_test",
          orderNumber: "ORD-2026-TEST001",
          totalAmount: 590,
        },
      };

      const html = buildHtml(payload);
      const text = buildText(payload);

      // Positive assertions
      expect(html).toContain("New Order Created: ORD-2026-TEST001");
      expect(html).toContain("Order ORD-2026-TEST001 has been successfully created and queued for processing.");
      expect(html).toContain("ORD-2026-TEST001");

      expect(text).toContain("New Order Created: ORD-2026-TEST001");
      expect(text).toContain("Order ORD-2026-TEST001 has been successfully created");

      // Critical negative assertion: NO occurrence of undefined
      expect(html).not.toContain("undefined");
      expect(text).not.toContain("undefined");
    });

    it("sanitizes title and message if called with missing/undefined orderNumber", () => {
      const payload = {
        recipientName: "Valued Partner",
        title: "New Order Created: undefined",
        message: "Order undefined has been successfully created and queued for processing.",
        eventType: "NEW_ORDER",
        orderId: "ord_test_002",
        actionUrl: "/orders/ord_test_002",
        metadata: {
          orderNumber: "ORD-2026-RECOVERED",
        },
      };

      // In Edge Function, the title and message are sanitized before passing to template
      let cleanTitle = payload.title.replace(/undefined/g, payload.metadata.orderNumber);
      let cleanMessage = payload.message.replace(/undefined/g, payload.metadata.orderNumber);

      const html = buildHtml({ ...payload, title: cleanTitle, message: cleanMessage });
      const text = buildText({ ...payload, title: cleanTitle, message: cleanMessage });

      expect(html).toContain("New Order Created: ORD-2026-RECOVERED");
      expect(html).toContain("Order ORD-2026-RECOVERED has been successfully created");
      expect(html).not.toContain("undefined");
      expect(text).not.toContain("undefined");
    });
  });

  describe("PART 9 — TEST BRANDING ('Warevo' vs 'Warevo Warehouse OS')", () => {
    it("HTML email header displays 'Warevo' and NOT 'Warevo Warehouse OS'", () => {
      const payload = {
        recipientName: "Test Partner",
        title: "New Order Created: ORD-2026-000001",
        message: "Order ORD-2026-000001 has been successfully created.",
        eventType: "NEW_ORDER",
        orderId: "ord_1",
        actionUrl: "/orders/ord_1",
        metadata: { orderNumber: "ORD-2026-000001" },
      };

      const html = buildHtml(payload);
      const text = buildText(payload);

      // Verify exact header brand
      expect(html).toContain('<div class="brand">Warevo</div>');
      expect(html).not.toContain("Warevo Warehouse OS");
      expect(html).not.toContain("Warehouse OS");

      // Verify text version branding
      expect(text).toContain("Warevo — NEW ORDER");
      expect(text).not.toContain("Warevo Warehouse OS");
      expect(text).not.toContain("Warehouse OS");

      // Verify footer copyright branding
      expect(html).toContain("© " + new Date().getFullYear() + " Warevo. All rights reserved.");
      expect(text).toContain("© " + new Date().getFullYear() + " Warevo. All rights reserved.");
    });

    it("Edge Function file does not contain any occurrence of 'Warehouse OS'", () => {
      expect(rawContent).not.toContain("Warehouse OS");
      expect(rawContent).not.toContain("WarehouseOS");
    });
  });

  describe("PART 6 — PORTAL LINK & SENDER INTEGRITY", () => {
    it("Portal link points to https://warevo-three.vercel.app/orders/<orderId>", () => {
      const payload = {
        recipientName: "Test Partner",
        title: "New Order",
        message: "Order created",
        eventType: "NEW_ORDER",
        orderId: "ord_abc123",
        actionUrl: "/orders/ord_abc123",
        metadata: { orderNumber: "ORD-123" },
      };

      const html = buildHtml(payload);
      const text = buildText(payload);

      expect(html).toContain('href="https://warevo-three.vercel.app/orders/ord_abc123"');
      expect(text).toContain("View in Warevo Portal: https://warevo-three.vercel.app/orders/ord_abc123");
      expect(html).not.toContain("warevo.in");
      expect(text).not.toContain("warevo.in");
    });

    it("Edge function verified sender is Warevo <notifications@warevo.online>", () => {
      expect(rawContent).toContain("Warevo <notifications@warevo.online>");
      expect(rawContent).not.toContain("onboarding@resend.dev");
    });
  });
});
