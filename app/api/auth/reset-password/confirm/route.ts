import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmResetPasswordSchema } from "@/lib/types";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { toErrorMessage } from "@/lib/errors";

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
    if (!checkRateLimit(`confirm-reset:${ip}`, 25, 60_000)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const parsed = confirmResetPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const resetRepo = getPasswordResetTokenRepo();
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const tokenRow = await resetRepo.findUnique({
      where: { tokenHash }
    });

    if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token is invalid or expired." }, { status: 400 });
    }

    const newHash = await hashPassword(parsed.data.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: tokenRow.userId },
        data: { passwordHash: newHash }
      }),
      resetRepo.update({
        where: { id: tokenRow.id },
        data: { usedAt: new Date() }
      }),
      resetRepo.deleteMany({
        where: { userId: tokenRow.userId, usedAt: null }
      })
    ]);

    return NextResponse.json({ ok: true, message: "Password reset successful." });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error, "Failed to reset password") }, { status: 500 });
  }
}
