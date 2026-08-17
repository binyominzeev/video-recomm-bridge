import { NextRequest, NextResponse } from "next/server";

import {
  runEmbedding,
  runEvaluation,
  runExtraction,
  runFullPipeline,
  runTranscription,
} from "@/lib/pipeline/runner";

export const dynamic = "force-dynamic";

function logBackgroundFailure(stage: string, videoId: string, error: unknown) {
  const details = error as {
    name?: string;
    message?: string;
    stack?: string;
    cause?: unknown;
  };
  console.error("Video processing failed", {
    stage,
    videoId,
    name: details?.name || "UnknownError",
    message: details?.message || String(error),
    stack: details?.stack,
    cause: details?.cause,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await req.json().catch(() => ({}))) as { stage?: string };
  const stage = body.stage || "full";

  if (stage === "transcribe") {
    void runTranscription(params.id).catch((error) =>
      logBackgroundFailure(stage, params.id, error)
    );
  } else if (stage === "extract") {
    void runExtraction(params.id).catch((error) =>
      logBackgroundFailure(stage, params.id, error)
    );
  } else if (stage === "evaluate") {
    void runEvaluation(params.id).catch((error) =>
      logBackgroundFailure(stage, params.id, error)
    );
  } else if (stage === "embed") {
    void runEmbedding(params.id).catch((error) =>
      logBackgroundFailure(stage, params.id, error)
    );
  } else {
    void runFullPipeline(params.id).catch((error) =>
      logBackgroundFailure(stage, params.id, error)
    );
  }

  return NextResponse.json({ message: `Processing started: ${stage}` });
}
