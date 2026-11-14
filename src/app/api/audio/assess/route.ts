import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveAssessmentProvider } from "@/lib/audio/assessment-provider";
import { getVerseByKey } from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";

const AssessSchema = z.object({
  id: z.string().optional(),
  verseKey: z.string().regex(/^\d+:\d+$/),
  audioMimeType: z.string().default("audio/webm"),
  durationMs: z.number().int().positive(),
  consentGranted: z.boolean(),
});

const DeleteSchema = z.object({
  id: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = AssessSchema.parse(await req.json());
    const verse = getVerseByKey(parsed.verseKey);
    if (!verse) {
      return NextResponse.json({ error: "Ayet bulunamadı." }, { status: 404 });
    }

    const id = parsed.id ?? crypto.randomUUID();
    const repo = await getRepository();
    const record = await repo.saveRecordingMetadata({
      id,
      verseKey: parsed.verseKey,
      durationMs: parsed.durationMs,
      consentGranted: parsed.consentGranted,
    });

    const provider = getActiveAssessmentProvider();
    const assessment = await provider.evaluate({
      verseKey: parsed.verseKey,
      expectedArabicText: verse.textUthmani,
      audioMimeType: parsed.audioMimeType,
      durationMs: parsed.durationMs,
      consentGranted: parsed.consentGranted,
    });

    return NextResponse.json({ record, assessment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz ses kaydı isteği." }, { status: 400 });
    }
    return NextResponse.json({ error: "Ses değerlendirmesi başarısız oldu." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const parsed = DeleteSchema.parse(await req.json());
    const repo = await getRepository();
    await repo.deleteRecordingMetadata({ id: parsed.id });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Kayıt silinemedi." }, { status: 400 });
  }
}
