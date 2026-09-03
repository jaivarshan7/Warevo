import { Camera, Check, Pencil, ShieldCheck } from "lucide-react";
import { requireDashboardRoute } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInitials } from "@/lib/notifications";
import { Card } from "@/components/ui/card";
import { AvatarUploadForm } from "@/components/avatar-upload-form";

export default async function ProfilePage() {
  const user = await requireDashboardRoute("/dashboard/profile");
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const clientProfile = await prisma.client.findFirst({
    where: { userId: user.id },
    select: { employeeRole: true },
  });
  const displayRole = clientProfile?.employeeRole ?? dbUser?.role ?? user.role;
  const initials = buildInitials(dbUser?.name ?? user.name);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-slate-500">Manage account details, role access, and profile image.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-100 to-sky-100 text-2xl font-semibold text-primary">
              {dbUser?.avatarUrl ? <img src={dbUser.avatarUrl} alt={dbUser.name} className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="mt-4 text-xl font-semibold">{dbUser?.name ?? user.name}</div>
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] uppercase tracking-wide text-slate-600">
              <ShieldCheck className="h-3 w-3" /> {displayRole}
            </div>
            <div className="mt-4 w-full">
              <AvatarUploadForm currentAvatarUrl={dbUser?.avatarUrl ?? null} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Account information</h2>
            <button type="button" className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs font-medium text-slate-600">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoRow label="Full name" value={dbUser?.name ?? user.name} />
            <InfoRow label="Role" value={displayRole} />
            <InfoRow label="Email" value={dbUser?.email ?? user.email ?? "Not available"} />
            <InfoRow label="Mobile" value={dbUser?.mobile ?? user.mobile ?? "Not available"} />
          </div>

          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <div className="flex items-center gap-2 font-medium"><Check className="h-4 w-4" /> Access status</div>
            <div className="mt-1">Your role and tenant access remain controlled by the existing RBAC system.</div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-slate-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-800">{value}</div>
    </div>
  );
}
