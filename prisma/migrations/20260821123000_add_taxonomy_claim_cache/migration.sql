CREATE TABLE "TaxonomyClaim" (
    "id" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "claimIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "importance" DOUBLE PRECISION,
    "taxonomyCategoryId" TEXT,
    "taxonomyTopic" TEXT,
    "taxonomyClassifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxonomyClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxonomyClaim_extractionId_claimIndex_key"
ON "TaxonomyClaim"("extractionId", "claimIndex");
CREATE INDEX "TaxonomyClaim_taxonomyCategoryId_idx"
ON "TaxonomyClaim"("taxonomyCategoryId");
CREATE INDEX "TaxonomyClaim_videoId_idx" ON "TaxonomyClaim"("videoId");

ALTER TABLE "TaxonomyClaim"
ADD CONSTRAINT "TaxonomyClaim_extractionId_fkey"
FOREIGN KEY ("extractionId") REFERENCES "Extraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxonomyClaim"
ADD CONSTRAINT "TaxonomyClaim_videoId_fkey"
FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;