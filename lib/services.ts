import { InvoiceStatus, InventoryMovementType, OrderStatus, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/rbac";
import { requireUser } from "@/lib/auth";
import { assertValidTransition, verificationStatusForOrderStatus } from "@/lib/order-workflow";
import { createClientSchema, invoiceSchema, transitionOrderSchema, verificationSchema } from "@/lib/validation";

export async function listDashboardData() {
  const user = await requireUser();
  const tenantWhere = user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" };
  const [orders, clients, invoices, products, notifications] = await Promise.all([
    prisma.order.findMany({ where: tenantWhere, include: { client: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.client.count({ where: tenantWhere }),
    prisma.invoice.findMany({ where: tenantWhere, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.product.findMany({ where: tenantWhere, include: { inventory: true }, take: 8 }),
    prisma.notification.findMany({ where: tenantWhere, orderBy: { createdAt: "desc" }, take: 8 })
  ]);
  return { user, orders, clients, invoices, products, notifications };
}

export async function createClient(input: unknown) {
  const user = await requireUser(["WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR"]);
  assertPermission(user.role, "clients:manage");
  if (!user.tenantId) throw new Error("Tenant context required.");
  const data = createClientSchema.parse(input);
  const client = await prisma.client.create({ data: { ...data, tenantId: user.tenantId, email: data.email || null } });
  await audit(user, "Created client", "Client", client.id, null, { companyName: client.companyName });
  revalidatePath("/dashboard/clients");
  return client;
}

export async function transitionOrder(input: unknown) {
  const user = await requireUser();
  if (!["WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF", "CLIENT", "ACCOUNTANT"].includes(user.role)) {
    throw new Error("Unauthorized role.");
  }
  const data = transitionOrderSchema.parse(input);
  const order = await prisma.order.findUnique({ where: { id: data.orderId } });
  if (!order || (user.role !== "PLATFORM_ADMIN" && order.tenantId !== user.tenantId)) throw new Error("Order not found.");

  if (user.role === "CLIENT" && data.nextStatus !== "VERIFICATION_PENDING") throw new Error("Clients can only move orders into verification.");
  if (user.role === "ACCOUNTANT" && !["INVOICED", "PAYMENT_PENDING", "PAID", "COMPLETED"].includes(data.nextStatus)) throw new Error("Accountant cannot perform this order transition.");

  assertValidTransition(order.status, data.nextStatus);
  const verificationStatus = verificationStatusForOrderStatus(data.nextStatus as OrderStatus);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id: order.id },
      data: { status: data.nextStatus as OrderStatus, ...(verificationStatus ? { verificationStatus } : {}) }
    });
    await tx.orderStatusHistory.create({
      data: { tenantId: order.tenantId, orderId: order.id, previousStatus: order.status, newStatus: data.nextStatus as OrderStatus, changedById: user.id, notes: data.notes }
    });
    await tx.auditLog.create({
      data: { tenantId: order.tenantId, userId: user.id, userRole: user.role, action: "Changed order status", entity: "Order", entityId: order.id, previousValue: { status: order.status }, newValue: { status: data.nextStatus } }
    });
    return result;
  });
  revalidatePath("/dashboard/orders");
  return updated;
}

export async function receiveOrAdjustStock(params: {
  inventoryId: string;
  quantity: number;
  type: InventoryMovementType;
  notes?: string;
}) {
  const user = await requireUser(["WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "WAREHOUSE_STAFF"]);
  if (!["inventory:manage", "inventory:operate"].some((permission) => permissionAllowed(user.role, permission))) throw new Error("Inventory permission required.");
  if (params.quantity <= 0) throw new Error("Quantity must be positive.");
  return prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findUnique({ where: { id: params.inventoryId } });
    if (!inventory || inventory.tenantId !== user.tenantId) throw new Error("Inventory not found.");
    const newAvailable = params.type === "DAMAGE" ? inventory.availableQuantity - params.quantity : inventory.availableQuantity + params.quantity;
    if (newAvailable < 0) throw new Error("Insufficient stock.");
    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        availableQuantity: newAvailable,
        totalQuantity: params.type === "DAMAGE" ? inventory.totalQuantity : inventory.totalQuantity + params.quantity,
        damagedQuantity: params.type === "DAMAGE" ? inventory.damagedQuantity + params.quantity : inventory.damagedQuantity
      }
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId: inventory.tenantId,
        inventoryId: inventory.id,
        productId: inventory.productId,
        type: params.type,
        quantity: params.quantity,
        previousQuantity: inventory.availableQuantity,
        newQuantity: newAvailable,
        notes: params.notes,
        createdById: user.id
      }
    });
    await tx.auditLog.create({
      data: { tenantId: inventory.tenantId, userId: user.id, userRole: user.role, action: "Recorded stock movement", entity: "Inventory", entityId: inventory.id, previousValue: { availableQuantity: inventory.availableQuantity }, newValue: { availableQuantity: newAvailable, type: params.type } }
    });
    return updated;
  });
}

