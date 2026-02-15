import { NextRequest, NextResponse } from "next/server";
import { createSessionSchema } from "@/lib/types";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toErrorMessage } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const json = await request.json();
    const parsed = createSessionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { theme, level, durationMinutes, coachMode } = parsed.data;

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        theme,
        level,
        durationMinutes,
        coachMode,
        title: `${level} · ${theme.slice(0, 48)}`
      }
    });

    const initialEs = `Hola. Soy Rubio. Tu coach de espanol de Espana. Empecemos con ${theme}. ?Como te sientes hoy respecto a este tema?`;
    const initialEn = [
      `Hello. I am your Spain-Spanish coach.`,
      `Let's start with ${theme}.`,
      `How do you feel about this topic today?`
    ];

    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        contentText: initialEs,
        language: "es",
        translationJson: initialEn,
        turnIndex: 0
      }
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error, "Failed to create session") }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
      include: {
        _count: { select: { messages: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 25
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error, "Failed to load sessions") }, { status: 500 });
  }
}
