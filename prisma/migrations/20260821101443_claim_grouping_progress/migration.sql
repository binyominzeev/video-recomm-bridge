-- AlterTable
ALTER TABLE "ClaimGroupingRun" ADD COLUMN     "phase" TEXT,
ADD COLUMN     "processedVideos" INTEGER DEFAULT 0,
ADD COLUMN     "totalVideos" INTEGER;
