import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export async function checkDailyTurnLimit(userId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const count = await prisma.message.count({
    where: {
      role: "user",
      session: { userId },
      createdAt: { gte: start }
    }
  });

  return {
    count,
    limit: env.dailyTurnLimit,
    allowed: count < env.dailyTurnLimit
  };
}
