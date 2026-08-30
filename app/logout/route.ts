import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  const cookieNames = ["demo-user-id", "demo-user-email", "demo-user-mobile", "supabase-auth-token", "sb-access-token", "sb-refresh-token"];
  for (const name of cookieNames) {
    cookieStore.delete(name);
  }

  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
}
