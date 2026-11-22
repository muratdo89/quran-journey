import { NextResponse } from "next/server";
import { transcribeTutorAudio } from "@/lib/tutor/audio-transcribe";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB safety guard

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const consentGranted = form.get("consentGranted") === "true";
    const rawLang = form.get("language");
    const language: "tr" | "ar" = rawLang === "ar" ? "ar" : "tr";
    const expectedArabicPrompt =
      typeof form.get("expectedArabicPrompt") === "string"
        ? String(form.get("expectedArabicPrompt"))
        : undefined;
    const rawAudio = form.get("audio");

    if (!consentGranted) {
      return NextResponse.json(
        {
          status: "client_fallback",
          provider: "none",
          transcript: "",
          errorTr: "Bulut ses çözümleme onayı kapalı; tarayıcı ses tanıma kullanılıyor.",
        },
        { status: 200 }
      );
    }

    if (!(rawAudio instanceof File) || rawAudio.size === 0) {
      return NextResponse.json({ error: "Ses verisi bulunamadı." }, { status: 400 });
    }

    if (rawAudio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Ses dosyası 10 MB sınırını aşıyor." }, { status: 413 });
    }

    const audioBytes = new Uint8Array(await rawAudio.arrayBuffer());
    const result = await transcribeTutorAudio({
      audioBytes,
      mimeType: rawAudio.type || "audio/webm",
      language,
      expectedArabicPrompt,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/tutor/transcribe failed:", error);
    return NextResponse.json(
      { error: "Ses çözümleme sırasında beklenmeyen hata oluştu." },
      { status: 500 }
    );
  }
}
