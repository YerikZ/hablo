import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await requireApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const [due, all] = await Promise.all([
    prisma.flashcard.findMany({
      where: { userId: user.id, dueAt: { lte: now } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 100
    }),
    prisma.flashcard.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 300
    })
  ]);

  return NextResponse.json({ due, all });
}
