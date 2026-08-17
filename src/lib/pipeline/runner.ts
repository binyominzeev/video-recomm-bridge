import fs from "fs";
import path from "path";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  EXTRACTION_PROMPT_VERSION,
  extractFromTranscript,
} from "./extraction";
import {
  EVALUATION_PROMPT_VERSION,
  evaluateForRecommendation,
} from "./evaluation";
import { generateEmbedding } from "./embeddings";
import { transcribeAudio, extractTextFromSubtitles } from "./transcription";
import { discoverYouTubeVideos, downloadAudio, downloadYouTubeSubtitles } from "./youtube";

type ErrorDetails = {
  name?: string;
  message?: string;
  stack?: string;
  cause?: unknown;
};

function getErrorDetails(error: unknown) {
  const details = error as ErrorDetails;
  return {
    name: details?.name || "UnknownError",
    message: details?.message || String(error),
    stack: details?.stack,
    cause: details?.cause,
  };
}

function logPipelineError(stage: string, videoId: string, error: unknown) {
  console.error("Pipeline stage failed", {
    stage,
    videoId,
    ...getErrorDetails(error),
  });
}

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
    const audioPath = await downloadAudio(video.url, outputPath);

    if (!fs.existsSync(audioPath)) {
      throw new Error(`yt-dlp reported an audio file that does not exist: ${audioPath}`);
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "DOWNLOADED", audioPath },
    });
  } catch (error: unknown) {
    const { message } = getErrorDetails(error);
    logPipelineError("download", videoId, error);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: message },
    });
    throw error;
  }
}

export async function runTranscription(videoId: string): Promise<void> {
  let video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "TRANSCRIBING", errorMessage: null },
  });

  try {
    let transcriptText = "";
    let transcriptLanguage = "en";
    let durationMs = 0;
    let provider = "assemblyai";
    let audioPathToClean: string | null = null;

    // Try YouTube subtitles first (for YouTube videos only)
    const source = await prisma.source.findUnique({
      where: { id: video.sourceId },
    });

    if (source?.platform === "YOUTUBE") {
      console.info("Attempting to fetch YouTube subtitles", { videoId });

      const subtitleCacheDir = path.join(
        process.cwd(),
        ".cache",
        "subtitles",
        videoId
      );

      try {
        const subtitlePath = await downloadYouTubeSubtitles(
          video.url,
          subtitleCacheDir
        );

        if (subtitlePath && fs.existsSync(subtitlePath)) {
          console.info("YouTube subtitles found and parsed", {
            videoId,
            subtitlePath,
          });
          transcriptText = extractTextFromSubtitles(subtitlePath);
          provider = "youtube";

          // Clean up subtitle cache
          try {
            fs.rmSync(subtitleCacheDir, { recursive: true });
          } catch {
            // ignore cleanup errors
          }

          // If we got text from subtitles, skip audio download
          if (transcriptText.trim().length > 0) {
            await prisma.transcript.create({
              data: {
                videoId,
                provider,
                text: transcriptText,
                language: transcriptLanguage,
                durationMs: 0, // Subtitles don't have duration info
              },
            });

            await prisma.costEvent.create({
              data: {
                videoId,
                stage: "transcription",
                provider,
                inputUnits: transcriptText.length,
                estimatedCost: 0, // No cost for YouTube subtitles
              },
            });

            await prisma.video.update({
              where: { id: videoId },
              data: { status: "TRANSCRIBED", audioPath: null },
            });

            console.info("Video transcribed using YouTube subtitles", { videoId });
            return;
          }
        }
      } catch (error: unknown) {
        console.info("YouTube subtitles not available, falling back to audio", {
          videoId,
          error: (error as { message?: string })?.message,
        });
      }
    }

    // Fallback: Download and transcribe audio
    if (!video.audioPath || !fs.existsSync(video.audioPath)) {
      if (video.audioPath) {
        console.info("Audio cache missing; downloading again", {
          videoId,
          audioPath: video.audioPath,
        });
      }
      await runDownload(videoId);
      video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
    }

    if (!video.audioPath || !fs.existsSync(video.audioPath)) {
      throw new Error("Audio file is unavailable after download");
    }

    audioPathToClean = video.audioPath;

    console.info("Transcribing audio", { videoId, audioPath: video.audioPath });
    const result = await transcribeAudio(video.audioPath);

    transcriptText = result.text;
    transcriptLanguage = result.language;
    durationMs = result.durationMs;
    provider = process.env.TRANSCRIPTION_PROVIDER || "assemblyai";

    await prisma.transcript.create({
      data: {
        videoId,
        provider,
        text: transcriptText,
        language: transcriptLanguage,
        durationMs,
      },
    });

    const estimatedCost = (durationMs / 3_600_000) * 0.37;
    await prisma.costEvent.create({
      data: {
        videoId,
        stage: "transcription",
        provider,
        inputUnits: durationMs / 1000,
        estimatedCost,
      },
    });

    // Cleanup audio file
    if (audioPathToClean) {
      try {
        fs.unlinkSync(audioPathToClean);
      } catch {
        // ignore cleanup errors
      }
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "TRANSCRIBED", audioPath: null },
    });
  } catch (error: unknown) {
    const { message } = getErrorDetails(error);
    logPipelineError("transcription", videoId, error);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: message },
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
    const { message } = getErrorDetails(error);
    logPipelineError("extraction", videoId, error);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: message },
    });
    throw error;
  }
}

export async function runEvaluation(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { transcripts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const transcript = video.transcripts[0];
  if (!transcript) throw new Error("No transcript found for video");

  try {
    const { result, model, inputTokens, outputTokens, estimatedCost } =
      await evaluateForRecommendation(
        video.title,
        video.description || "",
        transcript.text
      );

    await prisma.evaluation.create({
      data: {
        videoId,
        model,
        promptVersion: EVALUATION_PROMPT_VERSION,
        projectRelevanceScore: result.projectRelevanceScore,
        projectRelevance: result.projectRelevance,
        relevanceTypes: result.relevanceTypes,
        contentOrientation: result.contentOrientation,
        targetNarratives: result.targetNarratives,
        recommendationValueScore: result.recommendationValueScore,
        recommendationValue: result.recommendationValue,
        reason: result.reason,
        exclude: result.exclude,
        excludeReason: result.excludeReason,
        rawJson: result as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.costEvent.create({
      data: {
        videoId,
        stage: "evaluation",
        provider: model,
        inputUnits: inputTokens,
        outputUnits: outputTokens,
        estimatedCost,
      },
    });
  } catch (error: unknown) {
    logPipelineError("evaluation", videoId, error);
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
    const { message } = getErrorDetails(error);
    logPipelineError("embedding", videoId, error);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: message },
    });
    throw error;
  }
}

export async function runFullPipeline(videoId: string): Promise<void> {
  await runTranscription(videoId);
  await runExtraction(videoId);
  await runEvaluation(videoId);
  await runEmbedding(videoId);
}
