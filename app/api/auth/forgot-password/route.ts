import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/types";
import { toErrorMessage } from "@/lib/errors";

const RESET_TTL_MINUTES = 15;

function getPasswordResetTokenRepo() {
  const repo = (prisma as unknown as { passwordResetToken?: any }).passwordResetToken;
  if (!repo) {
    throw new Error(
      "Password reset store is not initialized. Run Prisma migration and generate client, then restart."
    );
  }
  return repo;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "local";
    if (!checkRateLimit(`forgot-password:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const parsed = forgotPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
    if (!user) {
      return NextResponse.json({ ok: true, message: "If this account exists, a reset token has been generated." });
    }

    const resetRepo = getPasswordResetTokenRepo();
    await resetRepo.deleteMany({ where: { userId: user.id, usedAt: null } });

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    await resetRepo.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Use this token in the reset form before it expires.",
      resetToken: rawToken,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error, "Failed to generate reset token") }, { status: 500 });
  }
}
