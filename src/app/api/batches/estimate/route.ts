import { NextRequest, NextResponse } from "next/server";

import { estimateBulkCost, EstimateStage } from "@/lib/pipeline/estimator";
import { prisma } from "@/lib/prisma";

const allowedStages = new Set<EstimateStage>([
  "transcription",
  "extraction",
  "evaluation",
  "embedding",
]);

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    videoIds?: string[];
    stages?: string[];
    transcriptionProvider?: "assemblyai" | "faster-whisper";
    subtitleHitRate?: number;
  };

  if (!Array.isArray(body.videoIds) || body.videoIds.length === 0) {
    return NextResponse.json({ error: "videoIds must be a non-empty array" }, { status: 400 });
  }

  const stages = (body.stages || ["transcription", "extraction", "evaluation", "embedding"]).filter(
    (stage): stage is EstimateStage => allowedStages.has(stage as EstimateStage)
  );
  if (stages.length === 0) {
    return NextResponse.json({ error: "At least one valid stage is required" }, { status: 400 });
  }

  const videos = await prisma.video.findMany({
    where: { id: { in: body.videoIds } },
    select: { id: true, title: true, description: true, duration: true },
  });

  if (videos.length !== new Set(body.videoIds).size) {
    return NextResponse.json({ error: "One or more videos were not found" }, { status: 404 });
  }

  return NextResponse.json(
    estimateBulkCost({
      videos,
      stages,
      transcriptionProvider: body.transcriptionProvider || "assemblyai",
      subtitleHitRate: body.subtitleHitRate,
    })
  );
}