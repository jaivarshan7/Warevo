import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase";

const requestOtpSchema = z.object({
  tenantSlug: z.string().min(1),
  mobile: z.string().min(8)
});

export async function POST(request: Request) {
  const body = requestOtpSchema.parse(await request.json());
  const tenant = await prisma.tenant.findUnique({ where: { slug: body.tenantSlug } });
  if (!tenant || tenant.status !== "ACTIVE") {
    return NextResponse.json({ error: "This mobile number is not registered with this warehouse. Please contact your warehouse." }, { status: 404 });
  }
  const client = await prisma.client.findUnique({ where: { tenantId_mobile: { tenantId: tenant.id, mobile: body.mobile } } });
  if (!client || client.status !== "ACTIVE") {
    return NextResponse.json({ error: "This mobile number is not registered with this warehouse. Please contact your warehouse." }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: body.mobile, options: { shouldCreateUser: false } });
  if (error) return NextResponse.json({ error: "Unable to send OTP. Please try again." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
