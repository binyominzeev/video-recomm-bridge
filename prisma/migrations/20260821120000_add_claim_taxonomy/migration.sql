ALTER TABLE "Claim"
ADD COLUMN "taxonomyCategoryId" TEXT,
ADD COLUMN "taxonomyTopic" TEXT,
ADD COLUMN "taxonomyClassifiedAt" TIMESTAMP(3);

CREATE INDEX "Claim_taxonomyCategoryId_idx" ON "Claim"("taxonomyCategoryId");