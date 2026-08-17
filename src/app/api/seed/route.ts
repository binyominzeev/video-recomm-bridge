import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const INITIAL_SOURCES = [
  { url: "https://www.youtube.com/@Israel_Advocacy", name: "Israel Advocacy", requestedVideoCount: 150 },
  { url: "https://www.youtube.com/@Travelingisraelinfo/shorts", name: "Traveling Israel Info", requestedVideoCount: 100 },
  { url: "https://www.youtube.com/@standwithus/shorts", name: "Stand With Us", requestedVideoCount: 100 },
  { url: "https://www.youtube.com/@unwatch/shorts", name: "UN Watch", requestedVideoCount: 100 },
  { url: "https://www.youtube.com/@HananyaNaftali/shorts", name: "Hananya Naftali", requestedVideoCount: 100 },
  { url: "https://www.youtube.com/@-yosephhaddad9088/shorts", name: "Yoseph Haddad", requestedVideoCount: 100 },
  { url: "https://www.instagram.com/zach.sage/?hl=en", name: "Zach Sage", requestedVideoCount: 80 },
  { url: "https://www.instagram.com/adielofisrael", name: "Adiel of Israel", requestedVideoCount: 80 },
  { url: "https://www.facebook.com/talthetraveler/reels/", name: "Tal the Traveler", requestedVideoCount: 30 },
  { url: "https://www.facebook.com/Streetsmartfb/reels/", name: "Streetsmart", requestedVideoCount: 30 },
];

function detectPlatform(url: string) {
  if (url.includes("youtube.com")) return "YOUTUBE" as const;
  if (url.includes("instagram.com")) return "INSTAGRAM" as const;
  return "FACEBOOK" as const;
}

export async function POST() {
  const created = [];

  for (const sourceData of INITIAL_SOURCES) {
    const source = await prisma.source.upsert({
      where: { url: sourceData.url },
      create: {
        ...sourceData,
        platform: detectPlatform(sourceData.url),
        status: "PENDING",
      },
      update: {},
    });
    created.push(source);
  }

  return NextResponse.json({ created: created.length });
}
