-- CreateEnum
CREATE TYPE "InvoiceImportStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'EXTRACTION_COMPLETE', 'REVIEW_REQUIRED', 'CONFIRMED', 'REJECTED', 'PROCESSING_FAILED');

-- CreateEnum
CREATE TYPE "EWayBillStatus" AS ENUM ('DRAFT', 'READY', 'SUBMITTED', 'GENERATED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeliveryVerificationItemStatus" AS ENUM ('PENDING', 'RECEIVED', 'PARTIALLY_RECEIVED', 'DAMAGED', 'MISSING', 'REJECTED');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "ImportedInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "originalDocumentId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "orderId" TEXT,
    "clientId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "importNumber" TEXT NOT NULL,
    "status" "InvoiceImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "extractedData" JSONB NOT NULL DEFAULT '{}',
    "correctedData" JSONB NOT NULL DEFAULT '{}',
    "missingFields" JSONB NOT NULL DEFAULT '[]',
    "confidence" DECIMAL(5,2),
    "failureReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedInvoiceItem" (
    "id" TEXT NOT NULL,
    "importedInvoiceId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "hsnSac" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT,
    "rate" DECIMAL(12,2),
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableValue" DECIMAL(12,2),
    "gstRate" DECIMAL(5,2),
    "cgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2),
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ImportedInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EWayBill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "importedInvoiceId" TEXT,
    "ewayBillNumber" TEXT,
    "documentNumber" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "supplierGstin" TEXT,
    "recipientGstin" TEXT,
    "dispatchFrom" JSONB NOT NULL DEFAULT '{}',
    "shipTo" JSONB NOT NULL DEFAULT '{}',
    "transporterId" TEXT,
    "vehicleNumber" TEXT,
    "transportMode" TEXT,
    "distance" INTEGER,
    "status" "EWayBillStatus" NOT NULL DEFAULT 'DRAFT',
    "missingFields" JSONB NOT NULL DEFAULT '[]',
    "requestData" JSONB NOT NULL DEFAULT '{}',
    "responseData" JSONB NOT NULL DEFAULT '{}',
    "generatedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EWayBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryVerification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "invoiceId" TEXT,
    "importedInvoiceId" TEXT,
    "clientId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationText" TEXT,
    "comments" TEXT,
    "attachments" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryVerificationItem" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "importedInvoiceItemId" TEXT,
    "expectedQuantity" DECIMAL(12,3) NOT NULL,
    "receivedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "status" "DeliveryVerificationItemStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "attachment" JSONB,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryVerificationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportedInvoice_originalDocumentId_key" ON "ImportedInvoice"("originalDocumentId");

-- CreateIndex
CREATE INDEX "ImportedInvoice_tenantId_status_createdAt_idx" ON "ImportedInvoice"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedInvoice_tenantId_importNumber_key" ON "ImportedInvoice"("tenantId", "importNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EWayBill_importedInvoiceId_key" ON "EWayBill"("importedInvoiceId");

-- CreateIndex
CREATE INDEX "EWayBill_tenantId_status_createdAt_idx" ON "EWayBill"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryVerification_importedInvoiceId_key" ON "DeliveryVerification"("importedInvoiceId");

-- CreateIndex
CREATE INDEX "DeliveryVerification_tenantId_status_createdAt_idx" ON "DeliveryVerification"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_warehouseId_read_idx" ON "Notification"("tenantId", "warehouseId", "read");

-- CreateIndex
CREATE INDEX "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ImportedInvoice" ADD CONSTRAINT "ImportedInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedInvoice" ADD CONSTRAINT "ImportedInvoice_originalDocumentId_fkey" FOREIGN KEY ("originalDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedInvoice" ADD CONSTRAINT "ImportedInvoice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedInvoice" ADD CONSTRAINT "ImportedInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedInvoice" ADD CONSTRAINT "ImportedInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedInvoice" ADD CONSTRAINT "ImportedInvoice_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedInvoiceItem" ADD CONSTRAINT "ImportedInvoiceItem_importedInvoiceId_fkey" FOREIGN KEY ("importedInvoiceId") REFERENCES "ImportedInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_importedInvoiceId_fkey" FOREIGN KEY ("importedInvoiceId") REFERENCES "ImportedInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryVerification" ADD CONSTRAINT "DeliveryVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryVerification" ADD CONSTRAINT "DeliveryVerification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryVerification" ADD CONSTRAINT "DeliveryVerification_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryVerification" ADD CONSTRAINT "DeliveryVerification_importedInvoiceId_fkey" FOREIGN KEY ("importedInvoiceId") REFERENCES "ImportedInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryVerification" ADD CONSTRAINT "DeliveryVerification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryVerificationItem" ADD CONSTRAINT "DeliveryVerificationItem_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "DeliveryVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryVerificationItem" ADD CONSTRAINT "DeliveryVerificationItem_importedInvoiceItemId_fkey" FOREIGN KEY ("importedInvoiceItemId") REFERENCES "ImportedInvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
