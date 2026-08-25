// app/admin-login/page.tsx
import { Building2, Lock } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Removed NextPage import as it's not needed for functional components
import Link from "next/link";

/**
 * Server action to handle admin sign-in.
 * It returns a structured object detailing the outcome (success or failure).
 */
async function adminSignIn(formData: FormData): Promise<void> {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  // 1. Basic validation check
  if (!email || !password) {
    redirect("/admin-login?error=missing_fields");
  }

  // 2. Check against environment variables
  const isCredentialsValid = 
    process.env.ADMIN_EMAIL && 
    process.env.ADMIN_PASSWORD && 
    email === process.env.ADMIN_EMAIL && 
    password === process.env.ADMIN_PASSWORD;

  if (isCredentialsValid) {
    const cookieStore = await cookies();
    cookieStore.set("admin-user-email", email, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });
    redirect("/admin-dashboard");
  } else {
    redirect("/admin-login?error=invalid_credentials");
  }
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = !!params?.error;
  const errorMessage =
    params?.error === "missing_fields"
      ? "Please enter both email and password."
      : "Invalid admin email or password.";
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <Card className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Admin Login</h1>
            <p className="text-sm text-slate-500">
              Use email and password for admin access.
            </p>
          </div>
        </div>

        {hasError && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
            {errorMessage}
          </div>
        )}

        <form className="space-y-3" action={adminSignIn}> 
          <input
            className="h-11 w-full rounded border border-border px-3"
            placeholder="Email"
            type="email"
            name="email"
            required
          />
          <input
            className="h-11 w-full rounded border border-border px-3"
            placeholder="Password"
            type="password"
            name="password"
            required
          />
          <Button
            className="w-full justify-center"
            type="submit"
          >
            <Lock className="h-4 w-4" />
            Sign in
          </Button>
        </form>

        {/* Optional: Display error message here based on form state/return value */}

        <div className="mt-5 text-center text-sm text-slate-500">
          <Link href="/">Back to User Login</Link>
        </div>
      </Card>
    </main>
  );
}