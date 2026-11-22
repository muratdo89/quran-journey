import { NextResponse } from "next/server";
import { z } from "zod";
import { synthesizeTurkishTeacherAudio } from "@/lib/tutor/gemini-tts";

export const dynamic = "force-dynamic";

const TtsRequestSchema = z.object({
  text: z.string().min(1).max(700),
  voiceName: z.string().max(40).optional(),
});

// Lightweight LRU cache for repeated short teacher phrases (cuts latency & API cost)
const MAX_CACHE = 40;
const audioCache = new Map<string, { audioDataUrl: string; model: string | null }>();

export async function POST(req: Request) {
  try {
    const body = TtsRequestSchema.parse(await req.json());
    const text = body.text.trim();
    const voice = body.voiceName ?? "Orus";
    const key = `${voice}::${text}`;

    const cached = audioCache.get(key);
    if (cached) {
      audioCache.delete(key);
      audioCache.set(key, cached);
      return NextResponse.json({ ...cached, cached: true });
    }

    const tts = await synthesizeTurkishTeacherAudio(text, voice);
    if (tts.audioDataUrl) {
      if (audioCache.size >= MAX_CACHE) {
        const oldest = audioCache.keys().next().value;
        if (oldest) audioCache.delete(oldest);
      }
      audioCache.set(key, { audioDataUrl: tts.audioDataUrl, model: tts.model });
    }

    return NextResponse.json(tts);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz ses sentezi isteği." }, { status: 400 });
    }
    return NextResponse.json({ audioDataUrl: null, model: null, errorTr: "Ses üretilemedi." });
  }
}
