import { NextResponse } from "next/server";

import { runClaimGrouping } from "@/lib/pipeline/claimGrouping";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const STALE_RUN_MS = 15 * 60 * 1000;
  const runningRun = await prisma.claimGroupingRun.findFirst({
    where: { status: "RUNNING" },
    select: { id: true, startedAt: true },
  });

  if (runningRun) {
    const isStale = Date.now() - runningRun.startedAt.getTime() > STALE_RUN_MS;
    if (!isStale) {
      return NextResponse.json(
        { error: "A claim grouping run is already in progress", runId: runningRun.id },
        { status: 409 }
      );
    }

    // Likely abandoned by a server restart mid-run; unblock instead of wedging forever.
    await prisma.claimGroupingRun.update({
      where: { id: runningRun.id },
      data: {
        status: "FAILED",
        errorMessage: "Run appears stale (no update for 15+ minutes), marked as failed",
        completedAt: new Date(),
      },
    });
  }

  const run = await prisma.claimGroupingRun.create({ data: {} });

  void runClaimGrouping(run.id).catch((error) =>
    console.error("Claim grouping run failed", { runId: run.id, error })
  );

  return NextResponse.json({ message: "Claim grouping started", runId: run.id });
}
