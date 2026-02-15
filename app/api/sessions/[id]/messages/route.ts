import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/types";
import { generateTurn } from "@/lib/openai";
import { WEAKNESS_CATEGORIES } from "@/lib/constants";
import { checkDailyTurnLimit } from "@/lib/daily-limit";
import { toErrorMessage } from "@/lib/errors";

function detectLanguage(content: string): "es" | "en" {
  const text = ` ${content.toLowerCase()} `;
  return [" the ", " and ", " what ", " how ", " is ", " are "].some((h) => text.includes(h)) ? "en" : "es";
}

function sseEvent(type: string, data: unknown) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const startedAtMs = Date.now();
    const user = await requireApiUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const daily = await checkDailyTurnLimit(user.id);
    if (!daily.allowed) {
      return NextResponse.json(
        { error: `Daily turn limit reached (${daily.limit}). Please continue tomorrow.` },
        { status: 429 }
      );
    }

    const { id } = await context.params;
    const session = await prisma.session.findFirst({ where: { id, userId: user.id } });
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = messageSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const now = new Date();
    const elapsedMinutes = Math.floor((now.getTime() - session.startedAt.getTime()) / 60000);

    const last = await prisma.message.findFirst({
      where: { sessionId: id },
      orderBy: { turnIndex: "desc" }
    });
    const userTurnIndex = (last?.turnIndex ?? 0) + 1;

    const userLanguage = detectLanguage(parsed.data.contentText);
    const userMessage = await prisma.message.create({
      data: {
        sessionId: id,
        role: "user",
        contentText: parsed.data.contentText,
        language: userLanguage,
        turnIndex: userTurnIndex
      }
    });

    const contextMessages = await prisma.message.findMany({
      where: { sessionId: id },
      select: { role: true, contentText: true },
      orderBy: { createdAt: "asc" },
      take: 12
    });

    const turn = await generateTurn({
      theme: session.theme,
      level: session.level,
      durationMinutes: session.durationMinutes,
      elapsedMinutes,
      memorySummary: session.memorySummary,
      coachMode: session.coachMode,
      messages: contextMessages,
      userText: parsed.data.contentText
    });

    await prisma.message.update({
      where: { id: userMessage.id },
      data: {
        translationJson: turn.user_translation.user_translation_sentences,
        language: turn.user_translation.user_text_language
      }
    });

    const assistantMessage = await prisma.message.create({
      data: {
        sessionId: id,
        role: "assistant",
        contentText: turn.assistant_reply_es,
        language: "es",
        translationJson: turn.assistant_reply_en_sentences,
        turnIndex: userTurnIndex + 1
      }
    });

    let analysisPayload: unknown = null;

    if (session.coachMode && turn.analysis) {
    const created = await prisma.turnAnalysis.create({
      data: {
        sessionId: id,
        userMessageId: userMessage.id,
        correctedTextEs: turn.analysis.corrected_user_text_es,
        highlightsJson: turn.analysis.highlights,
        explanationsJson: turn.analysis.explanations_en,
        alternativesJson: turn.analysis.alternatives,
        mistakesJson: turn.analysis.mistakes,
        tagsJson: turn.analysis.flashcards_suggestions.flatMap((f) => f.tags).slice(0, 10)
      }
    });

    analysisPayload = created;

    for (const mistake of turn.analysis.mistakes) {
      if (!WEAKNESS_CATEGORIES.includes(mistake.category as (typeof WEAKNESS_CATEGORIES)[number])) continue;

      await prisma.weaknessStat.upsert({
        where: {
          userId_category: {
            userId: user.id,
            category: mistake.category
          }
        },
        update: {
          count: { increment: 1 },
          lastSeenAt: now
        },
        create: {
          userId: user.id,
          category: mistake.category,
          count: 1,
          lastSeenAt: now
        }
      });
    }

    for (const suggestion of turn.analysis.flashcards_suggestions.slice(0, 3)) {
      await prisma.flashcard.create({
        data: {
          userId: user.id,
          sessionId: id,
          front: suggestion.front,
          back: suggestion.back,
          tagsJson: suggestion.tags,
          dueAt: now,
          intervalDays: 1,
          ease: 2.5
        }
      });
    }

    const everyN = Math.max(1, env.memorySummaryEveryN);
    if (userTurnIndex % everyN === 0 && turn.analysis.session_memory_update) {
      await prisma.session.update({
        where: { id },
        data: { memorySummary: turn.analysis.session_memory_update }
      });
    }
    }

    const latencyMs = Date.now() - startedAtMs;
    const estimatedPromptTokens = Math.ceil(
      (contextMessages.map((m) => m.contentText).join(" ").length + parsed.data.contentText.length) / 4
    );
    const estimatedCompletionTokens = Math.ceil(turn.assistant_reply_es.length / 4);
    console.info(
      JSON.stringify({
        route: "POST /api/sessions/[id]/messages",
        userId: user.id,
        sessionId: id,
        latencyMs,
        estimatedPromptTokens,
        estimatedCompletionTokens
      })
    );

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const words = assistantMessage.contentText.split(/\s+/).filter(Boolean);

          for (const word of words) {
            controller.enqueue(encoder.encode(sseEvent("assistant_delta", { text: `${word} ` })));
            await new Promise((r) => setTimeout(r, 18));
          }

          controller.enqueue(
            encoder.encode(
              sseEvent("assistant_final", {
                user_message_id: userMessage.id,
                assistant_message_id: assistantMessage.id,
                assistant_reply_es: turn.assistant_reply_es,
                assistant_reply_en_sentences: turn.assistant_reply_en_sentences,
                wrapup_triggered: turn.wrapup_triggered
              })
            )
          );

          controller.enqueue(
            encoder.encode(
              sseEvent("user_translation", {
                user_message_id: userMessage.id,
                ...turn.user_translation
              })
            )
          );

          if (analysisPayload) {
            controller.enqueue(encoder.encode(sseEvent("turn_analysis", analysisPayload)));
          }

          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(sseEvent("error", { message: toErrorMessage(error, "Failed while streaming response") }))
          );
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error, "Failed to process message") }, { status: 500 });
  }
}
