import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlashcardsClient } from "@/components/FlashcardsClient";

export default async function FlashcardsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const now = new Date();
  const [due, all] = await Promise.all([
    prisma.flashcard.findMany({
      where: { userId: user.id, dueAt: { lte: now } },
      orderBy: { dueAt: "asc" },
      take: 100
    }),
    prisma.flashcard.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 300
    })
  ]);

  return (
    <FlashcardsClient
      initialDue={due.map((card) => ({
        id: card.id,
        front: card.front,
        back: card.back,
        dueAt: card.dueAt.toISOString(),
        intervalDays: card.intervalDays,
        ease: card.ease
      }))}
      initialAll={all.map((card) => ({
        id: card.id,
        front: card.front,
        back: card.back,
        dueAt: card.dueAt.toISOString(),
        intervalDays: card.intervalDays,
        ease: card.ease
      }))}
    />
  );
}
