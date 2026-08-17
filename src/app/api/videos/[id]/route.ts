import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      source: true,
      transcripts: { orderBy: { createdAt: "desc" } },
      extractions: { orderBy: { createdAt: "desc" } },
      evaluations: { orderBy: { createdAt: "desc" } },
      costEvents: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({
    ...video,
    viewCount: video.viewCount?.toString(),
  });
}
