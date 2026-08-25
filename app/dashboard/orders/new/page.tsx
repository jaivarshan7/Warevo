import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { OrderForm } from "@/components/order-form";
import { OrderStatus, VerificationStatus, Prisma, InvoiceStatus, PaymentStatus } from "@prisma/client";

export default async function NewOrderPage() {
  const user = await requireUser(["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"]);
  const tenantWhere = user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" };

  const [clients, products] = await Promise.all([
    prisma.client.findMany({
      where: tenantWhere,
      select: {
        id: true,
        companyName: true,
        contactPerson: true,
        mobile: true,
      },
      orderBy: { companyName: "asc" },
    }),
    prisma.product.findMany({
      where: tenantWhere,
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        sellingPrice: true,
        gstRate: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  async function createOrderAction(data: {
    clientId: string;
    expectedDelivery: string;
    notes: string;
    generateInvoice: boolean;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
      discount: number;
    }>;
    tenantId?: string;
  }) {
    "use server";

    const currentUser = await requireUser([
      "PLATFORM_ADMIN",
      "WAREHOUSE_OWNER",
      "WAREHOUSE_MODERATOR",
      "WAREHOUSE_STAFF",
    ]);

    const targetTenantId = currentUser.role === "PLATFORM_ADMIN" && data.tenantId
      ? data.tenantId
      : currentUser.tenantId;

    if (!targetTenantId) {
      throw new Error("Tenant context is required.");
    }

    if (!data.clientId) {
      throw new Error("Please select a client.");
    }

    if (!data.items || data.items.length === 0) {
      throw new Error("At least one order item is required.");
    }

    // Calculate totals
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    const lineItemsData = data.items.map((item) => {
      const lineSubtotal = item.quantity * item.unitPrice - (item.discount || 0);
      const lineTax = (lineSubtotal * item.taxRate) / 100;
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      taxTotal += lineTax;
      discountTotal += (item.discount || 0);

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        taxRate: new Prisma.Decimal(item.taxRate),
        discount: new Prisma.Decimal(item.discount || 0),
        total: new Prisma.Decimal(lineTotal),
      };
    });

    const totalAmount = subtotal + taxTotal;

    // Generate next order number
    const orderCount = await prisma.order.count({ where: { tenantId: targetTenantId } });
    const orderNumber = `ORD-2026-${String(orderCount + 1).padStart(6, "0")}`;

    await prisma.$transaction(async (tx) => {
      // 1. Create Order & Items
      const createdOrder = await tx.order.create({
        data: {
          tenantId: targetTenantId,
          clientId: data.clientId,
          orderNumber,
          expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
          status: OrderStatus.ISSUED,
          verificationStatus: VerificationStatus.PENDING,
          subtotal: new Prisma.Decimal(subtotal),
          taxTotal: new Prisma.Decimal(taxTotal),
          discountTotal: new Prisma.Decimal(discountTotal),
          totalAmount: new Prisma.Decimal(totalAmount),
          notes: data.notes || null,
          createdById: currentUser.id,
          items: {
            create: lineItemsData,
          },
          statusHistory: {
            create: [
              {
                tenantId: targetTenantId,
                newStatus: OrderStatus.ISSUED,
                changedById: currentUser.id,
                notes: "Initial order created",
              },
            ],
          },
        },
      });

      // 2. Generate Invoice if requested
      if (data.generateInvoice) {
        const invoiceCount = await tx.invoice.count({ where: { tenantId: targetTenantId } });
        const invoiceNumber = `INV-2026-${String(invoiceCount + 1).padStart(6, "0")}`;

        await tx.invoice.create({
          data: {
            tenantId: targetTenantId,
            orderId: createdOrder.id,
            clientId: data.clientId,
            invoiceNumber,
            status: InvoiceStatus.DRAFT,
            paymentStatus: PaymentStatus.UNPAID,
            subtotal: new Prisma.Decimal(subtotal),
            cgst: new Prisma.Decimal(taxTotal / 2),
            sgst: new Prisma.Decimal(taxTotal / 2),
            igst: new Prisma.Decimal(0),
            discountTotal: new Prisma.Decimal(discountTotal),
            total: new Prisma.Decimal(totalAmount),
            items: {
              create: lineItemsData.map((item) => {
                const taxPart = new Prisma.Decimal(item.total).mul(item.taxRate).div(new Prisma.Decimal(200).add(item.taxRate.mul(2)));
                return {
                  productId: item.productId,
                  quantity: item.quantity,
                  rate: item.unitPrice,
                  discount: item.discount,
                  cgst: taxPart,
                  sgst: taxPart,
                  igst: new Prisma.Decimal(0),
                  total: item.total,
                };
              }),
            },
          },
        });
      }

      // 3. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId: targetTenantId,
          userId: currentUser.id,
          userRole: currentUser.role,
          action: "Created new commercial order",
          entity: "Order",
          entityId: createdOrder.id,
          newValue: { orderNumber, totalAmount, clientId: data.clientId },
        },
      });
    });

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/accounting");
    redirect("/dashboard/orders");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
      </div>

      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Create New Order</h1>
        <p className="text-sm text-slate-500">
          Draft a commercial customer order, configure product line items, and issue invoices.
        </p>
      </div>

      <OrderForm
        clients={clients}
        products={products.map((p) => ({
          ...p,
          sellingPrice: Number(p.sellingPrice),
          gstRate: Number(p.gstRate),
        }))}
        tenantId={user.tenantId ?? undefined}
        action={createOrderAction}
      />
    </div>
  );
}
