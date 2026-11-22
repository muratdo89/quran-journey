import { NextResponse } from "next/server";
import { synthesizeTurkishTeacherAudio } from "@/lib/tutor/gemini-tts";

export const dynamic = "force-dynamic";

const GEMINI_TEXT_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
] as const;

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  const groqKey = process.env.GROQ_API_KEY?.trim() ?? "";

  if (!geminiKey) {
    return NextResponse.json({
      gemini: {
        ok: false,
        status: "unconfigured",
        messageTr: "GEMINI_API_KEY tanımlı değil (.env.local dosyasına eklenmeli).",
      },
      groq: {
        configured: Boolean(groqKey),
      },
    });
  }

  let lastStatus = 0;
  let lastDetail = "";

  for (const model of GEMINI_TEXT_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Merhaba" }] }],
            generationConfig: { maxOutputTokens: 8 },
          }),
        }
      );

      if (res.ok) {
        const tts = await synthesizeTurkishTeacherAudio("Merhaba.");
        const voiceNote = tts.audioDataUrl
          ? `Doğal Türkçe ses (${tts.model}) aktif.`
          : `Metin modeli çalışıyor ancak TTS uyarısı: ${tts.errorTr ?? "ses alınamadı"} (yedek ses kullanılacak).`;

        return NextResponse.json({
          gemini: {
            ok: true,
            status: "connected",
            model,
            ttsOk: Boolean(tts.audioDataUrl),
            messageTr: `Gemini (${model}) bağlantısı başarılı! ${voiceNote}`,
          },
          groq: {
            configured: Boolean(groqKey),
          },
        });
      }

      lastStatus = res.status;
      lastDetail = (await res.text().catch(() => "")).slice(0, 200);
      // If 401/403 (auth/permission error), no need to retry other models
      if (res.status === 401 || res.status === 403) break;
    } catch {
      return NextResponse.json({
        gemini: {
          ok: false,
          status: "network_error",
          messageTr: "Google Gemini sunucusuna bağlanılamadı (internet bağlantısını kontrol et).",
        },
        groq: {
          configured: Boolean(groqKey),
        },
      });
    }
  }

  return NextResponse.json({
    gemini: {
      ok: false,
      status: "error",
      httpStatus: lastStatus,
      messageTr: `Google Gemini API hata döndürdü (HTTP ${lastStatus}). ${lastDetail || "Anahtarının geçerli ve Gemini API için yetkili olduğundan emin ol."}`,
    },
    groq: {
      configured: Boolean(groqKey),
    },
  });
}
