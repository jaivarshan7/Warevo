import { Building2, Lock, Shield } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function signIn(formData: FormData): Promise<void> {
  "use server";
  
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) {
    redirect("/login?error=missing_input");
  }

  // Look up user by email or mobile
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { mobile: identifier },
        { mobile: `+91${identifier.replace(/^\+91/, "")}` },
        { mobile: identifier.replace(/^\+91/, "") },
      ],
    },
  });

  if (!user) {
    redirect("/login?error=user_not_found");
  }

  const cookieStore = await cookies();
  cookieStore.set("demo-user-id", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  if (user.email) {
    cookieStore.set("demo-user-email", user.email, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }
  if (user.mobile) {
    cookieStore.set("demo-user-mobile", user.mobile, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }

  redirect("/dashboard");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = !!params?.error;
  const errorMessage =
    params?.error === "missing_input"
      ? "Please enter your registered email or mobile number."
      : params?.error === "user_not_found"
      ? "No user account was found with that email or mobile number."
      : "An error occurred during sign-in. Please try again.";

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4 md:p-8">
      <div className="w-full max-w-lg space-y-4">
        <Card className="p-8 shadow-md border-border/80">
          {/* Header */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-primary shadow-sm">
              <Building2 className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">Sign in to Warevo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Commercial multi-tenant warehouse & inventory operating system
            </p>
          </div>

          {/* Error Banner */}
          {hasError && (
            <div className="mb-5 rounded-lg bg-red-50 p-3.5 text-xs font-medium text-red-700 border border-red-200">
              {errorMessage}
            </div>
          )}

          {/* Direct Sign-In Form */}
          <form action={signIn} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Address or Mobile Number
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                placeholder="e.g. staff-apex@example.test or +919800000001"
                required
                className="h-11 w-full rounded-md border border-border bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            <Button className="w-full justify-center h-11 text-sm font-semibold shadow-sm" type="submit">
              <Lock className="h-4 w-4" />
              Sign in to Dashboard
            </Button>
          </form>

          {/* Admin Login Link */}
          <div className="mt-8 border-t border-border pt-4 text-center">
            <Link
              href="/admin-login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-primary transition"
            >
              <Shield className="h-3.5 w-3.5 text-primary" />
              Are you a Platform Administrator? <span className="underline font-semibold">Admin Login</span>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
