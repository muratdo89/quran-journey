import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

  const looksLikeVertexKey = geminiKey.startsWith("AQ.");

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
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
      return NextResponse.json({
        gemini: {
          ok: true,
          status: "connected",
          messageTr: "Gemini 2.5 Flash ve doğal Türkçe ses bağlantısı çalışıyor.",
        },
        groq: {
          configured: Boolean(groqKey),
        },
      });
    }

    const errText = await res.text().catch(() => "");
    const hintTr = looksLikeVertexKey
      ? `Google API anahtarı reddedildi (HTTP ${res.status}). Anahtarın "AQ." ile başlıyor (Vertex AI biçimi). Google AI Studio (aistudio.google.com/apikey) üzerinden "AIza..." ile başlayan Gemini API anahtarı alıp .env.local dosyasına koyman gerekiyor.`
      : `Google Gemini API hata döndürdü (HTTP ${res.status}). Anahtarın geçerli olduğundan ve Gemini API erişiminin açık olduğundan emin ol.`;

    return NextResponse.json({
      gemini: {
        ok: false,
        status: "error",
        httpStatus: res.status,
        messageTr: hintTr,
        detail: errText.slice(0, 180),
      },
      groq: {
        configured: Boolean(groqKey),
      },
    });
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
