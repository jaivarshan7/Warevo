import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SendEmailRequest {
  tenantId: string;
  eventType: string;
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  notificationId?: string | null;
  orderId?: string | null;
  invoiceId?: string | null;
  title: string;
  message: string;
  actionUrl?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authorization check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid authorization header", code: "AUTH_MISSING" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
    const supabaseServiceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    const resendApiKey = (Deno.env.get("RESEND_API_KEY") || Deno.env.get("resend") || "").trim();
    const fromEmail = (Deno.env.get("RESEND_FROM_EMAIL") || "Warevo <notifications@warevo.online>").trim();

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error", code: "SERVER_CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body: SendEmailRequest = await req.json();
    const {
      tenantId,
      eventType,
      recipientUserId,
      notificationId,
      orderId,
      invoiceId,
      title,
      message,
      actionUrl,
      metadata = {},
    } = body;

    let targetEmail = body.recipientEmail?.trim() || null;
    let targetName = body.recipientName?.trim() || null;

    if (!tenantId || !eventType || !title || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields (tenantId, eventType, title, message)", code: "INVALID_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Caller Identity & Tenant Isolation Verification
    // Check if token is service role key (internal trusted system)
    const isServiceRole = token === supabaseServiceRoleKey;
    if (!isServiceRole) {
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid authentication token", code: "INVALID_TOKEN" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: callerUser, error: callerError } = await supabaseAdmin
        .from("User")
        .select("id, role, tenantId, status")
        .eq("supabaseUserId", authUser.id)
        .single();

      if (callerError || !callerUser) {
        return new Response(
          JSON.stringify({ success: false, error: "Caller profile not found", code: "CALLER_NOT_FOUND" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (callerUser.status !== "ACTIVE") {
        return new Response(
          JSON.stringify({ success: false, error: "Caller account is inactive", code: "CALLER_INACTIVE" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (callerUser.role !== "PLATFORM_ADMIN" && callerUser.tenantId !== tenantId) {
        return new Response(
          JSON.stringify({ success: false, error: "Tenant boundary violation", code: "TENANT_MISMATCH" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Recipient Resolution & Inactive / Cross-Tenant Check
    if (recipientUserId) {
      let recipientUser: any = null;
      const { data: uData, error: recError } = await supabaseAdmin
        .from("User")
        .select("id, name, email, tenantId, status")
        .eq("id", recipientUserId)
        .maybeSingle();

      if (uData) {
        recipientUser = uData;
      } else {
        // Fallback: check ClientEmployee table by id
        const { data: empData } = await supabaseAdmin
          .from("ClientEmployee")
          .select("id, contactPerson, email, tenantId, status, userId, user:User(id, name, email, tenantId, status)")
          .eq("id", recipientUserId)
          .maybeSingle();

        if (empData) {
          const linkedUser: any = Array.isArray(empData.user) ? empData.user[0] : empData.user;
          recipientUser = {
            id: linkedUser?.id || null,
            name: empData.contactPerson || linkedUser?.name,
            email: empData.email || linkedUser?.email,
            tenantId: empData.tenantId,
            status: empData.status === "ACTIVE" && (!linkedUser || linkedUser.status === "ACTIVE") ? "ACTIVE" : "INACTIVE",
          };
        }
      }

      if (!recipientUser) {
        return new Response(
          JSON.stringify({ success: false, error: "Recipient user not found", code: "RECIPIENT_NOT_FOUND" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Cross-tenant recipient check
      if (recipientUser.tenantId !== tenantId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Recipient belongs to another tenant (cross-tenant isolation violation)",
            code: "CROSS_TENANT_RECIPIENT_BLOCKED",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Inactive user check
      if (recipientUser.status !== "ACTIVE") {
        await logEmail({
          supabaseAdmin,
          tenantId,
          eventType,
          recipientEmail: recipientUser.email || "none@unknown.local",
          recipientUserId: recipientUser.id || null,
          notificationId,
          orderId,
          subject: `[Warevo] ${title}`,
          status: "SKIPPED",
          reason: "Recipient user is inactive",
          idempotencyKey: body.idempotencyKey,
        });

        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "Recipient user is inactive",
            code: "RECIPIENT_INACTIVE",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!recipientUser.email) {
        await logEmail({
          supabaseAdmin,
          tenantId,
          eventType,
          recipientEmail: "none@unknown.local",
          recipientUserId: recipientUser.id || null,
          notificationId,
          orderId,
          subject: `[Warevo] ${title}`,
          status: "SKIPPED",
          reason: "Recipient user has no email address",
          idempotencyKey: body.idempotencyKey,
        });

        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "Recipient user has no email address",
            code: "MISSING_EMAIL",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetEmail = body.recipientEmail?.trim() || recipientUser.email;
      targetName = body.recipientName?.trim() || recipientUser.name || targetName;
    }

    if (!targetEmail) {
      await logEmail({
        supabaseAdmin,
        tenantId,
        eventType,
        recipientEmail: "none@unknown.local",
        recipientUserId: recipientUserId || null,
        notificationId,
        orderId,
        subject: `[Warevo] ${title}`,
        status: "SKIPPED",
        reason: "No recipient email address provided",
        idempotencyKey: body.idempotencyKey,
      });

      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "No recipient email address provided",
          code: "MISSING_EMAIL",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recipientUserId && targetEmail) {
      // Authoritative tenant validation: targetEmail must belong to an active User, registered Client, or ClientEmployee within this tenant!
      const { data: matchedUser } = await supabaseAdmin
        .from("User")
        .select("id, tenantId, status")
        .eq("email", targetEmail)
        .eq("tenantId", tenantId)
        .maybeSingle();

      const { data: matchedClient } = await supabaseAdmin
        .from("Client")
        .select("id, tenantId")
        .eq("email", targetEmail)
        .eq("tenantId", tenantId)
        .maybeSingle();

      const { data: matchedEmployee } = await supabaseAdmin
        .from("ClientEmployee")
        .select("id, tenantId, status, userId")
        .eq("email", targetEmail)
        .eq("tenantId", tenantId)
        .maybeSingle();

      if (!matchedUser && !matchedClient && !matchedEmployee) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Recipient email does not belong to any active user or registered client in this tenant",
            code: "CROSS_TENANT_RECIPIENT_BLOCKED",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((matchedUser && matchedUser.status !== "ACTIVE") || (matchedEmployee && matchedEmployee.status !== "ACTIVE")) {
        await logEmail({
          supabaseAdmin,
          tenantId,
          eventType,
          recipientEmail: targetEmail,
          recipientUserId: matchedUser?.id || matchedEmployee?.userId || null,
          notificationId,
          orderId,
          subject: `[Warevo] ${title}`,
          status: "SKIPPED",
          reason: "Recipient user is inactive",
          idempotencyKey: body.idempotencyKey,
        });

        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "Recipient user is inactive",
            code: "RECIPIENT_INACTIVE",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Notification Preferences Check (Default OFF)
    const { data: settingsData } = await supabaseAdmin
      .from("NotificationSettings")
      .select("enabled, eventConfig")
      .eq("tenantId", tenantId)
      .maybeSingle();

    const notificationsGloballyEnabled = settingsData ? settingsData.enabled !== false : true;
    const eventConfig = settingsData?.eventConfig || {};
    // Explicit opt-in: default is false/OFF
    const eventEmailEnabled = eventConfig[eventType]?.clientEmail === true;

    if (!notificationsGloballyEnabled) {
      await logEmail({
        supabaseAdmin,
        tenantId,
        eventType,
        recipientEmail: targetEmail,
        recipientUserId,
        notificationId,
        orderId,
        subject: `[Warevo] ${title}`,
        status: "SKIPPED",
        reason: "Tenant notifications globally disabled",
        idempotencyKey: body.idempotencyKey,
      });

      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "Tenant notifications globally disabled",
          code: "NOTIFICATIONS_DISABLED",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!eventEmailEnabled) {
      await logEmail({
        supabaseAdmin,
        tenantId,
        eventType,
        recipientEmail: targetEmail,
        recipientUserId,
        notificationId,
        orderId,
        subject: `[Warevo] ${title}`,
        status: "SKIPPED",
        reason: `Email notifications disabled for event ${eventType} (default OFF)`,
        idempotencyKey: body.idempotencyKey,
      });

      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: `Email notifications disabled for event ${eventType}`,
          code: "EMAIL_PREFERENCE_OFF",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Retry Safety / Idempotency Check
    const idempotencyKey =
      body.idempotencyKey ||
      `${tenantId}_${eventType}_${notificationId || orderId || invoiceId || "generic"}_${targetEmail}`;

    const { data: existingLog } = await supabaseAdmin
      .from("EmailLog")
      .select("id, status, resendId")
      .eq("idempotencyKey", idempotencyKey)
      .maybeSingle();

    if (existingLog && existingLog.status === "SENT") {
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          emailId: existingLog.resendId,
          message: "Email already sent previously (idempotent)",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Resend API Dispatch
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY is not configured. Email will be logged as SKIPPED.");
      await logEmail({
        supabaseAdmin,
        tenantId,
        eventType,
        recipientEmail: targetEmail,
        recipientUserId,
        notificationId,
        orderId,
        subject: `[Warevo] ${title}`,
        status: "SKIPPED",
        reason: "RESEND_API_KEY not configured",
        idempotencyKey,
      });

      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "RESEND_API_KEY not configured",
          code: "RESEND_KEY_MISSING",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize orderId and clean titles/messages
    const safeOrderId = (orderId && orderId !== "undefined")
      ? orderId
      : ((metadata.orderId || metadata.order_id) as string | undefined) || null;

    const orderNum = (
      (metadata.orderNumber || metadata.order_number || (body as any).orderNumber) as string | undefined
    );
    const safeOrderNum = (orderNum && orderNum !== "undefined") ? orderNum : undefined;

    let cleanTitle = title || "Notification";
    let cleanMessage = message || "";
    if (safeOrderNum) {
      cleanTitle = cleanTitle.replace(/undefined/g, safeOrderNum);
      cleanMessage = cleanMessage.replace(/undefined/g, safeOrderNum);
    } else {
      cleanTitle = cleanTitle.replace(/: undefined/g, "").replace(/undefined/g, "").trim();
      cleanMessage = cleanMessage.replace(/Order undefined/g, "Your order").replace(/undefined/g, "").trim();
    }

    const subject = `[Warevo] ${cleanTitle}`;
    const htmlContent = buildEmailHtml({
      recipientName: targetName || "Valued Partner",
      title: cleanTitle,
      message: cleanMessage,
      eventType,
      orderId: safeOrderId,
      actionUrl,
      metadata: {
        ...metadata,
        ...(safeOrderNum ? { orderNumber: safeOrderNum } : {}),
      },
    });
    const textContent = buildEmailText({
      recipientName: targetName || "Valued Partner",
      title: cleanTitle,
      message: cleanMessage,
      eventType,
      orderId: safeOrderId,
      actionUrl,
      metadata: {
        ...metadata,
        ...(safeOrderNum ? { orderNumber: safeOrderNum } : {}),
      },
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [targetEmail],
        subject,
        html: htmlContent,
        text: textContent,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend delivery failed:", resendData);
      const errorMessage = resendData.message || resendData.error || "Resend API error";

      await logEmail({
        supabaseAdmin,
        tenantId,
        eventType,
        recipientEmail: targetEmail,
        recipientUserId,
        notificationId,
        orderId: safeOrderId,
        subject,
        status: "FAILED",
        error: errorMessage,
        idempotencyKey,
      });

      return new Response(
        JSON.stringify({ success: false, error: errorMessage, code: "RESEND_ERROR" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Successful Delivery Logging
    const resendId = resendData.id;
    await logEmail({
      supabaseAdmin,
      tenantId,
      eventType,
      recipientEmail: targetEmail,
      recipientUserId,
      notificationId,
      orderId: safeOrderId,
      subject,
      status: "SENT",
      resendId,
      idempotencyKey,
      metadata: { resendResponse: resendData, metadata },
    });

    return new Response(
      JSON.stringify({
        success: true,
        emailId: resendId,
        recipientEmail: targetEmail,
        eventType,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unexpected error in send-email Edge Function:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Internal server error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface LogEmailParams {
  supabaseAdmin: any;
  tenantId: string;
  eventType: string;
  recipientEmail: string;
  recipientUserId?: string | null;
  notificationId?: string | null;
  orderId?: string | null;
  subject: string;
  status: "PENDING" | "SENT" | "SKIPPED" | "FAILED";
  resendId?: string | null;
  reason?: string | null;
  error?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}

async function logEmail(params: LogEmailParams) {
  try {
    const {
      supabaseAdmin,
      tenantId,
      eventType,
      recipientEmail,
      recipientUserId,
      notificationId,
      orderId,
      subject,
      status,
      resendId,
      reason,
      error,
      idempotencyKey,
      metadata = {},
    } = params;

    const id = `elog_${Math.random().toString(36).substring(2, 18)}`;

    await supabaseAdmin.from("EmailLog").upsert(
      {
        id,
        tenantId,
        eventType,
        recipientEmail,
        recipientUserId: recipientUserId || null,
        notificationId: notificationId || null,
        orderId: orderId || null,
        subject,
        status,
        resendId: resendId || null,
        reason: reason || null,
        error: error || null,
        idempotencyKey: idempotencyKey || null,
        metadata,
        createdAt: new Date().toISOString(),
      },
      { onConflict: "idempotencyKey" }
    );
  } catch (logErr) {
    console.warn("Failed to write EmailLog:", logErr);
  }
}

function buildEmailHtml(params: {
  recipientName: string;
  title: string;
  message: string;
  eventType: string;
  orderId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { recipientName, title, message, eventType, orderId, actionUrl, metadata = {} } = params;
  const rawAppUrl = Deno.env.get("APP_URL");
  if (!rawAppUrl || !rawAppUrl.trim()) {
    throw new Error("Missing required environment variable: APP_URL must be configured for email notification links.");
  }
  const appUrl = rawAppUrl.trim().replace(/\/+$/, "");
  const fullActionUrl = actionUrl
    ? (actionUrl.startsWith("http") ? actionUrl : `${appUrl}${actionUrl.startsWith("/") ? "" : "/"}${actionUrl}`)
    : appUrl;

  const rawOrderNum = (metadata.orderNumber || metadata.order_number) as string | undefined;
  const orderNum = (rawOrderNum && rawOrderNum !== "undefined") ? rawOrderNum : undefined;
  const invNum = (metadata.invoiceNumber || metadata.invoice_number) as string | undefined;
  const payAmt = metadata.paymentAmount !== undefined ? String(metadata.paymentAmount) : (metadata.totalAmount !== undefined ? String(metadata.totalAmount) : undefined);
  const verifStatus = metadata.verificationStatus as string | undefined;
  const itemsCount = metadata.itemsCount !== undefined ? String(metadata.itemsCount) : undefined;
  const carrier = metadata.carrier as string | undefined;

  const metaRows: string[] = [];
  if (orderNum) metaRows.push(`<div style="padding: 6px 0; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Order Number:</span><strong style="color: #f8fafc;">${orderNum}</strong></div>`);
  if (invNum) metaRows.push(`<div style="padding: 6px 0; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Invoice Number:</span><strong style="color: #f8fafc;">${invNum}</strong></div>`);
  if (payAmt) metaRows.push(`<div style="padding: 6px 0; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Amount:</span><strong style="color: #10b981;">₹${payAmt}</strong></div>`);
  if (verifStatus) metaRows.push(`<div style="padding: 6px 0; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Verification:</span><strong style="color: #38bdf8;">${verifStatus}</strong></div>`);
  if (itemsCount) metaRows.push(`<div style="padding: 6px 0; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Item Lines:</span><strong style="color: #f8fafc;">${itemsCount}</strong></div>`);
  if (carrier) metaRows.push(`<div style="padding: 6px 0; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Carrier:</span><strong style="color: #f8fafc;">${carrier}</strong></div>`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); padding: 28px; border-bottom: 1px solid #1e293b; text-align: left; }
    .brand { font-size: 20px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; margin-bottom: 8px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); text-transform: uppercase; letter-spacing: 0.5px; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 15px; color: #94a3b8; margin-bottom: 16px; }
    .headline { font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; line-height: 1.3; }
    .message-box { background: rgba(15, 23, 42, 0.6); border: 1px solid #1e293b; border-radius: 12px; padding: 20px; font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .meta-box { background: rgba(30, 41, 59, 0.4); border: 1px solid #1e293b; border-radius: 12px; padding: 14px 18px; margin-bottom: 28px; font-size: 13px; }
    .cta-btn { display: inline-block; background: #4f46e5; color: #ffffff !important; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 10px; transition: background 0.2s; }
    .footer { padding: 24px 28px; background: #0c1222; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">Warevo</div>
      <span class="badge">${eventType.replace(/_/g, " ")}</span>
    </div>
    <div class="content">
      <div class="greeting">Hello ${recipientName},</div>
      <h2 class="headline">${title}</h2>
      <div class="message-box">
        ${message}
      </div>
      ${metaRows.length > 0 ? `<div class="meta-box">${metaRows.join("")}</div>` : ""}
      <div>
        <a href="${fullActionUrl}" class="cta-btn" target="_blank">View in Warevo Portal</a>
      </div>
    </div>
    <div class="footer">
      This is an automated notification sent according to your warehouse notification preferences.<br>
      © ${new Date().getFullYear()} Warevo. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(params: {
  recipientName: string;
  title: string;
  message: string;
  eventType: string;
  orderId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { recipientName, title, message, eventType, orderId, actionUrl, metadata = {} } = params;
  const rawAppUrl = Deno.env.get("APP_URL");
  if (!rawAppUrl || !rawAppUrl.trim()) {
    throw new Error("Missing required environment variable: APP_URL must be configured for email notification links.");
  }
  const appUrl = rawAppUrl.trim().replace(/\/+$/, "");
  const fullActionUrl = actionUrl
    ? (actionUrl.startsWith("http") ? actionUrl : `${appUrl}${actionUrl.startsWith("/") ? "" : "/"}${actionUrl}`)
    : appUrl;

  const rawOrderNum = (metadata.orderNumber || metadata.order_number) as string | undefined;
  const orderNum = (rawOrderNum && rawOrderNum !== "undefined") ? rawOrderNum : undefined;

  const lines = [
    `Warevo — ${eventType.replace(/_/g, " ")}`,
    "==================================================",
    `Hello ${recipientName},`,
    "",
    title,
    message,
    "",
  ];

  if (orderNum) lines.push(`Order Number: ${orderNum}`);
  if (metadata.invoiceNumber) lines.push(`Invoice Number: ${metadata.invoiceNumber}`);
  if (metadata.paymentAmount || metadata.totalAmount) lines.push(`Amount: ₹${metadata.paymentAmount ?? metadata.totalAmount}`);
  if (metadata.verificationStatus) lines.push(`Verification Status: ${metadata.verificationStatus}`);
  if (metadata.itemsCount) lines.push(`Item Lines: ${metadata.itemsCount}`);
  if (orderId && orderId !== "undefined") lines.push(`Reference Order ID: ${orderId}`);

  lines.push("");
  lines.push(`View in Warevo Portal: ${fullActionUrl}`);
  lines.push("");
  lines.push("This is an automated notification sent according to your warehouse notification preferences.");
  lines.push(`© ${new Date().getFullYear()} Warevo. All rights reserved.`);

  return lines.join("\n");
}
