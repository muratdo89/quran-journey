/**
 * Server-side speech transcription for the AI Voice Teacher.
 *
 * Priority order (optimized for lowest monthly cost + highest Arabic Quran accuracy):
 * 1. Groq Whisper (`whisper-large-v3-turbo`) when `GROQ_API_KEY` is configured — fast, ~$0.04/hr.
 * 2. Google Gemini 2.5 Flash multimodal audio transcription when `GEMINI_API_KEY` is configured.
 * 3. Client fallback signal (`client_fallback`) when neither cloud key is configured so the
 *    browser can gracefully use Web Speech API (`tr-TR` / `ar-SA`) without breaking.
 */

export interface TranscribeAudioResult {
  status: "completed" | "client_fallback" | "error";
  provider: "groq_whisper" | "gemini_audio" | "none";
  transcript: string;
  errorTr?: string;
}

export async function transcribeTutorAudio(params: {
  audioBytes: Uint8Array;
  mimeType: string;
  language: "tr" | "ar";
  expectedArabicPrompt?: string;
}): Promise<TranscribeAudioResult> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (groqKey) {
    try {
      const form = new FormData();
      const copy = new Uint8Array(params.audioBytes).buffer;
      const ext = params.mimeType.includes("mp4") ? "m4a" : params.mimeType.includes("ogg") ? "ogg" : "webm";
      form.append("file", new Blob([copy], { type: params.mimeType || "audio/webm" }), `speech.${ext}`);
      form.append("model", "whisper-large-v3-turbo");
      form.append("language", params.language);
      form.append("response_format", "json");
      if (params.language === "ar" && params.expectedArabicPrompt) {
        form.append("prompt", params.expectedArabicPrompt.slice(0, 200));
      }

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
      });

      if (!res.ok) {
        throw new Error(`Groq HTTP ${res.status}`);
      }
      const json = (await res.json()) as { text?: string };
      return {
        status: "completed",
        provider: "groq_whisper",
        transcript: (json.text ?? "").trim(),
      };
    } catch {
      // Fall through to Gemini if configured
      if (!geminiKey) {
        return {
          status: "error",
          provider: "groq_whisper",
          transcript: "",
          errorTr: "Groq ses çözümleme servisine şu an ulaşılamıyor.",
        };
      }
    }
  }

  if (geminiKey) {
    const cleanMime = (params.mimeType || "audio/webm").split(";")[0]!;
    const base64Audio = Buffer.from(params.audioBytes).toString("base64");
    const prompt =
      params.language === "ar"
        ? "Transcribe ONLY the exact Arabic Quranic words spoken in this audio. Output plain Arabic text with no commentary, no translation, and no punctuation."
        : "Bu ses kaydındaki Türkçe konuşmayı yalnızca düz metin olarak yaz. Açıklama veya yorum ekleme.";

    for (const model of ["gemini-3.5-flash-lite", "gemini-flash-latest"] as const) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: cleanMime, data: base64Audio } },
                ],
              },
            ],
            generationConfig: { temperature: 0 },
          }),
        });

        if (!res.ok) continue;

        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text =
          json.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join(" ")
            .trim() ?? "";

        return {
          status: "completed",
          provider: "gemini_audio",
          transcript: text,
        };
      } catch {
        continue;
      }
    }

    return {
      status: "error",
      provider: "gemini_audio",
      transcript: "",
      errorTr: "Gemini ses çözümleme isteği başarısız oldu.",
    };
  }

  return {
    status: "client_fallback",
    provider: "none",
    transcript: "",
  };
}
