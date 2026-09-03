import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientsDirectoryView } from "@/components/clients-directory-view";
import { ClientEmployeeRole, Role } from "@prisma/client";

export default async function ClientsPage() {
  const user = await requireUser(["WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "ACCOUNTANT", "PLATFORM_ADMIN"]);
  const tenantWhere = user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" };

  const clients = await prisma.client.findMany({
    where: tenantWhere,
    include: {
      orders: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
        },
      },
    },
    orderBy: { companyName: "asc" },
  });

  async function addClientAction(data: {
    companyName: string;
    contactPerson: string;
    mobile: string;
    email?: string;
    gstNumber?: string;
    billingAddress?: string;
    shippingAddress?: string;
    employeeRole?: string;
  }) {
    "use server";

    const currentUser = await requireUser(["WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "PLATFORM_ADMIN"]);
    let tenantId = currentUser.tenantId;

    if (!tenantId) {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id ?? "";
    }

    if (!tenantId) {
      throw new Error("No organization tenant found.");
    }

    // Check if employee with same mobile already exists under this tenant
    const existing = await prisma.client.findFirst({
      where: {
        tenantId,
        mobile: data.mobile,
      },
    });

    if (existing) {
      throw new Error(`An employee with mobile ${data.mobile} is already registered under ${existing.companyName}.`);
    }

    // Check if user already exists with this mobile or email
    let userId: string | null = null;
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { mobile: data.mobile },
          ...(data.email ? [{ email: data.email }] : []),
        ],
      },
    });

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const createdUser = await prisma.user.create({
        data: {
          tenantId,
          name: data.contactPerson,
          mobile: data.mobile,
          email: data.email || null,
          role: data.employeeRole === "ACCOUNT" ? Role.CLIENT_ACCOUNTANT : Role.CLIENT,
          status: "ACTIVE",
        },
      });
      userId = createdUser.id;
    }

    await prisma.client.create({
      data: {
        tenantId,
        userId,
        companyName: data.companyName,
        contactPerson: data.contactPerson,
        mobile: data.mobile,
        email: data.email || null,
        gstNumber: data.gstNumber || null,
        billingAddress: data.billingAddress || data.shippingAddress || "Client Billing Address",
        shippingAddress: data.shippingAddress || data.billingAddress || "Client Shipping Address",
        employeeRole: (data.employeeRole || "RECEIVER") as ClientEmployeeRole,
      },
    });

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/orders/new");
    revalidatePath("/dashboard/orders/track");
    revalidatePath("/admin-dashboard");
  }

  async function updateClientAction(data: {
    id: string;
    companyName: string;
    contactPerson: string;
    mobile: string;
    email?: string;
    gstNumber?: string;
    billingAddress?: string;
    shippingAddress?: string;
    employeeRole?: string;
    status: string;
  }) {
    "use server";

    const currentUser = await requireUser(["WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "PLATFORM_ADMIN"]);
    let tenantId = currentUser.tenantId;

    if (!tenantId) {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id ?? "";
    }

    if (!tenantId) {
      throw new Error("No organization tenant found.");
    }

    // Check if mobile already exists for another client
    const existing = await prisma.client.findFirst({
      where: {
        tenantId,
        mobile: data.mobile,
        id: { not: data.id },
      },
    });

    if (existing) {
      throw new Error(`An employee with mobile ${data.mobile} is already registered under ${existing.companyName}.`);
    }

    const updatedClient = await prisma.client.update({
      where: { id: data.id },
      data: {
        companyName: data.companyName,
        contactPerson: data.contactPerson,
        mobile: data.mobile,
        email: data.email || null,
        gstNumber: data.gstNumber || null,
        billingAddress: data.billingAddress || data.shippingAddress || "Client Billing Address",
        shippingAddress: data.shippingAddress || data.billingAddress || "Client Shipping Address",
        status: data.status as any,
      },
    });

    // Also update associated user if linked
    if (updatedClient.userId) {
      await prisma.user.update({
        where: { id: updatedClient.userId },
        data: {
          name: data.contactPerson,
          mobile: data.mobile,
          email: data.email || null,
          role: data.employeeRole === "ACCOUNT" ? Role.CLIENT_ACCOUNTANT : Role.CLIENT,
        },
      });
    }

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/orders/new");
    revalidatePath("/dashboard/orders/track");
    revalidatePath("/admin-dashboard");
  }

  return (
    <section className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Client Companies & Employee Directory</h1>
        <p className="text-sm text-slate-500">
          Manage corporate client accounts, register multiple employee contacts per company, and track delivery destinations.
        </p>
      </div>

      <ClientsDirectoryView
        clients={clients.map((c) => ({
          ...c,
          orders: c.orders.map((o) => ({
            ...o,
            totalAmount: Number(o.totalAmount),
          })),
        }))}
        onAddClient={addClientAction}
        onUpdateClient={updateClientAction}
      />
    </section>
  );
}
