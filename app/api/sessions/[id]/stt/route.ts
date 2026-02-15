import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transcribeAudio } from "@/lib/openai";
import { toErrorMessage } from "@/lib/errors";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const session = await prisma.session.findFirst({ where: { id, userId: user.id } });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const blob = formData.get("audio");
  if (!(blob instanceof Blob)) {
    return NextResponse.json({ error: "audio field is required" }, { status: 400 });
  }
  if (blob.size === 0) {
    return NextResponse.json({ error: "Uploaded audio is empty. Please record again." }, { status: 400 });
  }

  try {
    const result = await transcribeAudio(blob);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error, "STT failed") }, { status: 400 });
  }
}