export async function submitVerification(input: unknown) {
  const user = await requireUser(["CLIENT"]);
  const data = verificationSchema.parse(input);
  const client = await prisma.client.findFirst({ where: { userId: user.id, tenantId: user.tenantId ?? "" } });
  if (!client) throw new Error("Client profile not found.");
  const order = await prisma.order.findFirst({ where: { id: data.orderId, tenantId: client.tenantId, clientId: client.id } });
  if (!order) throw new Error("Order not found.");
  if (!["RECEIVED", "VERIFICATION_PENDING"].includes(order.status)) throw new Error("This order is not ready for client verification.");

  const result = await prisma.$transaction(async (tx) => {
    const response = await tx.verificationResponse.upsert({
      where: { orderId: order.id },
      update: { status: data.status, responses: data.responses, comments: data.comments, attachments: data.attachments ?? Prisma.JsonNull },
      create: { tenantId: order.tenantId, orderId: order.id, clientId: client.id, userId: user.id, status: data.status, responses: data.responses, comments: data.comments, attachments: data.attachments ?? Prisma.JsonNull }
    });
    await tx.order.update({ where: { id: order.id }, data: { verificationStatus: data.status, status: data.status as OrderStatus } });
    await tx.orderStatusHistory.create({ data: { tenantId: order.tenantId, orderId: order.id, previousStatus: order.status, newStatus: data.status as OrderStatus, changedById: user.id, notes: data.comments } });
    await tx.notification.create({ data: { tenantId: order.tenantId, orderId: order.id, type: "CLIENT_COMPLETED_VERIFICATION", title: "Client verification completed", message: `${order.orderNumber} was marked ${data.status}.` } });
    await tx.auditLog.create({ data: { tenantId: order.tenantId, userId: user.id, userRole: user.role, action: "Submitted verification", entity: "Order", entityId: order.id, previousValue: { verificationStatus: order.verificationStatus }, newValue: { verificationStatus: data.status } } });
    return response;
  });
  revalidatePath(`/dashboard/orders/${order.id}`);
  return result;
}

export async function generateInvoice(input: unknown) {
  const user = await requireUser(["WAREHOUSE_OWNER", "ACCOUNTANT"]);
  assertPermission(user.role, "invoices:manage");
  const data = invoiceSchema.parse(input);
  const order = await prisma.order.findUnique({ where: { id: data.orderId }, include: { items: true } });
  if (!order || order.tenantId !== user.tenantId) throw new Error("Order not found.");
  if (data.final && order.verificationStatus !== "VERIFIED") {
    await audit(user, "Blocked final invoice before verification", "Order", order.id, { verificationStatus: order.verificationStatus }, { requestedFinal: true });
    throw new Error("Final invoice generation is blocked until client verification is VERIFIED.");
  }
  const invoiceCount = await prisma.invoice.count({ where: { tenantId: order.tenantId } });
  const status: InvoiceStatus = data.final ? "FINAL" : "DRAFT";
  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        clientId: order.clientId,
        invoiceNumber: `INV-2026-${String(invoiceCount + 1).padStart(6, "0")}`,
        status,
        subtotal: order.subtotal,
        cgst: new Prisma.Decimal(order.taxTotal).div(2),
        sgst: new Prisma.Decimal(order.taxTotal).div(2),
        igst: 0,
        discountTotal: order.discountTotal,
        total: order.totalAmount,
        finalizedAt: data.final ? new Date() : null,
        items: {
          create: order.items.map((item) => {
            const divisor = new Prisma.Decimal(200).add(item.taxRate.mul(2));
            const splitTax = new Prisma.Decimal(item.total).mul(item.taxRate).div(divisor);
            return {
              productId: item.productId,
              quantity: item.quantity,
              rate: item.unitPrice,
              discount: item.discount,
              cgst: splitTax,
              sgst: splitTax,
              igst: 0,
              total: item.total
            };
          })
        }
      }
    });
    if (data.final) await tx.order.update({ where: { id: order.id }, data: { status: "INVOICED" } });
    await tx.auditLog.create({ data: { tenantId: order.tenantId, userId: user.id, userRole: user.role, action: data.final ? "Generated final invoice" : "Generated draft invoice", entity: "Invoice", entityId: created.id, newValue: { invoiceNumber: created.invoiceNumber, status } } });
    return created;
  });
  revalidatePath("/dashboard/accounting");
  return invoice;
}

async function audit(user: { id: string; tenantId: string | null; role: Role }, action: string, entity: string, entityId: string, previousValue: unknown, newValue: unknown) {
  await prisma.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, userRole: user.role, action, entity, entityId, previousValue: previousValue as Prisma.InputJsonValue, newValue: newValue as Prisma.InputJsonValue } });
}

function permissionAllowed(role: Role, permission: string) {
  const roleMap: Record<Role, string[]> = {
    PLATFORM_ADMIN: ["*"],
    WAREHOUSE_OWNER: ["inventory:manage", "inventory:operate"],
    WAREHOUSE_MODERATOR: ["inventory:operate"],
    ACCOUNTANT: [],
    WAREHOUSE_STAFF: ["inventory:operate"],
    CLIENT: []
  };
  return roleMap[role].includes("*") || roleMap[role].includes(permission);
}
