/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `CostEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('DRAFT', 'ESTIMATED', 'APPROVED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchItemStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CostEventKind" AS ENUM ('ACTUAL', 'ESTIMATE');

-- AlterTable
ALTER TABLE "CostEvent" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "kind" "CostEventKind" NOT NULL DEFAULT 'ACTUAL',
ADD COLUMN     "pricingVersion" TEXT;

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedStages" TEXT[],
    "providerConfig" JSONB NOT NULL,
    "estimateSnapshot" JSONB,
    "pricingVersion" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "budgetLimit" DOUBLE PRECISION,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "status" "BatchItemStatus" NOT NULL DEFAULT 'QUEUED',
    "currentStage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchItem_batchId_status_idx" ON "BatchItem"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BatchItem_batchId_videoId_key" ON "BatchItem"("batchId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "CostEvent_idempotencyKey_key" ON "CostEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CostEvent_batchId_kind_idx" ON "CostEvent"("batchId", "kind");

-- AddForeignKey
ALTER TABLE "BatchItem" ADD CONSTRAINT "BatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchItem" ADD CONSTRAINT "BatchItem_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
