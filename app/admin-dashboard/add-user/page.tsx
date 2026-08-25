import { Users, ArrowLeft } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Role, UserStatus } from "@prisma/client";
import { UserAccountForm } from "@/components/user-account-form";

async function addUser(formData: FormData) {
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

  // Check if email already exists
  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error(`A user with email '${email}' already exists.`);
    }
  }

  // Determine tenant ID
  let finalTenantId = role === "PLATFORM_ADMIN" || tenantId === "NONE" || !tenantId ? null : tenantId;

  // Create User
  const createdUser = await prisma.user.create({
    data: {
      name,
      email: email || null,
      mobile: mobile || null,
      role,
      tenantId: finalTenantId,
      status,
    },
  });

  // If role is CLIENT, link or create the Client record
  if (role === Role.CLIENT) {
    if (clientCompanyId && clientCompanyId !== "NEW") {
      // Link to existing client company
      await prisma.client.update({
        where: { id: clientCompanyId },
        data: { userId: createdUser.id },
      });
    } else if (newCompanyName && finalTenantId) {
      // Create new client company linked to this user
      await prisma.client.create({
        data: {
          tenantId: finalTenantId,
          userId: createdUser.id,
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

export default async function AddUserPage() {
  const [tenants, clientCompanies] = await Promise.all([
    prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
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
              <h1 className="text-2xl font-bold text-slate-900">Add New User</h1>
              <p className="text-sm text-slate-500">
                Create a new user account with role-specific warehouse or client company assignment.
              </p>
            </div>
          </div>

          <UserAccountForm
            mode="create"
            tenants={tenants}
            clientCompanies={clientCompanies}
            action={addUser}
          />
        </Card>
      </div>
    </main>
  );
}