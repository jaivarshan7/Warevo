import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase";

const verifyOtpSchema = z.object({
  tenantSlug: z.string().min(1),
  mobile: z.string().min(8),
  token: z.string().min(4)
});

export async function POST(request: Request) {
  const body = verifyOtpSchema.parse(await request.json());
  const tenant = await prisma.tenant.findUnique({ where: { slug: body.tenantSlug } });
  if (!tenant) return NextResponse.json({ error: "Unknown warehouse." }, { status: 404 });
  const client = await prisma.client.findUnique({ where: { tenantId_mobile: { tenantId: tenant.id, mobile: body.mobile } } });
  if (!client) return NextResponse.json({ error: "This mobile number is not registered with this warehouse. Please contact your warehouse." }, { status: 404 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone: body.mobile, token: body.token, type: "sms" });
  if (error || !data.user) return NextResponse.json({ error: "Invalid or expired OTP." }, { status: 401 });

  await prisma.user.updateMany({ where: { id: client.userId ?? "", tenantId: tenant.id, role: "CLIENT" }, data: { supabaseUserId: data.user.id } });
  return NextResponse.json({ ok: true });
}
