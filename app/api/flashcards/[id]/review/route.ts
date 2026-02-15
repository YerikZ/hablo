import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/lib/types";
import { reviewCard } from "@/lib/sm2";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const card = await prisma.flashcard.findFirst({ where: { id, userId: user.id } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const next = reviewCard({ intervalDays: card.intervalDays, ease: card.ease }, parsed.data.rating);
  const dueAt = new Date(Date.now() + next.intervalDays * 24 * 60 * 60 * 1000);

  const updated = await prisma.flashcard.update({
    where: { id },
    data: {
      intervalDays: next.intervalDays,
      ease: next.ease,
      dueAt
    }
  });

  return NextResponse.json({ card: updated });
}
