// app/admin-login/page.tsx
import { Building2, Lock } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NextPage } from "next";
import Link from "next/link";

export default function AdminLoginPage() {
  async function adminSignIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // Check against environment variables
  if (
    process.env.ADMIN_EMAIL &&
    process.env.ADMIN_PASSWORD &&
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const cookieStore = await cookies();
    cookieStore.set("admin-user-email", email, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    redirect("/admin-dashboard");
  } else {
    throw new Error("Invalid admin credentials.");
  }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Admin Login</h1>
            <p className="text-sm text-slate-500">Use email and password for admin access.</p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            className="h-11 w-full rounded border border-border px-3"
            placeholder="Email"
            type="email"
            required
          />
          <input
            className="h-11 w-full rounded border border-border px-3"
            placeholder="Password"
            type="password"
            required
          />
          <Button className="w-full justify-center" type="submit" formAction={adminSignIn}>
            <Lock className="h-4 w-4" />
            Sign in
          </Button>
        </div>

        <div className="mt-5 text-center text-sm text-slate-500">
          <Link href="/">Back to User Login</Link>
        </div>
      </Card>
    </main>
  );
}