/**
 * Natural human-like Turkish voice synthesis via Google Gemini TTS REST API.
 * Uses the same GEMINI_API_KEY (zero extra accounts needed).
 * Strictly used for Turkish teacher coaching — NEVER for Arabic Quran verses or words.
 */

const GEMINI_TTS_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
] as const;

export function parseSampleRate(mimeType: string): number {
  const match = /rate=(\d+)/i.exec(mimeType);
  if (match) {
    const rate = Number(match[1]);
    if (Number.isFinite(rate) && rate >= 8000 && rate <= 48000) return rate;
  }
  return 24000;
}

/**
 * Wraps raw signed 16-bit little-endian mono PCM (audio/L16) in a standard 44-byte RIFF/WAV
 * header so every desktop browser and iOS Safari <audio> element can play it natively.
 */
export function pcm16ToWavBase64(pcmBase64: string, sampleRate = 24000): string {
  const pcm = Buffer.from(pcmBase64, "base64");
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // Linear PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]).toString("base64");
}

export interface GeminiTtsResult {
  audioDataUrl: string | null;
  model: string | null;
  errorTr?: string;
}

export async function synthesizeTurkishTeacherAudio(
  textTr: string,
  voiceName = "Orus"
): Promise<GeminiTtsResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !textTr.trim()) {
    return { audioDataUrl: null, model: null };
  }

  let lastError = "Gemini ses sentezi yanıt vermedi.";

  for (const model of GEMINI_TTS_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: textTr.trim() }],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
        }),
      });

      if (!res.ok) {
        lastError = `Gemini TTS (${model}) HTTP ${res.status}`;
        continue;
      }

      const json = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: { mimeType?: string; data?: string };
            }>;
          };
        }>;
      };

      const inline = json.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.data
      )?.inlineData;

      if (!inline?.data) {
        lastError = `Gemini TTS (${model}) ses verisi döndürmedi.`;
        continue;
      }

      const mime = (inline.mimeType ?? "audio/L16;codec=pcm;rate=24000").toLowerCase();
      if (mime.includes("wav") || mime.includes("mpeg") || mime.includes("mp3") || mime.includes("ogg")) {
        return {
          audioDataUrl: `data:${mime.split(";")[0]};base64,${inline.data}`,
          model,
        };
      }

      const sampleRate = parseSampleRate(mime);
      const wavBase64 = pcm16ToWavBase64(inline.data, sampleRate);
      return {
        audioDataUrl: `data:audio/wav;base64,${wavBase64}`,
        model,
      };
    } catch {
      lastError = `Gemini TTS (${model}) bağlantı hatası.`;
    }
  }

  return { audioDataUrl: null, model: null, errorTr: lastError };
}
