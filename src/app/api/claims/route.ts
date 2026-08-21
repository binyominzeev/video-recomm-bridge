import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const latestRun = await prisma.claimGroupingRun.findFirst({
    orderBy: { startedAt: "desc" },
  });

  const displayedRun = await prisma.claimGroupingRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
  });

  if (!displayedRun) {
    return NextResponse.json({ latestRun, displayedRun: null, groups: [] });
  }

  const groups = await prisma.claimGroup.findMany({
    where: { runId: displayedRun.id },
    orderBy: { claimCount: "desc" },
    include: {
      claims: {
        select: {
          id: true,
          text: true,
          isGoodQuality: true,
          videoId: true,
          video: { select: { title: true, url: true } },
        },
      },
    },
  });

  return NextResponse.json({ latestRun, displayedRun, groups });
}
