import { NextRequest, NextResponse } from "next/server";
import { authSchema } from "@/lib/types";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSessionToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  if (!checkRateLimit(`login:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many login attempts." }, { status: 429 });
  }

  const json = await request.json();
  const parsed = authSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload." }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

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
