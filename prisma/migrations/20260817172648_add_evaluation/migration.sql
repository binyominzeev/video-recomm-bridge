-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "projectRelevanceScore" DOUBLE PRECISION NOT NULL,
    "projectRelevance" TEXT NOT NULL,
    "relevanceTypes" TEXT[],
    "contentOrientation" TEXT NOT NULL,
    "targetNarratives" TEXT[],
    "recommendationValueScore" DOUBLE PRECISION NOT NULL,
    "recommendationValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "exclude" BOOLEAN NOT NULL,
    "excludeReason" TEXT,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
