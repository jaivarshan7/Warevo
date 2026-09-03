CREATE TYPE "ClientEmployeeRole" AS ENUM ('RECEIVER', 'STORE', 'ACCOUNT', 'MANAGER', 'GM', 'MD');

ALTER TABLE "Client"
ADD COLUMN "companyGroupId" TEXT,
ADD COLUMN "employeeRole" "ClientEmployeeRole";

CREATE TABLE "CompanyGroup" (
	"id" TEXT NOT NULL,
	"tenantId" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"description" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,
	CONSTRAINT "CompanyGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyGroup_tenantId_name_key" ON "CompanyGroup"("tenantId", "name");
CREATE INDEX "CompanyGroup_tenantId_idx" ON "CompanyGroup"("tenantId");
CREATE INDEX "Client_companyGroupId_idx" ON "Client"("companyGroupId");

ALTER TABLE "CompanyGroup"
ADD CONSTRAINT "CompanyGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Client"
ADD CONSTRAINT "Client_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "CompanyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
