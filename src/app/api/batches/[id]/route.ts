import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type RouteContext = { params: { id: string } };

export async function GET(_: Request, context: RouteContext) {
  const batch = await prisma.batch.findUnique({
    where: { id: context.params.id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: { video: { select: { id: true, title: true, duration: true } } },
      },
      costEvents: {
        where: { kind: "ACTUAL" },
        select: { stage: true, provider: true, estimatedCost: true, currency: true },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const progress = batch.items.reduce(
    (result, item) => {
      result[item.status] = (result[item.status] || 0) + 1;
      return result;
    },
    {} as Record<string, number>
  );
  const actualCost = batch.costEvents.reduce((sum, event) => sum + event.estimatedCost, 0);

  return NextResponse.json({
    ...batch,
    progress,
    actualCost,
  });
}

export async function POST(req: Request, context: RouteContext) {
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "cancel") {
    return NextResponse.json({ error: "Supported action: cancel" }, { status: 400 });
  }

  const batch = await prisma.batch.findUnique({ where: { id: context.params.id } });
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(batch.status)) {
    return NextResponse.json({ error: "Batch is already terminal" }, { status: 409 });
  }

  const cancelled = await prisma.$transaction([
    prisma.batch.update({
      where: { id: batch.id },
      data: { status: "CANCELLED" },
    }),
    prisma.batchItem.updateMany({
      where: { batchId: batch.id, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "CANCELLED" },
    }),
  ]);

  return NextResponse.json({ batch: cancelled[0], cancelledItems: cancelled[1].count });
}