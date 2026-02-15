import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSessionSchema } from "@/lib/types";

async function getOwnedSession(userId: string, id: string) {
  return prisma.session.findFirst({ where: { id, userId } });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const session = await getOwnedSession(user.id, id);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
    take: 120
  });

  const userMessageIds = messages.filter((m) => m.role === "user").map((m) => m.id);
  const analyses = await prisma.turnAnalysis.findMany({
    where: { userMessageId: { in: userMessageIds } },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return NextResponse.json({ session, messages, analyses });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const existing = await getOwnedSession(user.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await request.json();
  const parsed = updateSessionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const session = await prisma.session.update({
    where: { id },
    data: parsed.data
  });

  return NextResponse.json({ session });
}
