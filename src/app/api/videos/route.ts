import { VideoStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sourceId = searchParams.get("sourceId") || undefined;
  const status = searchParams.get("status") as VideoStatus | null;
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  const where: {
    sourceId?: string;
    status?: VideoStatus;
  } = {};

  if (sourceId) where.sourceId = sourceId;
  if (status) where.status = status;

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      skip,
      take: limit,
      orderBy: { viewCount: "desc" },
      include: {
        source: { select: { name: true, platform: true } },
        transcripts: { select: { id: true }, take: 1 },
        extractions: { select: { id: true }, take: 1 },
        evaluations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            projectRelevance: true,
            projectRelevanceScore: true,
            recommendationValue: true,
            recommendationValueScore: true,
            exclude: true,
          },
        },
        costEvents: {
          where: { kind: "ACTUAL", stage: "embedding" },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.video.count({ where }),
  ]);

  return NextResponse.json({
    videos: videos.map((video) => ({
      ...video,
      viewCount: video.viewCount?.toString(),
      processing: {
        hasTranscription: video.transcripts.length > 0,
        hasExtraction: video.extractions.length > 0,
        hasEvaluation: video.evaluations.length > 0,
        hasEmbedding: video.costEvents.length > 0,
        completionState:
          video.transcripts.length === 0 &&
          video.extractions.length === 0 &&
          video.evaluations.length === 0 &&
          video.costEvents.length === 0
            ? "unprocessed"
            : video.transcripts.length > 0 &&
                video.extractions.length > 0 &&
                video.evaluations.length > 0 &&
                video.costEvents.length > 0
              ? "complete"
              : "partial",
      },
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    sourceId?: string;
    url?: string;
    title?: string;
    externalId?: string;
  };

  const { sourceId, url, title, externalId } = body;

  if (!sourceId || !url) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const extId = externalId || url;

  const video = await prisma.video.upsert({
    where: { sourceId_externalId: { sourceId, externalId: extId } },
    create: {
      sourceId,
      externalId: extId,
      url,
      title: title || url,
      status: "SELECTED",
    },
    update: { title: title || url },
  });

  return NextResponse.json({
    ...video,
    viewCount: video.viewCount?.toString(),
  });
}
