import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { estimateBulkCost, EstimateStage } from "@/lib/pipeline/estimator";
import { prisma } from "@/lib/prisma";

const allowedStages = new Set<EstimateStage>([
  "transcription",
  "extraction",
  "evaluation",
  "embedding",
]);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;

  const [batches, total] = await Promise.all([
    prisma.batch.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        items: {
          select: { status: true },
        },
        costEvents: {
          where: { kind: "ACTUAL" },
          select: { estimatedCost: true },
        },
      },
    }),
    prisma.batch.count(),
  ]);

  return NextResponse.json({
    batches: batches.map((batch) => {
      const progress = batch.items.reduce(
        (result, item) => {
          result[item.status] = (result[item.status] || 0) + 1;
          return result;
        },
        {} as Record<string, number>
      );
      const actualCost = batch.costEvents.reduce(
        (sum, event) => sum + event.estimatedCost,
        0
      );

      return {
        ...batch,
        progress,
        actualCost,
      };
    }),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    videoIds?: string[];
    stages?: string[];
    transcriptionProvider?: "assemblyai" | "faster-whisper";
    subtitleHitRate?: number;
    budgetLimit?: number;
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

  const videoIds = [...new Set(body.videoIds)];
  const videos = await prisma.video.findMany({
    where: { id: { in: videoIds } },
    select: { id: true, title: true, description: true, duration: true },
  });

  if (videos.length !== videoIds.length) {
    return NextResponse.json({ error: "One or more videos were not found" }, { status: 404 });
  }

  const estimate = estimateBulkCost({
    videos,
    stages,
    transcriptionProvider: body.transcriptionProvider || "assemblyai",
    subtitleHitRate: body.subtitleHitRate,
  });

  const batch = await prisma.batch.create({
    data: {
      status: "ESTIMATED",
      requestedStages: stages,
      providerConfig: {
        transcriptionProvider: body.transcriptionProvider || "assemblyai",
      },
      estimateSnapshot: estimate as unknown as Prisma.InputJsonValue,
      pricingVersion: estimate.pricingVersion,
      currency: estimate.currency,
      budgetLimit: body.budgetLimit,
      items: {
        create: videoIds.map((videoId) => ({ videoId })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(batch, { status: 201 });
}