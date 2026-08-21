import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { classifyClaims, CLAIM_TAXONOMY } from "@/lib/pipeline/taxonomy";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 25;

type ClaimForClassification = { id: string; text: string };

type RawClaim = {
  text?: unknown;
  type?: unknown;
  importance?: unknown;
};

async function syncTaxonomyClaims() {
  const videos = await prisma.video.findMany({
    where: { extractions: { some: {} } },
    orderBy: { title: "asc" },
    select: {
      id: true,
      extractions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, rawJson: true },
      },
    },
  });

  const sourceClaims: Array<{
    extractionId: string;
    videoId: string;
    claimIndex: number;
    text: string;
    type: string;
    importance: number | null;
  }> = [];

  for (const video of videos) {
    const extraction = video.extractions[0];
    if (!extraction || !extraction.rawJson || typeof extraction.rawJson !== "object") continue;
    const rawClaims = "claims" in extraction.rawJson && Array.isArray(extraction.rawJson.claims)
      ? (extraction.rawJson.claims as RawClaim[])
      : [];

    rawClaims.forEach((claim, claimIndex) => {
      const text = typeof claim.text === "string" ? claim.text.trim() : "";
      if (!text) return;
      sourceClaims.push({
        extractionId: extraction.id,
        videoId: video.id,
        claimIndex,
        text,
        type: typeof claim.type === "string" && claim.type.trim() ? claim.type.trim().toLowerCase() : "unknown",
        importance: typeof claim.importance === "number" ? claim.importance : null,
      });
    });
  }

  const existing = await prisma.$queryRaw<{ extractionId: string; claimIndex: number }[]>`
    SELECT "extractionId", "claimIndex" FROM "TaxonomyClaim"
  `;
  const existingKeys = new Set(existing.map((claim) => `${claim.extractionId}:${claim.claimIndex}`));
  const sourceKeys = new Set(sourceClaims.map((claim) => `${claim.extractionId}:${claim.claimIndex}`));
  const isInSync = existing.length === sourceClaims.length &&
    [...sourceKeys].every((key) => existingKeys.has(key));

  if (isInSync) return sourceClaims.length;

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`DELETE FROM "TaxonomyClaim"`;
    for (const claim of sourceClaims) {
      await transaction.$executeRaw`
        INSERT INTO "TaxonomyClaim" (
          "id", "extractionId", "videoId", "claimIndex", "text", "type", "importance"
        ) VALUES (
          ${randomUUID()}, ${claim.extractionId}, ${claim.videoId}, ${claim.claimIndex},
          ${claim.text}, ${claim.type}, ${claim.importance}
        )
      `;
    }
  });

  return sourceClaims.length;
}

async function classifyPendingClaims() {
  const claims = await prisma.$queryRaw<ClaimForClassification[]>`
    SELECT "id", "text"
    FROM "TaxonomyClaim"
    WHERE "taxonomyClassifiedAt" IS NULL
    ORDER BY "id"
  `;

  for (let offset = 0; offset < claims.length; offset += BATCH_SIZE) {
    const batch = claims.slice(offset, offset + BATCH_SIZE);
    const classifications = await classifyClaims(
      batch.map((claim, index) => ({ index, text: claim.text }))
    );
    const categoryById = new Map<string, (typeof CLAIM_TAXONOMY)[number]>(
      CLAIM_TAXONOMY.map((category) => [category.id, category])
    );

    await prisma.$transaction(
      batch.map((claim, index) => {
        const classification = classifications.find((item) => item.index === index);
        const category = classification?.categoryId
          ? categoryById.get(classification.categoryId)
          : undefined;
        const topic =
          category && classification?.topic &&
          (category.topics as readonly string[]).includes(classification.topic)
            ? classification.topic
            : null;

        return prisma.$executeRaw`
          UPDATE "TaxonomyClaim"
          SET "taxonomyCategoryId" = ${category?.id || null},
              "taxonomyTopic" = ${topic},
              "taxonomyClassifiedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${claim.id}
        `;
      })
    );
  }
}

export async function GET() {
  await syncTaxonomyClaims();

  const [progress, results] = await Promise.all([
    prisma.$queryRaw<{ total: bigint; classified: bigint }[]>`
      SELECT COUNT(*)::bigint AS total,
             COUNT("taxonomyClassifiedAt")::bigint AS classified
      FROM "TaxonomyClaim"
    `,
    prisma.$queryRaw<Array<{
      id: string;
      text: string;
      type: string;
      importance: number;
      taxonomyCategoryId: string | null;
      taxonomyTopic: string | null;
      videoId: string;
      videoTitle: string;
      sourceName: string;
    }>>`
            SELECT c."id", c."text", c."type", c."importance", c."taxonomyCategoryId",
              c."taxonomyTopic", v."id" AS "videoId", v."title" AS "videoTitle",
             s."name" AS "sourceName"
      FROM "TaxonomyClaim" c
      JOIN "Video" v ON v."id" = c."videoId"
      JOIN "Source" s ON s."id" = v."sourceId"
      WHERE c."taxonomyClassifiedAt" IS NOT NULL
      ORDER BY c."text" ASC
    `,
  ]);

  return NextResponse.json({
    taxonomy: CLAIM_TAXONOMY,
    total: Number(progress[0]?.total || 0),
    classified: Number(progress[0]?.classified || 0),
    results,
  });
}

export async function POST() {
  await syncTaxonomyClaims();

  const pending = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "TaxonomyClaim"
    WHERE "taxonomyClassifiedAt" IS NULL
  `;
  if (Number(pending[0]?.count || 0) === 0) {
    return NextResponse.json({ message: "A claim-ek már be vannak sorolva." });
  }

  void classifyPendingClaims().catch((error) =>
    console.error("Claim taxonomy classification failed", { error })
  );

  return NextResponse.json({ message: "Taxonomy besorolás elindítva." }, { status: 202 });
}