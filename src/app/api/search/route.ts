import { NextRequest, NextResponse } from "next/server";

import { generateEmbedding } from "@/lib/pipeline/embeddings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query) return NextResponse.json({ results: [] });

  try {
    const embedding = await generateEmbedding(query);
    const vectorStr = `[${embedding.join(",")}]`;

    const results = await prisma.$queryRaw<
      Array<{ id: string; title: string; url: string; similarity: number }>
    >`
      SELECT id, title, url,
        1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM "Video"
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT 10
    `;

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message || "Search failed" },
      { status: 500 }
    );
  }
}
