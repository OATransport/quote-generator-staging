-- CreateEnum
CREATE TYPE "QuoteCustomerMessageType" AS ENUM ('QUESTION');

-- AlterEnum
ALTER TYPE "QuoteStatus" ADD VALUE 'QUESTION';

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "acceptedIp" TEXT,
ADD COLUMN     "acceptedUserAgent" TEXT,
ADD COLUMN     "customerSignature" TEXT,
ADD COLUMN     "declinedIp" TEXT,
ADD COLUMN     "declinedUserAgent" TEXT,
ADD COLUMN     "lastCustomerActionAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "QuoteCustomerMessage" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "type" "QuoteCustomerMessageType" NOT NULL DEFAULT 'QUESTION',
    "customerName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteCustomerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteCustomerMessage_quoteId_idx" ON "QuoteCustomerMessage"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteCustomerMessage_createdAt_idx" ON "QuoteCustomerMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "QuoteCustomerMessage" ADD CONSTRAINT "QuoteCustomerMessage_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
