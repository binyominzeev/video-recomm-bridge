import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type RouteContext = { params: { id: string } };

export async function POST(req: NextRequest, context: RouteContext) {
  const body = (await req.json().catch(() => ({}))) as { budgetLimit?: number };
  const batch = await prisma.batch.findUnique({ where: { id: context.params.id } });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  if (batch.status !== "ESTIMATED") {
    return NextResponse.json({ error: "Only estimated batches can be approved" }, { status: 409 });
  }

  const snapshot = batch.estimateSnapshot as { totals?: { high?: number } } | null;
  const highEstimate = snapshot?.totals?.high;
  if (typeof highEstimate !== "number") {
    return NextResponse.json({ error: "Batch has no valid estimate snapshot" }, { status: 409 });
  }

  const budgetLimit = body.budgetLimit ?? batch.budgetLimit ?? highEstimate;
  if (!Number.isFinite(budgetLimit) || budgetLimit < highEstimate) {
    return NextResponse.json(
      { error: "Budget limit must cover the high estimate", highEstimate },
      { status: 400 }
    );
  }

  const approved = await prisma.batch.update({
    where: { id: batch.id },
    data: { status: "APPROVED", budgetLimit, approvedAt: new Date() },
    include: { items: true },
  });

  return NextResponse.json(approved);
}