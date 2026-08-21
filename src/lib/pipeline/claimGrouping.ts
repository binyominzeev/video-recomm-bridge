import { randomUUID } from "crypto";

import OpenAI from "openai";

import { prisma } from "@/lib/prisma";

import type { ExtractionResult } from "./extraction";
import { generateEmbeddingsBatch } from "./embeddings";

export const CLAIM_GROUPING_PROMPT_VERSION = "v1";

// text-embedding-3-small cosine similarities run higher/narrower than older models:
// unrelated claims typically score ~0.1-0.4, same-topic-different-claim ~0.4-0.65,
// and genuine paraphrases/duplicates ~0.75-0.95. 0.78 targets "same claim" matches
// without merging merely-related claims.
const CLUSTER_SIMILARITY_THRESHOLD = Number(
  process.env.CLAIM_CLUSTER_THRESHOLD || 0.78
);
const SAMPLE_CLAIMS_PER_GROUP = 5;
// Keep each chunk small so progress is visible and a single slow/failed
// OpenAI call only affects a bounded slice of videos/groups.
const VIDEO_BATCH_SIZE = 10;
const GROUPS_PER_LABELING_CALL = 15;
const CLAIM_INSERT_CHUNK_SIZE = 50;

const GOOD_RECOMMENDATION_VALUES = new Set(["excellent", "useful"]);

type FlatClaim = {
  videoId: string;
  extractionId: string;
  text: string;
  type: string;
  importance: number;
  isGoodQuality: boolean;
  recommendationValue: string | null;
};

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Complete-linkage clustering: a claim only joins an existing cluster if it's
// similar enough to *every* current member (not just an average/centroid).
// This avoids the "chaining" problem where a centroid drifts and pulls in
// increasingly unrelated claims - important since a mismatch here is visible
// to users as a wrong grouping, not just a minor scoring error.
function clusterByEmbedding(embeddings: number[][]): number[] {
  const clusters: number[][] = [];
  const assignments: number[] = [];

  for (let idx = 0; idx < embeddings.length; idx++) {
    const embedding = embeddings[idx];
    let bestCluster = -1;
    let bestMinSimilarity = -Infinity;

    for (let c = 0; c < clusters.length; c++) {
      let minSimilarity = Infinity;
      for (const memberIdx of clusters[c]) {
        const similarity = cosineSimilarity(embedding, embeddings[memberIdx]);
        if (similarity < minSimilarity) minSimilarity = similarity;
        if (minSimilarity < CLUSTER_SIMILARITY_THRESHOLD) break;
      }
      if (minSimilarity > bestMinSimilarity) {
        bestMinSimilarity = minSimilarity;
        bestCluster = c;
      }
    }

    if (bestCluster >= 0 && bestMinSimilarity >= CLUSTER_SIMILARITY_THRESHOLD) {
      clusters[bestCluster].push(idx);
      assignments.push(bestCluster);
    } else {
      clusters.push([idx]);
      assignments.push(clusters.length - 1);
    }
  }

  return assignments;
}

