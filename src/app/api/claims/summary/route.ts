import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RawClaim = { text?: unknown; type?: unknown; importance?: unknown };

export async function GET() {
  const videos = await prisma.video.findMany({
    where: { extractions: { some: {} } },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      url: true,
      source: { select: { name: true } },
      extractions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { rawJson: true },
      },
    },
  });

  const rows = videos.map((video) => {
    const rawJson = video.extractions[0]?.rawJson;
    const claims =
      rawJson && typeof rawJson === "object" && "claims" in rawJson && Array.isArray(rawJson.claims)
        ? (rawJson.claims as RawClaim[])
        : [];
    const typeCounts: Record<string, number> = {};
    const results = claims.map((claim, index) => {
      const type =
        typeof claim.type === "string" && claim.type.trim()
          ? claim.type.trim().toLowerCase()
          : "unknown";
      typeCounts[type] = (typeCounts[type] || 0) + 1;

      return {
        id: `${video.id}-${index}`,
        text: typeof claim.text === "string" ? claim.text : "",
        type,
        importance:
          typeof claim.importance === "number" ? claim.importance : null,
        videoId: video.id,
        videoTitle: video.title,
        videoUrl: video.url,
        sourceName: video.source.name,
      };
    });

    return {
      id: video.id,
      title: video.title,
      url: video.url,
      totalClaims: claims.length,
      typeCounts,
      results,
    };
  });

  const totals: Record<string, number> = {};
  rows.forEach((row) => {
    Object.entries(row.typeCounts).forEach(([type, count]) => {
      totals[type] = (totals[type] || 0) + count;
    });
  });

  return NextResponse.json({
    rows,
    results: rows.flatMap((row) => row.results),
    totals,
    processedVideos: rows.length,
  });
}