-- Add per-location GHL field mappings and quote GHL location tracking.

ALTER TABLE "GhlFieldMapping" ADD COLUMN "ghlLocationId" TEXT;

UPDATE "GhlFieldMapping"
SET "ghlLocationId" = 'iisYmOgIc6Ef6uoJ2sVx'
WHERE "ghlLocationId" IS NULL;

ALTER TABLE "GhlFieldMapping" ALTER COLUMN "ghlLocationId" SET NOT NULL;

DROP INDEX IF EXISTS "GhlFieldMapping_appFieldKey_key";

CREATE UNIQUE INDEX "GhlFieldMapping_ghlLocationId_appFieldKey_key"
  ON "GhlFieldMapping"("ghlLocationId", "appFieldKey");

CREATE INDEX "GhlFieldMapping_ghlLocationId_idx" ON "GhlFieldMapping"("ghlLocationId");
CREATE INDEX "GhlFieldMapping_appFieldKey_idx" ON "GhlFieldMapping"("appFieldKey");

ALTER TABLE "Quote" ADD COLUMN "ghlLocationId" TEXT;

UPDATE "Quote"
SET "ghlLocationId" = 'iisYmOgIc6Ef6uoJ2sVx'
WHERE "ghlOpportunityId" IS NOT NULL AND "ghlLocationId" IS NULL;

CREATE INDEX "Quote_ghlLocationId_idx" ON "Quote"("ghlLocationId");
