// app/login/page.tsx
import { Building2, Lock } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const demoAccounts = [
  { label: "Platform Admin", email: "platform-admin@example.test" },
  { label: "Owner", email: "owner-apex@example.test" },
  { label: "Moderator", email: "moderator-apex@example.test" },
  { label: "Accountant", email: "accountant-apex@example.test" },
  { label: "Staff", email: "staff-apex@example.test" }
];

export default function LoginPage() {
  async function demoSignIn(formData: FormData) {
    "use server";
    const mobile = String(formData.get("mobile") ?? "");
    const otp = String(formData.get("otp") ?? "");
    // For demo, you can validate OTP logic here
    if (!mobile || !otp) throw new Error("Mobile and OTP required.");
    const cookieStore = await cookies();
    cookieStore.set("demo-user-mobile", mobile, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">WarehouseOS sign in</h1>
            <p className="text-sm text-slate-500">Staff and platform accounts use mobile + OTP.</p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            className="h-11 w-full rounded border border-border px-3"
            placeholder="Mobile Number"
            type="tel"
            required
          />
          <input
            className="h-11 w-full rounded border border-border px-3"
            placeholder="OTP"
            type="text"
            required
          />
          <Button className="w-full justify-center" type="submit" formAction={demoSignIn}>
            <Lock className="h-4 w-4" />
            Sign in
          </Button>
        </div>

        <div className="mt-5 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium">Local demo mode</div>
          <p className="mt-1">Use a seeded demo role after running the Prisma migrate and seed commands.</p>
          <div className="mt-3 grid gap-2">
            {demoAccounts.map((account) => (
              <form key={account.email} action={demoSignIn}>
                <input type="hidden" name="mobile" value={account.email} />
                <input type="hidden" name="otp" value="123456" />
                <Button className="w-full justify-center" variant="secondary">
                  {account.label}
                </Button>
              </form>
            ))}
          </div>
        </div>
      </Card>
      

      {/* Semi-transparent button in top-right corner */}
      <Link
        href="/admin-login"
        className="absolute top-2 right-2"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.3)",
          color: "#00e21e",
          border: "none",
          padding: "8px 16px",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "bold",
        }}
      >
        <Building2 className="h-5 w-5" />
      </Link>
    </main>
    
  );
}