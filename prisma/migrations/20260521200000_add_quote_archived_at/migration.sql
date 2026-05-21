-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Quote_archivedAt_idx" ON "Quote"("archivedAt");
