-- CreateEnum
CREATE TYPE "QuoteMode" AS ENUM ('OAT_DIRECT', 'KEENER_LOGISTICS', 'OAT_IF_BROKERED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'IMPORTED_FROM_GHL', 'READY_TO_SEND', 'PDF_GENERATED', 'SYNCED_TO_GHL', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('CARRIER_PAY', 'BROKER_FEE', 'FUEL_SURCHARGE', 'INOPERABLE_FEE', 'ENCLOSED_FEE', 'OVERSIZED_FEE', 'EXPEDITED_FEE', 'STORAGE_FEE', 'RESIDENTIAL_PICKUP_FEE', 'HARD_TO_ACCESS_LOCATION_FEE', 'DISCOUNT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "GhlSyncDirection" AS ENUM ('GHL_TO_APP', 'APP_TO_GHL');

-- CreateEnum
CREATE TYPE "GhlSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "dotNumber" TEXT,
    "mcNumber" TEXT,
    "defaultTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSnapshot" (
    "id" TEXT NOT NULL,
    "ghlContactId" TEXT,
    "ghlOpportunityId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "companyName" TEXT,
    "rawGhlData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "quoteMode" "QuoteMode" NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "companyId" TEXT NOT NULL,
    "customerSnapshotId" TEXT NOT NULL,
    "pickupAddress" TEXT,
    "pickupCity" TEXT,
    "pickupState" TEXT,
    "pickupZip" TEXT,
    "pickupContactName" TEXT,
    "pickupContactPhone" TEXT,
    "deliveryAddress" TEXT,
    "deliveryCity" TEXT,
    "deliveryState" TEXT,
    "deliveryZip" TEXT,
    "deliveryContactName" TEXT,
    "deliveryContactPhone" TEXT,
    "pickupDate" TIMESTAMP(3),
    "deliveryWindow" TEXT,
    "trailerType" TEXT,
    "customerTotal" DECIMAL(10,2) NOT NULL,
    "depositDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "internalEstimatedCarrierPay" DECIMAL(10,2),
    "internalGrossMargin" DECIMAL(10,2),
    "internalMarginPercentage" DECIMAL(7,4),
    "quotePdfUrl" TEXT,
    "acceptanceUrl" TEXT,
    "secureAccessToken" TEXT NOT NULL,
    "ghlContactId" TEXT,
    "ghlOpportunityId" TEXT,
    "ghlPipelineId" TEXT,
    "ghlStageId" TEXT,
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "validUntil" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSnapshot" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "year" TEXT,
    "make" TEXT,
    "model" TEXT,
    "type" TEXT,
    "condition" TEXT,
    "vin" TEXT,
    "isRunning" BOOLEAN,
    "notes" TEXT,
    "rawVehicleData" JSONB,

    CONSTRAINT "VehicleSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteFee" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "feeType" "FeeType" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showOnPdf" BOOLEAN NOT NULL DEFAULT true,
    "isInternalOnly" BOOLEAN NOT NULL DEFAULT false,
    "internalNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteEvent" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlFieldMapping" (
    "id" TEXT NOT NULL,
    "appFieldKey" TEXT NOT NULL,
    "ghlCustomFieldId" TEXT,
    "ghlCustomFieldName" TEXT,
    "fallbackPath" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhlFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlSyncLog" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT,
    "direction" "GhlSyncDirection" NOT NULL,
    "status" "GhlSyncStatus" NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GhlSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerSnapshot_ghlContactId_idx" ON "CustomerSnapshot"("ghlContactId");

-- CreateIndex
CREATE INDEX "CustomerSnapshot_ghlOpportunityId_idx" ON "CustomerSnapshot"("ghlOpportunityId");

-- CreateIndex
CREATE INDEX "CustomerSnapshot_createdAt_idx" ON "CustomerSnapshot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_secureAccessToken_key" ON "Quote"("secureAccessToken");

-- CreateIndex
CREATE INDEX "Quote_quoteNumber_idx" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE INDEX "Quote_ghlContactId_idx" ON "Quote"("ghlContactId");

-- CreateIndex
CREATE INDEX "Quote_ghlOpportunityId_idx" ON "Quote"("ghlOpportunityId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_quoteMode_idx" ON "Quote"("quoteMode");

-- CreateIndex
CREATE INDEX "Quote_createdAt_idx" ON "Quote"("createdAt");

-- CreateIndex
CREATE INDEX "VehicleSnapshot_quoteId_idx" ON "VehicleSnapshot"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteFee_quoteId_idx" ON "QuoteFee"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteFee_feeType_idx" ON "QuoteFee"("feeType");

-- CreateIndex
CREATE INDEX "QuoteEvent_quoteId_idx" ON "QuoteEvent"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteEvent_type_idx" ON "QuoteEvent"("type");

-- CreateIndex
CREATE INDEX "QuoteEvent_createdAt_idx" ON "QuoteEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GhlFieldMapping_appFieldKey_key" ON "GhlFieldMapping"("appFieldKey");

-- CreateIndex
CREATE INDEX "GhlSyncLog_quoteId_idx" ON "GhlSyncLog"("quoteId");

-- CreateIndex
CREATE INDEX "GhlSyncLog_direction_idx" ON "GhlSyncLog"("direction");

-- CreateIndex
CREATE INDEX "GhlSyncLog_status_idx" ON "GhlSyncLog"("status");

-- CreateIndex
CREATE INDEX "GhlSyncLog_createdAt_idx" ON "GhlSyncLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerSnapshotId_fkey" FOREIGN KEY ("customerSnapshotId") REFERENCES "CustomerSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSnapshot" ADD CONSTRAINT "VehicleSnapshot_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteFee" ADD CONSTRAINT "QuoteFee_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhlSyncLog" ADD CONSTRAINT "GhlSyncLog_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
