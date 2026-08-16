import { NextRequest, NextResponse } from "next/server";

import { runDiscovery } from "@/lib/pipeline/runner";

export const dynamic = "force-dynamic";
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  void runDiscovery(params.id).catch(console.error);
  return NextResponse.json({ message: "Discovery started" });
}
