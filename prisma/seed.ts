import { PrismaClient, Role, OrderStatus, VerificationStatus, InvoiceStatus, PaymentStatus } from "@prisma/client";

const prisma = new PrismaClient();

const checklist = [
  "Correct product received",
  "Correct quantity received",
  "Product condition acceptable",
  "Packaging acceptable",
  "No visible damage",
  "Required documents received",
  "Delivery details correct"
];

async function seedTenant(name: string, slug: string, offset: number) {
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      name,
      slug,
      status: "ACTIVE",
      gstNumber: `29ABCDE${offset}F1Z${offset}`,
      address: `${offset}00 Logistics Park, Bengaluru`,
      phone: `+91990000000${offset}`,
      email: `ops-${slug}@example.test`,
      settings: { create: { orderPrefix: "ORD", invoicePrefix: "INV" } }
    }
  });

  const [owner, moderator, accountant, staff, clientUser] = await Promise.all([
    prisma.user.create({ data: { tenantId: tenant.id, role: Role.WAREHOUSE_OWNER, name: `${name} Owner`, email: `owner-${slug}@example.test` } }),
    prisma.user.create({ data: { tenantId: tenant.id, role: Role.WAREHOUSE_MODERATOR, name: `${name} Moderator`, email: `moderator-${slug}@example.test` } }),
    prisma.user.create({ data: { tenantId: tenant.id, role: Role.ACCOUNTANT, name: `${name} Accountant`, email: `accountant-${slug}@example.test` } }),
    prisma.user.create({ data: { tenantId: tenant.id, role: Role.WAREHOUSE_STAFF, name: `${name} Staff`, email: `staff-${slug}@example.test` } }),
    prisma.user.create({ data: { tenantId: tenant.id, role: Role.CLIENT, name: `${name} Client Contact`, mobile: `+91980000000${offset}` } })
  ]);

  const warehouse = await prisma.warehouse.create({
    data: { tenantId: tenant.id, name: `${name} Main Warehouse`, code: `WH-${offset}`, address: `${offset} Supply Avenue` }
  });
  const location = await prisma.warehouseLocation.create({
    data: { tenantId: tenant.id, warehouseId: warehouse.id, zone: "A", rack: "R1", shelf: "S1", bin: `B${offset}` }
  });
  const category = await prisma.category.create({ data: { tenantId: tenant.id, name: "Industrial Supplies" } });
  const product = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: category.id,
      sku: `SKU-${offset}001`,
      name: `Hydraulic Pump ${offset}`,
      brand: "Northline",
      unit: "pcs",
      purchasePrice: 4200,
      sellingPrice: 5800,
      gstRate: 18,
      barcode: `89000000000${offset}`,
      minimumStock: 20,
      reorderLevel: 35
    }
  });
  const inventory = await prisma.inventory.create({
    data: { tenantId: tenant.id, warehouseId: warehouse.id, locationId: location.id, productId: product.id, totalQuantity: 180, availableQuantity: 150, reservedQuantity: 25, damagedQuantity: 5 }
  });
  await prisma.inventoryMovement.create({
    data: { tenantId: tenant.id, inventoryId: inventory.id, productId: product.id, type: "RECEIPT", quantity: 180, previousQuantity: 0, newQuantity: 180, notes: "Opening stock", createdById: staff.id }
  });
  const client = await prisma.client.create({
    data: {
      tenantId: tenant.id,
      userId: clientUser.id,
      companyName: `${name} Retail Client`,
      contactPerson: "Asha Mehta",
      mobile: `+91980000000${offset}`,
      email: `client-${slug}@example.test`,
      gstNumber: `29XYZAB${offset}123Z${offset}`,
      billingAddress: "12 Market Road",
      shippingAddress: "Dock 4, Industrial Estate"
    }
  });
  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      clientId: client.id,
      orderNumber: `ORD-2026-00000${offset}`,
      expectedDelivery: new Date("2026-09-02"),
      status: offset === 1 ? OrderStatus.VERIFIED : OrderStatus.DISPATCHED,
      verificationStatus: offset === 1 ? VerificationStatus.VERIFIED : VerificationStatus.PENDING,
      subtotal: 58000,
      taxTotal: 10440,
      discountTotal: 0,
      totalAmount: 68440,
      createdById: moderator.id,
      assignedStaffId: staff.id,
      items: { create: { productId: product.id, quantity: 10, unitPrice: 5800, taxRate: 18, total: 68440 } },
      statusHistory: { create: [{ tenantId: tenant.id, newStatus: OrderStatus.ISSUED, changedById: moderator.id }, { tenantId: tenant.id, previousStatus: OrderStatus.ISSUED, newStatus: offset === 1 ? OrderStatus.VERIFIED : OrderStatus.DISPATCHED, changedById: staff.id }] }
    }
  });
  if (offset === 1) {
    await prisma.verificationResponse.create({
      data: { tenantId: tenant.id, orderId: order.id, clientId: client.id, userId: clientUser.id, status: VerificationStatus.VERIFIED, responses: checklist.map((text) => ({ text, checked: true })), comments: "Received in good condition." }
    });
    await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        orderId: order.id,
        clientId: client.id,
        invoiceNumber: "INV-2026-000001",
        status: InvoiceStatus.FINAL,
        paymentStatus: PaymentStatus.UNPAID,
        subtotal: 58000,
        cgst: 5220,
        sgst: 5220,
        igst: 0,
        discountTotal: 0,
        total: 68440,
        finalizedAt: new Date(),
        items: { create: { productId: product.id, quantity: 10, rate: 5800, cgst: 5220, sgst: 5220, igst: 0, total: 68440 } }
      }
    });
  }
  await prisma.verificationChecklist.create({
    data: { tenantId: tenant.id, name: "Default receiving checklist", items: { create: checklist.map((text, index) => ({ text, sortOrder: index + 1 })) } }
  });
  await prisma.notification.create({
    data: { tenantId: tenant.id, userId: owner.id, orderId: order.id, type: "NEW_ORDER", title: "Order activity", message: `${order.orderNumber} needs attention.` }
  });
  await prisma.auditLog.create({
    data: { tenantId: tenant.id, userId: moderator.id, userRole: Role.WAREHOUSE_MODERATOR, action: "Created sample order", entity: "Order", entityId: order.id, newValue: { orderNumber: order.orderNumber } }
  });
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.verificationResponse.deleteMany();
  await prisma.verificationItem.deleteMany();
  await prisma.verificationChecklist.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.warehouseLocation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.warehouseSetting.deleteMany();
  await prisma.platformSetting.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.tenant.deleteMany();

  await prisma.platformSetting.create({ data: { platformName: "WarehouseOS", featureFlags: { clientOtp: true, realtimeNotifications: true } } });
  await prisma.user.create({ data: { role: Role.PLATFORM_ADMIN, name: "Platform Admin", email: "platform-admin@example.test" } });
  await seedTenant("Apex Warehousing", "apex", 1);
  await seedTenant("Blue Dock Logistics", "blue-dock", 2);
  await seedTenant("Cedar Fulfillment", "cedar", 3);
}

main().finally(async () => prisma.$disconnect());
