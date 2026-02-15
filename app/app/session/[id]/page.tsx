import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionClient } from "@/components/SessionClient";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const session = await prisma.session.findFirst({ where: { id, userId: user.id } });
  if (!session) redirect("/app");

  const messages = await prisma.message.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
    take: 200
  });

  const analyses = await prisma.turnAnalysis.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <SessionClient
      session={{
        id: session.id,
        coachMode: session.coachMode,
        level: session.level,
        theme: session.theme,
        durationMinutes: session.durationMinutes,
        startedAt: session.startedAt.toISOString()
      }}
      initialMessages={messages.map((message) => ({
        id: message.id,
        role: message.role,
        contentText: message.contentText,
        language: message.language,
        translationJson: (message.translationJson as string[] | null) || null
      }))}
      initialAnalyses={analyses.map((analysis) => ({
        id: analysis.id,
        userMessageId: analysis.userMessageId,
        correctedTextEs: analysis.correctedTextEs,
        highlightsJson: (analysis.highlightsJson as { start: number; end: number; label: string }[]) || [],
        explanationsJson: (analysis.explanationsJson as string[]) || [],
        alternativesJson:
          (analysis.alternativesJson as { label: "more_natural" | "more_formal"; textEs?: string; text_es?: string }[]) ||
          [],
        mistakesJson:
          (analysis.mistakesJson as { category: string; note: string; example_fix: string }[]) || []
      }))}
    />
  );
}
