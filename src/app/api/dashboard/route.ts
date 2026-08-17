import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET() {
  const [
    totalSources,
    totalVideos,
    selected,
    downloaded,
    transcribed,
    extracted,
    failed,
    costTotal,
  ] = await Promise.all([
    prisma.source.count(),
    prisma.video.count(),
    prisma.video.count({ where: { status: "SELECTED" } }),
    prisma.video.count({ where: { status: "DOWNLOADED" } }),
    prisma.video.count({ where: { status: "TRANSCRIBED" } }),
    prisma.video.count({ where: { status: "EXTRACTED" } }),
    prisma.video.count({ where: { status: "FAILED" } }),
    prisma.costEvent.aggregate({ _sum: { estimatedCost: true } }),
  ]);

  return NextResponse.json({
    totalSources,
    totalVideos,
    selected,
    downloaded,
    transcribed,
    extracted,
    failed,
    totalCost: costTotal._sum.estimatedCost || 0,
  });
}
