import { NextRequest, NextResponse } from "next/server";
import { authSchema } from "@/lib/types";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSessionToken, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  if (!checkRateLimit(`signup:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many signup attempts." }, { status: 429 });
  }

  const json = await request.json();
  const parsed = authSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signup payload." }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { username, passwordHash }
  });

  const token = await createSessionToken({ userId: user.id, username: user.username });
  const response = NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}
