import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { requireApiUser } from "@/lib/auth";
import { synthesizeSpeech } from "@/lib/openai";
import { toErrorMessage } from "@/lib/errors";

const schema = z.object({
  textEs: z.string().min(1).max(1500),
  voice: z.string().min(1).max(50).optional()
});

export async function POST(request: NextRequest) {
  const user = await requireApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const voice = parsed.data.voice || env.defaultTtsVoice;
    const response = await synthesizeSpeech(parsed.data.textEs, voice);

    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error, "TTS failed") }, { status: 400 });
  }
}
