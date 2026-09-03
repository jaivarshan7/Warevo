import { ArrowLeft, UserPlus } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientEmployeeRole, Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function addEmployee(formData: FormData) {
  "use server";

  const clientCompanyId = String(formData.get("clientCompanyId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const mobile = String(formData.get("mobile") ?? "").trim();
  const employeeRole = String(formData.get("employeeRole") ?? "RECEIVER") as ClientEmployeeRole;
  const status = String(formData.get("status") ?? "ACTIVE") as UserStatus;

  if (!clientCompanyId || !name || !mobile) {
    throw new Error("Company, employee name, and mobile number are required.");
  }

  const company = await prisma.client.findUnique({ where: { id: clientCompanyId } });
  if (!company) {
    throw new Error("Please select an existing client company.");
  }

  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error(`A user with email '${email}' already exists.`);
    }
  }

  const createdUser = await prisma.user.create({
    data: {
      tenantId: company.tenantId,
      name,
      email: email || null,
      mobile,
      role: employeeRole === "ACCOUNT" ? Role.CLIENT_ACCOUNTANT : Role.CLIENT,
      status,
    },
  });

  await prisma.client.create({
    data: {
      tenantId: company.tenantId,
      userId: createdUser.id,
      companyGroupId: company.companyGroupId,
      companyName: company.companyName,
      contactPerson: name,
      mobile,
      email: email || null,
      gstNumber: company.gstNumber,
      billingAddress: company.billingAddress,
      shippingAddress: company.shippingAddress,
      employeeRole,
      status: "ACTIVE",
    },
  });

  revalidatePath("/admin-dashboard");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/orders/new");
  redirect("/admin-dashboard");
}

export default async function AddEmployeePage() {
  const clientRecords = await prisma.client.findMany({
    select: {
      id: true,
      tenantId: true,
      companyName: true,
    },
    where: { companyName: { not: "" } },
    orderBy: [{ companyName: "asc" }, { createdAt: "asc" }],
  });

  const clientCompanies = Array.from(
    new Map(
      clientRecords.map((client) => [
        `${client.tenantId}:${client.companyName}`,
        client,
      ]),
    ).values(),
  );

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/admin-dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back to Admin Console
          </Link>
        </div>

        <Card className="p-8 shadow-sm">
          <div className="mb-8 flex items-center gap-3 border-b border-border pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-primary">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Add Employee</h1>
              <p className="text-sm text-slate-500">Add an employee to an existing client company.</p>
            </div>
          </div>

          <form action={addEmployee} className="space-y-5">
            <div>
              <label htmlFor="clientCompanyId" className="mb-1 block text-xs font-semibold text-slate-700">Existing Client Company <span className="text-red-500">*</span></label>
              <select id="clientCompanyId" name="clientCompanyId" required defaultValue={clientCompanies[0]?.id ?? ""} className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none">
                <option value="" disabled>Select a company</option>
                {clientCompanies.map((company) => (
                  <option key={`${company.tenantId}:${company.companyName}`} value={company.id}>
                    {company.companyName}
                  </option>
                ))}
              </select>
              {clientCompanies.length === 0 && <p className="mt-1 text-xs text-red-600">Create a client company before adding an employee.</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1 block text-xs font-semibold text-slate-700">Employee Name <span className="text-red-500">*</span></label>
                <input id="name" name="name" required className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label htmlFor="mobile" className="mb-1 block text-xs font-semibold text-slate-700">Mobile Number <span className="text-red-500">*</span></label>
                <input id="mobile" name="mobile" type="tel" required className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
                <input id="email" name="email" type="email" className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label htmlFor="employeeRole" className="mb-1 block text-xs font-semibold text-slate-700">Employee Role</label>
                <select id="employeeRole" name="employeeRole" defaultValue="RECEIVER" className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none">
                  <option value="RECEIVER">Receiver</option>
                  <option value="STORE">Store</option>
                  <option value="ACCOUNT">Account</option>
                  <option value="MANAGER">Manager</option>
                  <option value="GM">GM</option>
                  <option value="MD">MD</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="status" className="mb-1 block text-xs font-semibold text-slate-700">Account Status</label>
              <select id="status" name="status" defaultValue="ACTIVE" className="h-10 w-full rounded border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:bg-white focus:outline-none">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end border-t border-border pt-5">
              <Button type="submit" disabled={clientCompanies.length === 0}><UserPlus className="h-4 w-4" /> Add Employee</Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
