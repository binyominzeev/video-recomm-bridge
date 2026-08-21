-- CreateEnum
CREATE TYPE "ClaimGroupingRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ClaimGroupingRun" (
    "id" TEXT NOT NULL,
    "status" "ClaimGroupingRunStatus" NOT NULL DEFAULT 'RUNNING',
    "totalClaims" INTEGER,
    "totalGroups" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ClaimGroupingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimGroup" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "summary" TEXT,
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "groupId" TEXT,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL,
    "isGoodQuality" BOOLEAN NOT NULL,
    "recommendationValue" TEXT,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaimGroup_runId_idx" ON "ClaimGroup"("runId");

-- CreateIndex
CREATE INDEX "Claim_runId_idx" ON "Claim"("runId");

-- CreateIndex
CREATE INDEX "Claim_groupId_idx" ON "Claim"("groupId");

-- CreateIndex
CREATE INDEX "Claim_videoId_idx" ON "Claim"("videoId");

-- AddForeignKey
ALTER TABLE "ClaimGroup" ADD CONSTRAINT "ClaimGroup_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ClaimGroupingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ClaimGroupingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "Extraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ClaimGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
