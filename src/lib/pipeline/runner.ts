import fs from "fs";
import path from "path";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  EXTRACTION_PROMPT_VERSION,
  extractFromTranscript,
} from "./extraction";
import { generateEmbedding } from "./embeddings";
import { transcribeAudio } from "./transcription";
import { discoverYouTubeVideos, downloadAudio } from "./youtube";

function getAudioStoragePath(videoId: string): string {
  const storageDir = path.join(process.cwd(), ".cache", "audio");
  fs.mkdirSync(storageDir, { recursive: true });
  return path.join(storageDir, `vrb_${videoId}.mp3`);
}

export async function runDiscovery(sourceId: string): Promise<void> {
  const source = await prisma.source.findUniqueOrThrow({
    where: { id: sourceId },
  });

  await prisma.source.update({
    where: { id: sourceId },
    data: { status: "DISCOVERING", errorMessage: null },
  });

  try {
    let videos: Array<{
      id: string;
      title: string;
      description: string;
      thumbnail: string;
      upload_date: string;
      duration: number;
      view_count: number;
      webpage_url: string;
    }> = [];

    if (source.platform === "YOUTUBE") {
      videos = await discoverYouTubeVideos(
        source.url,
        source.requestedVideoCount
      );
    } else {
      throw new Error(
        `Auto-discovery not supported for ${source.platform}. Use manual video URL ingestion.`
      );
    }

    for (const videoInfo of videos) {
      const publishedAt = videoInfo.upload_date
        ? new Date(
            `${videoInfo.upload_date.slice(0, 4)}-${videoInfo.upload_date.slice(4, 6)}-${videoInfo.upload_date.slice(6, 8)}`
          )
        : null;

      await prisma.video.upsert({
        where: {
          sourceId_externalId: {
            sourceId,
            externalId: videoInfo.id,
          },
        },
        create: {
          sourceId,
          externalId: videoInfo.id,
          url: videoInfo.webpage_url,
          title: videoInfo.title,
          description: videoInfo.description,
          thumbnail: videoInfo.thumbnail,
          publishedAt,
          duration: videoInfo.duration,
          viewCount: BigInt(videoInfo.view_count),
          status: "SELECTED",
        },
        update: {
          url: videoInfo.webpage_url,
          title: videoInfo.title,
          description: videoInfo.description,
          thumbnail: videoInfo.thumbnail,
          publishedAt,
          duration: videoInfo.duration,
          viewCount: BigInt(videoInfo.view_count),
          status: "SELECTED",
          errorMessage: null,
        },
      });
    }

    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "DONE" },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "ERROR", errorMessage: err.message || "Unknown error" },
    });
    throw error;
  }
}

export async function runDownload(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "DOWNLOADING", errorMessage: null },
  });

  try {
    const outputPath = getAudioStoragePath(videoId);
    await downloadAudio(video.url, outputPath);

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "DOWNLOADED", audioPath: outputPath },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: err.message || "Unknown error" },
    });
    throw error;
  }
}

export async function runTranscription(videoId: string): Promise<void> {
  let video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });

  if (!video.audioPath) {
    await runDownload(videoId);
    video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  }

  if (!video.audioPath) throw new Error("No audio path for video");

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "TRANSCRIBING", errorMessage: null },
  });

  try {
    const result = await transcribeAudio(video.audioPath);

    await prisma.transcript.create({
      data: {
        videoId,
        provider: process.env.TRANSCRIPTION_PROVIDER || "assemblyai",
        text: result.text,
        language: result.language,
        durationMs: result.durationMs,
      },
    });

    const estimatedCost = (result.durationMs / 3_600_000) * 0.37;
    await prisma.costEvent.create({
      data: {
        videoId,
        stage: "transcription",
        provider: process.env.TRANSCRIPTION_PROVIDER || "assemblyai",
        inputUnits: result.durationMs / 1000,
        estimatedCost,
      },
    });

    try {
      fs.unlinkSync(video.audioPath);
    } catch {
      // ignore cleanup errors
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "TRANSCRIBED", audioPath: null },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: err.message || "Unknown error" },
    });
    throw error;
  }
}

export async function runExtraction(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { transcripts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const transcript = video.transcripts[0];
  if (!transcript) throw new Error("No transcript found for video");

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "EXTRACTING", errorMessage: null },
  });

  try {
    const { result, model, inputTokens, outputTokens, estimatedCost } =
      await extractFromTranscript(transcript.text);

    await prisma.extraction.create({
      data: {
        videoId,
        model,
        promptVersion: EXTRACTION_PROMPT_VERSION,
        rawJson: result as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.costEvent.create({
      data: {
        videoId,
        stage: "extraction",
        provider: model,
        inputUnits: inputTokens,
        outputUnits: outputTokens,
        estimatedCost,
      },
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "EXTRACTED" },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: err.message || "Unknown error" },
    });
    throw error;
  }
}

export async function runEmbedding(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: {
      transcripts: { orderBy: { createdAt: "desc" }, take: 1 },
      extractions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const transcript = video.transcripts[0];
  const extraction = video.extractions[0];

  const textToEmbed = [
    video.title,
    transcript?.text || "",
    extraction ? JSON.stringify((extraction.rawJson as { topics?: string[] })?.topics) : "",
  ]
    .join(" ")
    .trim();

  try {
    const embedding = await generateEmbedding(textToEmbed);
    const vectorStr = `[${embedding.join(",")}]`;

    await prisma.$executeRaw`
      UPDATE "Video" SET embedding = ${vectorStr}::vector WHERE id = ${videoId}
    `;

    const estimatedCost = (textToEmbed.length / 4 / 1_000_000) * 0.02;
    await prisma.costEvent.create({
      data: {
        videoId,
        stage: "embedding",
        provider: "openai",
        inputUnits: textToEmbed.length / 4,
        estimatedCost,
      },
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { errorMessage: null },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: err.message || "Unknown error" },
    });
    throw error;
  }
}

export async function runFullPipeline(videoId: string): Promise<void> {
  await runTranscription(videoId);
  await runExtraction(videoId);
  await runEmbedding(videoId);
}
