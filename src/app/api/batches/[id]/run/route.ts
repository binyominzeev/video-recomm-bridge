import { NextResponse } from "next/server";

import { runBatch } from "@/lib/pipeline/runner";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: { id: string } };

function logBatchFailure(batchId: string, error: unknown) {
  const details = error as {
    name?: string;
    message?: string;
    stack?: string;
    cause?: unknown;
  };

  console.error("Batch processing failed", {
    batchId,
    name: details?.name || "UnknownError",
    message: details?.message || String(error),
    stack: details?.stack,
    cause: details?.cause,
  });
}

export async function POST(_: Request, context: RouteContext) {
  const batch = await prisma.batch.findUnique({
    where: { id: context.params.id },
    select: { id: true, status: true },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (!["APPROVED", "PAUSED"].includes(batch.status)) {
    return NextResponse.json(
      { error: "Only APPROVED or PAUSED batches can be started" },
      { status: 409 }
    );
  }

  void runBatch(batch.id).catch((error) => logBatchFailure(batch.id, error));

  return NextResponse.json({ message: "Batch processing started", batchId: batch.id });
}
