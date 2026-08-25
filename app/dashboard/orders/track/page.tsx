import { Truck, ClipboardCheck, ArrowLeft } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { OrderTrackerView } from "@/components/order-tracker-view";
import { OrderStatus, VerificationStatus, NotificationType, InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";

export default async function OrderTrackAndVerifyPage() {
  const user = await requireUser();
  const tenantWhere = user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" };

  const [orders, clients] = await Promise.all([
    prisma.order.findMany({
      where: tenantWhere,
      include: {
        client: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
              },
            },
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            paymentStatus: true,
            total: true,
          },
          orderBy: { createdAt: "desc" },
        },
        verification: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
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
  ]);

  async function submitDeliveryVerificationAction(data: {
    orderId: string;
    status: "VERIFIED" | "PARTIALLY_VERIFIED" | "REJECTED";
    comments: string;
    responses: Array<{ text: string; checked: boolean }>;
    itemReceivedMap: Record<string, { received: number; damaged: number }>;
  }) {
    "use server";

    const currentUser = await requireUser();
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { client: true },
    });

    if (!order || (currentUser.role !== "PLATFORM_ADMIN" && order.tenantId !== currentUser.tenantId)) {
      throw new Error("Order not found or unauthorized.");
    }

    const nextVerificationStatus: VerificationStatus =
      data.status === "VERIFIED"
        ? VerificationStatus.VERIFIED
        : data.status === "PARTIALLY_VERIFIED"
        ? VerificationStatus.PARTIALLY_VERIFIED
        : VerificationStatus.REJECTED;

    const nextOrderStatus: OrderStatus =
      data.status === "VERIFIED"
        ? OrderStatus.VERIFIED
        : data.status === "PARTIALLY_VERIFIED"
        ? OrderStatus.PARTIALLY_VERIFIED
        : OrderStatus.REJECTED;

    await prisma.$transaction(async (tx) => {
      // 1. Upsert VerificationResponse
      await tx.verificationResponse.upsert({
        where: { orderId: order.id },
        update: {
          status: nextVerificationStatus,
          responses: data.responses,
          comments: data.comments,
          userId: currentUser.id,
        },
        create: {
          tenantId: order.tenantId,
          orderId: order.id,
          clientId: order.clientId,
          userId: currentUser.id,
          status: nextVerificationStatus,
          responses: data.responses,
          comments: data.comments,
        },
      });

      // 2. Update Order status
      await tx.order.update({
        where: { id: order.id },
        data: {
          verificationStatus: nextVerificationStatus,
          status: nextOrderStatus,
        },
      });

      // 3. Status History Entry
      await tx.orderStatusHistory.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          previousStatus: order.status,
          newStatus: nextOrderStatus,
          changedById: currentUser.id,
          notes: data.comments || `Client delivery marked as ${data.status}`,
        },
      });

      // 4. Notification
      await tx.notification.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          type: NotificationType.CLIENT_COMPLETED_VERIFICATION,
          title: "Delivery Inspection Completed",
          message: `Order ${order.orderNumber} was verified as ${data.status} by ${currentUser.name}.`,
        },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId: order.tenantId,
          userId: currentUser.id,
          userRole: currentUser.role,
          action: "Submitted delivery verification checklist",
          entity: "Order",
          entityId: order.id,
          previousValue: { verificationStatus: order.verificationStatus },
          newValue: { verificationStatus: nextVerificationStatus, status: nextOrderStatus },
        },
      });
    });

    revalidatePath("/dashboard/orders");
    revalidatePath(`/dashboard/orders/${order.id}`);
    revalidatePath("/dashboard/orders/track");
    revalidatePath("/dashboard/accounting");
  }

  async function importInvoiceAndSpreadsheetAction(data: {
    invoiceNumber: string;
    clientId: string;
    newClientName?: string;
    newContactPerson?: string;
    newClientMobile?: string;
    newClientGstin?: string;
    newClientAddress?: string;
    expectedDelivery: string;
    notes: string;
    rows: Array<{
      name: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      gstRate: number;
    }>;
  }) {
    "use server";

    const currentUser = await requireUser();
    let tenantId = currentUser.tenantId;

    if (!tenantId) {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id ?? "";
    }

    if (!tenantId) {
      throw new Error("No organization tenant found.");
    }

    // 1. Resolve Client — try to match by mobile or company name first
    let clientId = data.clientId;
    if (clientId === "NEW" || !clientId) {
      if (!data.newClientName || !data.newClientMobile) {
        throw new Error("Client Company Name and Contact Mobile are required for new clients.");
      }

      // Try to find existing client by mobile
      const existingByMobile = await prisma.client.findFirst({
        where: { tenantId, mobile: data.newClientMobile },
      });

      if (existingByMobile) {
        clientId = existingByMobile.id;
      } else {
        // Create user account for client
        let userId: string | null = null;
        const existingUser = await prisma.user.findFirst({
          where: { mobile: data.newClientMobile },
        });

        if (existingUser) {
          userId = existingUser.id;
        } else {
          const createdUser = await prisma.user.create({
            data: {
              tenantId,
              name: data.newContactPerson || data.newClientName,
              mobile: data.newClientMobile,
              role: "CLIENT",
              status: "ACTIVE",
            },
          });
          userId = createdUser.id;
        }

        const client = await prisma.client.create({
          data: {
            tenantId,
            userId,
            companyName: data.newClientName,
            contactPerson: data.newContactPerson || data.newClientName,
            mobile: data.newClientMobile,
            gstNumber: data.newClientGstin ?? null,
            billingAddress: data.newClientAddress ?? "Client Billing Address",
            shippingAddress: data.newClientAddress ?? "Client Shipping / Delivery Address",
          },
        });
        clientId = client.id;
      }
    }

    // 2. Resolve / Create Products & Line Items
    let subtotal = 0;
    let taxTotal = 0;
    const lineItemsData: Array<{
      productId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      discount: Prisma.Decimal;
      total: Prisma.Decimal;
    }> = [];

    for (const row of data.rows) {
      // Find or create product
      let product = await prisma.product.findUnique({
        where: {
          tenantId_sku: {
            tenantId,
            sku: row.sku,
          },
        },
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            tenantId,
            sku: row.sku,
            name: row.name,
            unit: "pcs",
            purchasePrice: new Prisma.Decimal(row.unitPrice * 0.8),
            sellingPrice: new Prisma.Decimal(row.unitPrice),
            gstRate: new Prisma.Decimal(row.gstRate),
          },
        });
      }

      const lineSubtotal = row.quantity * row.unitPrice;
      const lineTax = (lineSubtotal * row.gstRate) / 100;
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      taxTotal += lineTax;

      lineItemsData.push({
        productId: product.id,
        quantity: row.quantity,
        unitPrice: new Prisma.Decimal(row.unitPrice),
        taxRate: new Prisma.Decimal(row.gstRate),
        discount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(lineTotal),
      });
    }

    const totalAmount = subtotal + taxTotal;

    // 3. Generate Order Number & Invoice Number
    const orderCount = await prisma.order.count({ where: { tenantId } });
    const orderNumber = `ORD-2026-${String(orderCount + 1).padStart(6, "0")}`;
    const invoiceNumber = data.invoiceNumber || `INV-2026-${String(orderCount + 1).padStart(6, "0")}`;

    await prisma.$transaction(async (tx) => {
      // Create Order in DISPATCHED state ready for delivery verification
      const createdOrder = await tx.order.create({
        data: {
          tenantId,
          clientId,
          orderNumber,
          expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
          status: OrderStatus.DISPATCHED,
          verificationStatus: VerificationStatus.PENDING,
          subtotal: new Prisma.Decimal(subtotal),
          taxTotal: new Prisma.Decimal(taxTotal),
          discountTotal: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(totalAmount),
          notes: data.notes || `Imported via spreadsheet from Invoice #${invoiceNumber}`,
          createdById: currentUser.id,
          items: {
            create: lineItemsData,
          },
          statusHistory: {
            create: [
              {
                tenantId,
                newStatus: OrderStatus.ISSUED,
                changedById: currentUser.id,
                notes: "Imported from external invoice/spreadsheet",
              },
              {
                tenantId,
                previousStatus: OrderStatus.ISSUED,
                newStatus: OrderStatus.DISPATCHED,
                changedById: currentUser.id,
                notes: "Dispatched and ready for client delivery inspection",
              },
            ],
          },
        },
      });

      // Create Commercial Invoice
      await tx.invoice.create({
        data: {
          tenantId,
          orderId: createdOrder.id,
          clientId,
          invoiceNumber,
          status: InvoiceStatus.FINAL,
          paymentStatus: PaymentStatus.UNPAID,
          subtotal: new Prisma.Decimal(subtotal),
          cgst: new Prisma.Decimal(taxTotal / 2),
          sgst: new Prisma.Decimal(taxTotal / 2),
          igst: new Prisma.Decimal(0),
          discountTotal: new Prisma.Decimal(0),
          total: new Prisma.Decimal(totalAmount),
          items: {
            create: lineItemsData.map((item) => {
              const divisor = new Prisma.Decimal(200).add(item.taxRate.mul(2));
              const splitTax = new Prisma.Decimal(item.total).mul(item.taxRate).div(divisor);
              return {
                productId: item.productId,
                quantity: item.quantity,
                rate: item.unitPrice,
                discount: new Prisma.Decimal(0),
                cgst: splitTax,
                sgst: splitTax,
                igst: new Prisma.Decimal(0),
                total: item.total,
              };
            }),
          },
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: currentUser.id,
          userRole: currentUser.role,
          action: "Imported invoice and products spreadsheet as new order",
          entity: "Order",
          entityId: createdOrder.id,
          newValue: { orderNumber, invoiceNumber, totalAmount },
        },
      });
    });

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/orders/track");
    revalidatePath("/dashboard/accounting");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Order Tracking & Delivery Verification</h1>
        <p className="text-sm text-slate-500">
          Import external invoice spreadsheets, track shipment milestones, inspect delivery items with client receiving checklists, and share verified tax invoices.
        </p>
      </div>

      <OrderTrackerView
        orders={orders.map((o) => ({
          ...o,
          totalAmount: Number(o.totalAmount),
          items: o.items.map((i) => ({
            ...i,
            unitPrice: Number(i.unitPrice),
            total: Number(i.total),
          })),
          invoices: o.invoices.map((inv) => ({
            ...inv,
            total: Number(inv.total),
          })),
        }))}
        clients={clients}
        userRole={user.role}
        onVerifyOrder={submitDeliveryVerificationAction}
        onImportInvoiceSpreadsheet={importInvoiceAndSpreadsheetAction}
      />
    </div>
  );
}
