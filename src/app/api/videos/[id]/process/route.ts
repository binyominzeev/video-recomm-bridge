import { NextRequest, NextResponse } from "next/server";

import {
  runEmbedding,
  runExtraction,
  runFullPipeline,
  runTranscription,
} from "@/lib/pipeline/runner";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await req.json().catch(() => ({}))) as { stage?: string };
  const stage = body.stage || "full";

  if (stage === "transcribe") {
    void runTranscription(params.id).catch(console.error);
  } else if (stage === "extract") {
    void runExtraction(params.id).catch(console.error);
  } else if (stage === "embed") {
    void runEmbedding(params.id).catch(console.error);
  } else {
    void runFullPipeline(params.id).catch(console.error);
  }

  return NextResponse.json({ message: `Processing started: ${stage}` });
}
