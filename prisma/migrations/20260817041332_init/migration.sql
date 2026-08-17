-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('YOUTUBE', 'INSTAGRAM', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('PENDING', 'DISCOVERING', 'DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('DISCOVERED', 'SELECTED', 'DOWNLOADING', 'DOWNLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'EXTRACTING', 'EXTRACTED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "name" TEXT NOT NULL,
    "requestedVideoCount" INTEGER NOT NULL,
    "status" "SourceStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "publishedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "viewCount" BIGINT,
    "status" "VideoStatus" NOT NULL DEFAULT 'DISCOVERED',
    "errorMessage" TEXT,
    "audioPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "embedding" vector(1536),

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "language" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extraction" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Extraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostEvent" (
    "id" TEXT NOT NULL,
    "videoId" TEXT,
    "stage" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "inputUnits" DOUBLE PRECISION,
    "outputUnits" DOUBLE PRECISION,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Video_sourceId_externalId_key" ON "Video"("sourceId", "externalId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extraction" ADD CONSTRAINT "Extraction_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