async function labelGroups(
  groups: { index: number; sampleTexts: string[]; count: number }[]
): Promise<Map<number, { label: string; summary: string }>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.CLAIM_LABELING_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const result = new Map<number, { label: string; summary: string }>();

  // Label groups in small chunks instead of one giant prompt, so a single
  // call failure only loses labels for a bounded slice of groups (they fall
  // back to "Group N") and progress stays visible run-to-run.
  for (let i = 0; i < groups.length; i += GROUPS_PER_LABELING_CALL) {
    const chunk = groups.slice(i, i + GROUPS_PER_LABELING_CALL);
    const input = chunk.map((g) => ({
      groupIndex: g.index,
      claimCount: g.count,
      sampleClaims: g.sampleTexts,
    }));

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You label clusters of similar factual claims extracted from videos. " +
            "For each group, produce a short label (max 8 words) and a 1-sentence summary " +
            "describing what the claims in that group have in common. " +
            "Return ONLY valid JSON matching the schema.",
        },
        {
          role: "user",
          content: `Groups:\n${JSON.stringify(input, null, 2)}\n\nReturn JSON with this exact structure:\n{ "groups": [ { "groupIndex": 0, "label": "...", "summary": "..." } ] }`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const rawContent = response.choices[0]?.message?.content || "{}";
    let parsed: { groups?: { groupIndex: number; label: string; summary: string }[] };

    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { groups: [] };
    }

    for (const g of parsed.groups || []) {
      result.set(g.groupIndex, { label: g.label, summary: g.summary });
    }
  }

  return result;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function runClaimGrouping(runId: string): Promise<void> {
  try {
    // Optional safety valve for manual testing on a subset of videos before a full run.
    const maxVideos = Number(process.env.CLAIM_GROUPING_MAX_VIDEOS || 0) || undefined;

    const videos = await prisma.video.findMany({
      where: { extractions: { some: {} } },
      take: maxVideos,
      select: {
        id: true,
        extractions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, rawJson: true },
        },
        evaluations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { exclude: true, recommendationValue: true },
        },
      },
    });

    await prisma.claimGroupingRun.update({
      where: { id: runId },
      data: { phase: "collecting", totalVideos: videos.length, processedVideos: 0 },
    });

    const flatClaims: FlatClaim[] = [];
    const embeddings: number[][] = [];

    // Process videos in small batches: flatten claims for the batch, embed
    // just that batch, then report progress before moving to the next one.
    const videoBatches = chunkArray(videos, VIDEO_BATCH_SIZE);
    let processedVideos = 0;

    for (const batch of videoBatches) {
      const batchClaims: FlatClaim[] = [];

      for (const video of batch) {
        const extraction = video.extractions[0];
        if (!extraction) continue;

        const evaluation = video.evaluations[0];
        const recommendationValue = evaluation?.recommendationValue ?? null;
        const isGoodQuality =
          evaluation !== undefined &&
          evaluation.exclude === false &&
          GOOD_RECOMMENDATION_VALUES.has(recommendationValue || "");

        const rawJson = extraction.rawJson as unknown as ExtractionResult;
        for (const claim of rawJson.claims || []) {
          if (!claim.text) continue;
          batchClaims.push({
            videoId: video.id,
            extractionId: extraction.id,
            text: claim.text,
            type: claim.type,
            importance: claim.importance,
            isGoodQuality,
            recommendationValue,
          });
        }
      }

      if (batchClaims.length > 0) {
        await prisma.claimGroupingRun.update({
          where: { id: runId },
          data: { phase: "embedding" },
        });
        const batchEmbeddings = await generateEmbeddingsBatch(
          batchClaims.map((c) => c.text)
        );
        flatClaims.push(...batchClaims);
        embeddings.push(...batchEmbeddings);
      }

      processedVideos += batch.length;
      await prisma.claimGroupingRun.update({
        where: { id: runId },
        data: { processedVideos },
      });
    }

    if (flatClaims.length === 0) {
      await prisma.claimGroupingRun.update({
        where: { id: runId },
        data: {
          status: "COMPLETED",
          phase: "done",
          totalClaims: 0,
          totalGroups: 0,
          completedAt: new Date(),
        },
      });
      return;
    }

    await prisma.claimGroupingRun.update({
      where: { id: runId },
      data: { phase: "clustering" },
    });
    const assignments = clusterByEmbedding(embeddings);

    const groupCount = Math.max(...assignments) + 1;
    const groupSamples: { index: number; sampleTexts: string[]; count: number }[] = [];
    for (let i = 0; i < groupCount; i++) {
      const memberIndexes = assignments
        .map((groupIndex, claimIndex) => ({ groupIndex, claimIndex }))
        .filter((entry) => entry.groupIndex === i)
        .map((entry) => entry.claimIndex);

      groupSamples.push({
        index: i,
        count: memberIndexes.length,
        sampleTexts: memberIndexes
          .slice(0, SAMPLE_CLAIMS_PER_GROUP)
          .map((claimIndex) => flatClaims[claimIndex].text),
      });
    }

    await prisma.claimGroupingRun.update({
      where: { id: runId },
      data: { phase: "labeling" },
    });
    const labels = await labelGroups(groupSamples);

    await prisma.claimGroupingRun.update({
      where: { id: runId },
      data: { phase: "saving" },
    });

    const groupIdByIndex = new Map<number, string>();
    for (const group of groupSamples) {
      const label = labels.get(group.index);
      const created = await prisma.claimGroup.create({
        data: {
          runId,
          label: label?.label || `Group ${group.index + 1}`,
          summary: label?.summary || null,
          claimCount: group.count,
        },
      });
      groupIdByIndex.set(group.index, created.id);
    }

    // Insert claims in small chunks rather than one huge transaction, so
    // progress persists incrementally and a failure doesn't roll back everything.
    const claimIndexes = flatClaims.map((_, i) => i);
    for (const chunk of chunkArray(claimIndexes, CLAIM_INSERT_CHUNK_SIZE)) {
      await prisma.$transaction(
        chunk.map((i) => {
          const claim = flatClaims[i];
          const embedding = embeddings[i];
          const groupId = groupIdByIndex.get(assignments[i]) ?? null;
          const vectorStr = `[${embedding.join(",")}]`;

          return prisma.$executeRaw`
            INSERT INTO "Claim" (
              "id", "runId", "videoId", "extractionId", "groupId", "text", "type",
              "importance", "isGoodQuality", "recommendationValue", "embedding", "createdAt"
            ) VALUES (
              ${randomUUID()}, ${runId}, ${claim.videoId}, ${claim.extractionId}, ${groupId},
              ${claim.text}, ${claim.type}, ${claim.importance}, ${claim.isGoodQuality},
              ${claim.recommendationValue}, ${vectorStr}::vector, now()
            )
          `;
        })
      );
    }

    await prisma.claimGroupingRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        phase: "done",
        totalClaims: flatClaims.length,
        totalGroups: groupCount,
        completedAt: new Date(),
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Claim grouping failed", { runId, error });
    await prisma.claimGroupingRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        errorMessage: err.message || "Unknown error",
        completedAt: new Date(),
      },
    });
  }
}
