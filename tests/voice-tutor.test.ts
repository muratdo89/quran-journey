import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SqliteProgressRepository } from "@/lib/db/sqlite-repository";
import { transcribeTutorAudio } from "@/lib/tutor/audio-transcribe";
import { orchestrateTutorTurn } from "@/lib/tutor/gemini-orchestrator";
import { pcm16ToWavBase64, synthesizeTurkishTeacherAudio } from "@/lib/tutor/gemini-tts";
import {
  checkVocabularyAnswerMatch,
  evaluateCanonicalRecitation,
} from "@/lib/tutor/tools";
import { createInitialTutorSessionState } from "@/lib/tutor/types";

const tempDirs: string[] = [];

function createTempRepo(): SqliteProgressRepository {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qj-tutor-test-"));
  tempDirs.push(dir);
  return new SqliteProgressRepository(path.join(dir, "test.db"));
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
});

describe("AI Voice Teacher — Canonical Grounding, Patient Coaching & Recitation Checks", () => {
  it("matches Turkish vocabulary answers flexibly while rejecting unrelated answers", () => {
    expect(checkVocabularyAnswerMatch("Rahman olan", "Rahmân")).toBe(true);
    expect(checkVocabularyAnswerMatch("hamd övgü", "Hamd")).toBe(true);
    expect(checkVocabularyAnswerMatch("güneş", "Rahmân")).toBe(false);
  });

  it("evaluates Arabic Quran recitation sequence and always sets requiresHumanReview=true", () => {
    const clean = evaluateCanonicalRecitation("1:1", "بسم الله الرحمن الرحيم");
    expect(clean).not.toBeNull();
    expect(clean!.wordMatchRatio).toBe(1);
    expect(clean!.requiresHumanReview).toBe(true);
    expect(clean!.missedWords).toHaveLength(0);

    const partial = evaluateCanonicalRecitation("1:1", "بسم الله الرحيم");
    expect(partial!.wordMatchRatio).toBe(0.75);
    expect(partial!.missedWords.length).toBeGreaterThanOrEqual(1);
    expect(partial!.requiresHumanReview).toBe(true);
  });

  it("runs a full hands-free guided session (welcome -> 5-min short vocab -> patient hint -> hifz recite)", async () => {
    const repo = createTempRepo();
    const initialSnap = await repo.getDashboardSnapshot();

    // 1. Welcome turn
    const t1 = await orchestrateTutorTurn({
      request: {
        action: "start",
        sessionState: createInitialTutorSessionState(initialSnap.profile.currentPageNumber),
      },
      snapshot: initialSnap,
      repo,
    });
    expect(t1.phase).toBe("welcome");
    expect(t1.stageCard?.kind).toBe("brief");
    expect(t1.expectingLanguage).toBe("tr");
    expect(t1.providerMode).toBe("local_guided");

    // 2. Learner asks for 5-minute short session -> enters vocabulary quiz with verified word audio
    const t2 = await orchestrateTutorTurn({
      request: {
        action: "user_speech",
        userText: "5 dakika hızlı tekrar yapalım",
        sessionState: t1.sessionState,
      },
      snapshot: await repo.getDashboardSnapshot(),
      repo,
    });
    expect(t2.phase).toBe("vocabulary");
    expect(t2.sessionState.pace).toBe("short");
    expect(t2.stageCard?.kind).toBe("vocabulary_quiz");
    expect(t2.audioCue?.kind).toBe("word");

    // 3. Learner misses on 1st attempt -> patient teacher gives hint & replays (attemptCount=1)
    const t3 = await orchestrateTutorTurn({
      request: {
        action: "user_speech",
        userText: "alakasız bir cevap",
        sessionState: t2.sessionState,
      },
      snapshot: await repo.getDashboardSnapshot(),
      repo,
    });
    expect(t3.phase).toBe("vocabulary");
    expect(t3.sessionState.attemptCount).toBe(1);
    expect(t3.replyTr.toLocaleLowerCase("tr-TR")).toContain("ipucu");

    // 4. Learner jumps directly to Hifz
    const t4 = await orchestrateTutorTurn({
      request: {
        action: "user_speech",
        userText: "ezbere geç",
        sessionState: t3.sessionState,
      },
      snapshot: await repo.getDashboardSnapshot(),
      repo,
    });
    expect(t4.phase).toBe("hifz_listen");
    expect(t4.stageCard?.kind).toBe("verse_study");
    expect(t4.audioCue?.kind).toBe("ayah");

    // 5. Learner says ready -> hides Arabic text & expects Arabic recitation
    const t5 = await orchestrateTutorTurn({
      request: {
        action: "user_speech",
        userText: "okumaya hazırım",
        sessionState: t4.sessionState,
      },
      snapshot: await repo.getDashboardSnapshot(),
      repo,
    });
    expect(t5.phase).toBe("hifz_recite");
    expect(t5.expectingLanguage).toBe("ar");
    expect(t5.stageCard?.kind === "verse_study" && t5.stageCard.hideArabicText).toBe(true);

    // 6. Learner recites Fatiha 1:1 cleanly -> saved in SQLite & requiresHumanReview=true
    const t6 = await orchestrateTutorTurn({
      request: {
        action: "recitation_result",
        recitationTranscript: "بسم الله الرحمن الرحيم",
        sessionState: t5.sessionState,
      },
      snapshot: await repo.getDashboardSnapshot(),
      repo,
    });
    expect(t6.recitationCheck?.wordMatchRatio).toBe(1);
    expect(t6.recitationCheck?.requiresHumanReview).toBe(true);

    const afterSnap = await repo.getDashboardSnapshot();
    const v1 = afterSnap.verseProgress.find((v) => v.verseKey === "1:1");
    expect(v1?.memorizationState).toBe("learning");
    repo.close();
  });

  it("enhances replies with Gemini 2.5 Flash when GEMINI_API_KEY is configured", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "Selamün aleyküm, bugün Fatiha ile kısa ve sakin bir ders yapalım. Normal mi yoksa 5 dakika mı tercih edersin?",
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const repo = createTempRepo();
    const res = await orchestrateTutorTurn({
      request: {
        action: "start",
        sessionState: createInitialTutorSessionState(1),
      },
      snapshot: await repo.getDashboardSnapshot(),
      repo,
    });

    expect(res.providerMode).toBe("gemini");
    expect(res.replyTr).toContain("Fatiha");
    repo.close();
  });

  it("uses Groq Whisper when GROQ_API_KEY is set and falls back to client when unconfigured", async () => {
    const noKey = await transcribeTutorAudio({
      audioBytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/webm",
      language: "ar",
    });
    expect(noKey.status).toBe("client_fallback");

    process.env.GROQ_API_KEY = "test-groq-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ text: "بسم الله الرحمن الرحيم" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const withGroq = await transcribeTutorAudio({
      audioBytes: new Uint8Array([10, 20, 30]),
      mimeType: "audio/webm",
      language: "ar",
      expectedArabicPrompt: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
    });
    expect(withGroq.status).toBe("completed");
    expect(withGroq.provider).toBe("groq_whisper");
    expect(withGroq.transcript).toBe("بسم الله الرحمن الرحيم");
  });

  it("wraps 24kHz PCM16 audio into a valid RIFF/WAV data URL via Gemini TTS", async () => {
    const samplePcm = Buffer.alloc(16, 0).toString("base64");
    const wavB64 = pcm16ToWavBase64(samplePcm, 24000);
    const wavBuf = Buffer.from(wavB64, "base64");
    expect(wavBuf.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wavBuf.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(wavBuf.readUInt32LE(24)).toBe(24000);
    expect(wavBuf.length).toBe(44 + 16);

    process.env.GEMINI_API_KEY = "AIza-test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "audio/L16;codec=pcm;rate=24000",
                      data: samplePcm,
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const tts = await synthesizeTurkishTeacherAudio("Selamün aleyküm, hoş geldin.");
    expect(tts.audioDataUrl).toMatch(/^data:audio\/wav;base64,/);
    expect(tts.model).toBe("gemini-2.5-flash-preview-tts");
  });

  it("surfaces a clear Turkish diagnostic when an AQ. Vertex key is rejected by Gemini AI Studio", async () => {
    process.env.GEMINI_API_KEY = "AQ.test-vertex-format-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 })
    );

    const repo = createTempRepo();
    const res = await orchestrateTutorTurn({
      request: {
        action: "start",
        sessionState: createInitialTutorSessionState(1),
      },
      snapshot: await repo.getDashboardSnapshot(),
      repo,
    });

    expect(res.providerMode).toBe("local_guided");
    expect(res.providerDiagnosticTr).toContain("AIza...");
    repo.close();
  });
});

