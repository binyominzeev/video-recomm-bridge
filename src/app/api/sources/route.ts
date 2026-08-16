import { Platform } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
function detectPlatform(url: string): Platform {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return Platform.YOUTUBE;
  }

  if (url.includes("instagram.com")) {
    return Platform.INSTAGRAM;
  }

  if (url.includes("facebook.com")) {
    return Platform.FACEBOOK;
  }

  throw new Error("Unsupported platform URL");
}

export async function GET() {
  const sources = await prisma.source.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { videos: true },
      },
      videos: {
        select: { status: true },
      },
    },
  });

  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    url?: string;
    name?: string;
    requestedVideoCount?: number;
  };
  const { url, name, requestedVideoCount } = body;

  if (!url || !name || !requestedVideoCount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const source = await prisma.source.create({
      data: {
        url,
        name,
        requestedVideoCount: Number(requestedVideoCount),
        platform: detectPlatform(url),
        status: "PENDING",
      },
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Unable to create source" },
      { status: 400 }
    );
  }
}
