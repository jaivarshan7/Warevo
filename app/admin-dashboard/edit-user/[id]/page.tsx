import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Users, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Role, UserStatus } from "@prisma/client";
import { UserAccountForm } from "@/components/user-account-form";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, tenants, clientCompanies] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        tenant: true,
        client: true,
      },
    }),
    prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      select: {
        id: true,
        companyName: true,
        contactPerson: true,
        mobile: true,
        tenantId: true,
      },
      orderBy: { companyName: "asc" },
    }),
  ]);

  if (!user) {
    notFound();
  }

  async function updateUser(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const mobile = String(formData.get("mobile") ?? "").trim();
    const role = (String(formData.get("role") ?? "WAREHOUSE_STAFF") as Role) || Role.WAREHOUSE_STAFF;
    const tenantId = String(formData.get("tenantId") ?? "").trim();
    const clientCompanyId = String(formData.get("clientCompanyId") ?? "").trim();
    const newCompanyName = String(formData.get("newCompanyName") ?? "").trim();
    const status = (String(formData.get("status") ?? "ACTIVE") as UserStatus) || UserStatus.ACTIVE;

    if (!name) {
      throw new Error("Full name is required.");
    }

    if (!email && !mobile) {
      throw new Error("Either email or mobile number is required.");
    }

    // Check if email already belongs to another user
    if (email) {
      const existing = await prisma.user.findFirst({
        where: {
          email,
          id: { not: id },
        },
      });
      if (existing) {
        throw new Error(`Email '${email}' is already in use by another user.`);
      }
    }

    const finalTenantId = role === "PLATFORM_ADMIN" || tenantId === "NONE" || !tenantId ? null : tenantId;

    await prisma.user.update({
      where: { id },
      data: {
        name,
        email: email || null,
        mobile: mobile || null,
        role,
        tenantId: finalTenantId,
        status,
      },
    });

    // Handle client company association if role is CLIENT
    if (role === Role.CLIENT) {
      if (clientCompanyId && clientCompanyId !== "NEW") {
        await prisma.client.update({
          where: { id: clientCompanyId },
          data: { userId: id },
        });
      } else if (newCompanyName && finalTenantId) {
        await prisma.client.create({
          data: {
            tenantId: finalTenantId,
            userId: id,
            companyName: newCompanyName,
            contactPerson: name,
            mobile: mobile || "N/A",
            email: email || null,
            billingAddress: "Client Billing Address",
            shippingAddress: "Client Shipping Address",
          },
        });
      }
    }

    revalidatePath("/admin-dashboard");
    redirect("/admin-dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/admin-dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>

        <Card className="p-8 shadow-sm">
          <div className="mb-8 flex items-center gap-3 border-b border-border pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Edit User Account</h1>
              <p className="text-sm text-slate-500">
                Update account details, role permissions, and organization/company assignment.
              </p>
            </div>
          </div>

          <UserAccountForm
            mode="edit"
            initialData={{
              id: user.id,
              name: user.name,
              email: user.email,
              mobile: user.mobile,
              role: user.role,
              tenantId: user.tenantId,
              status: user.status,
              clientCompanyId: user.client?.id ?? null,
              newCompanyName: user.client?.companyName ?? "",
            }}
            tenants={tenants}
            clientCompanies={clientCompanies}
            action={updateUser}
          />
        </Card>
      </div>
    </main>
  );
}
