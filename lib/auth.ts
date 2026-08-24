import { Role, User } from "@prisma/client";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase";
import { canAccessTenant } from "@/lib/rbac";

export type AppSession = Pick<User, "id" | "tenantId" | "role" | "name" | "email" | "mobile">;

export async function getCurrentUser(): Promise<AppSession | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user?.id) {
    const user = await prisma.user.findUnique({ where: { supabaseUserId: data.user.id } });
    if (user) return user;
  }

  const headerStore = await headers();
  const cookieStore = await cookies();
  const demoEmail = headerStore.get("x-demo-user-email");
  const demoCookieEmail = cookieStore.get("demo-user-email")?.value;
  const fallbackEmail = process.env.DEMO_USER_EMAIL;
  const email = demoEmail ?? demoCookieEmail ?? fallbackEmail;
  if (!email) return null;
  return prisma.user.findUnique({ where: { email } });
}

export async function requireUser(allowedRoles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (allowedRoles && !allowedRoles.includes(user.role)) throw new Error("Unauthorized role.");
  return user;
}

export async function assertTenantAccess(resourceTenantId: string) {
  const user = await requireUser();
  if (!canAccessTenant(user.role, user.tenantId, resourceTenantId)) {
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        userRole: user.role,
        action: "Blocked cross-tenant access attempt",
        entity: "Tenant",
        entityId: resourceTenantId,
        newValue: { resourceTenantId }
      }
    });
    throw new Error("Resource not found or unavailable.");
  }
  return user;
}
