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
  clientTranscript: z.string().max(4000).optional(),
});

const DeleteSchema = z.object({
  id: z.string().min(1),
});

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB safety guard

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let parsed: z.infer<typeof AssessSchema>;
    let audioBytes: Uint8Array | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const rawId = form.get("id");
      const rawVerseKey = form.get("verseKey");
      const rawMime = form.get("audioMimeType");
      const rawDuration = form.get("durationMs");
      const rawConsent = form.get("consentGranted");
      const rawTranscript = form.get("clientTranscript");
      const rawAudio = form.get("audio");

      parsed = AssessSchema.parse({
        id: typeof rawId === "string" && rawId ? rawId : undefined,
        verseKey: typeof rawVerseKey === "string" ? rawVerseKey : "",
        audioMimeType: typeof rawMime === "string" && rawMime ? rawMime : "audio/webm",
        durationMs: Number(rawDuration),
        consentGranted: rawConsent === "true",
        clientTranscript:
          typeof rawTranscript === "string" && rawTranscript.trim()
            ? rawTranscript.trim()
            : undefined,
      });

      // Enforce explicit user consent on server side before reading/forwarding any audio bytes
      if (parsed.consentGranted && rawAudio instanceof File) {
        if (rawAudio.size > MAX_AUDIO_BYTES) {
          return NextResponse.json(
            { error: "Ses dosyası 15 MB sınırını aşıyor." },
            { status: 413 }
          );
        }
        audioBytes = new Uint8Array(await rawAudio.arrayBuffer());
      }
    } else {
      parsed = AssessSchema.parse(await req.json());
    }

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
      audioBytes: parsed.consentGranted ? audioBytes : undefined,
      clientTranscript: parsed.consentGranted ? parsed.clientTranscript : undefined,
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
