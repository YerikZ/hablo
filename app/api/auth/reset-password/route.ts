import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, verifyPassword, hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/types";
import { toErrorMessage } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ip = request.headers.get("x-forwarded-for") || "local";
    if (!checkRateLimit(`reset-password:${user.id}:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: "Too many password reset attempts." }, { status: 429 });
    }

    const parsed = resetPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "New password must be different from current password." }, { status: 400 });
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error, "Failed to reset password") }, { status: 500 });
  }
}
