import { describe, expect, it } from "vitest";
import { TAJWEED_LEGEND, analyzeWordTajweed } from "../src/lib/content/tajweed-analyzer";
import {
  buildRangePlaybackQueue,
  normalizeRangeLoopConfig,
} from "../src/lib/audio/range-loop-player";
import { HybridQuranAsrProvider } from "../src/lib/audio/assessment-provider";

describe("Phase 7A — Colored Tajweed Analyzer", () => {
  it("exposes 5 standardized Tajweed legend categories", () => {
    expect(TAJWEED_LEGEND).toHaveLength(5);
    expect(TAJWEED_LEGEND.map((item) => item.category)).toEqual([
      "qalqalah",
      "ghunnah",
      "madd",
      "noon_meem_sakin",
      "tafkhim",
    ]);
  });

  it("detects Qalqalah, Madd, Noon/Meem Sakin, Tafkhim, and Ghunnah on Uthmani words", () => {
    expect(analyzeWordTajweed("بِسْمِ")).toEqual([]);

    const razaqnahum = analyzeWordTajweed("رَزَقْنَـٰهُمْ").map((r) => r.category);
    expect(razaqnahum).toContain("qalqalah");
    expect(razaqnahum).toContain("madd");
    expect(razaqnahum).toContain("noon_meem_sakin");
    expect(razaqnahum).toContain("tafkhim");

    const mimma = analyzeWordTajweed("وَمِمَّا").map((r) => r.category);
    expect(mimma).toContain("ghunnah");

    const yunfiquna = analyzeWordTajweed("يُنفِقُونَ").map((r) => r.category);
    expect(yunfiquna).toContain("noon_meem_sakin");
    expect(yunfiquna).toContain("tafkhim");

    const maghdub = analyzeWordTajweed("مَغْضُوبِ").map((r) => r.category);
    expect(maghdub).toContain("tafkhim");

    const maddWord = analyzeWordTajweed("ٱلضَّا\u0653لِّينَ").map((r) => r.category);
    expect(maddWord).toContain("madd");
    expect(maddWord).toContain("tafkhim");
  });
});

describe("Phase 7B — Verse Range Loop Player", () => {
  it("normalizes swapped and out-of-bounds range loop configurations", () => {
    const normalized = normalizeRangeLoopConfig(
      {
        startVerseNumber: 12,
        endVerseNumber: 2,
        verseRepeatCount: 0,
        rangeRepeatCount: 25,
      },
      1,
      7
    );

    expect(normalized).toEqual({
      startVerseNumber: 2,
      endVerseNumber: 7,
      verseRepeatCount: 1,
      rangeRepeatCount: 10,
    });
  });

  it("builds deterministic ordered playback steps for verse and range repeats", () => {
    const verses = [
      { verseKey: "1:1", verseNumber: 1 },
      { verseKey: "1:2", verseNumber: 2 },
      { verseKey: "1:3", verseNumber: 3 },
      { verseKey: "1:4", verseNumber: 4 },
    ];

    const queue = buildRangePlaybackQueue(verses, {
      startVerseNumber: 2,
      endVerseNumber: 3,
      verseRepeatCount: 2,
      rangeRepeatCount: 2,
    });

    // 2 verses * 2 verse repeats * 2 range rounds = 8 total steps
    expect(queue).toHaveLength(8);
    expect(queue[0]).toEqual({
      verseKey: "1:2",
      verseNumber: 2,
      verseRepeatIndex: 1,
      verseRepeatTotal: 2,
      rangeRoundIndex: 1,
      rangeRoundTotal: 2,
      stepIndex: 0,
      totalSteps: 8,
    });
    expect(queue[1].verseKey).toBe("1:2");
    expect(queue[1].verseRepeatIndex).toBe(2);
    expect(queue[2].verseKey).toBe("1:3");
    expect(queue[4]).toEqual({
      verseKey: "1:2",
      verseNumber: 2,
      verseRepeatIndex: 1,
      verseRepeatTotal: 2,
      rangeRoundIndex: 2,
      rangeRoundTotal: 2,
      stepIndex: 4,
      totalSteps: 8,
    });
    expect(queue[7].stepIndex).toBe(7);
    expect(queue[7].totalSteps).toBe(8);
    expect(queue[7].verseKey).toBe("1:3");
  });
});

describe("Phase 7C — Hybrid Quran ASR Provider", () => {
  it("requires explicit consent before running any alignment", async () => {
    const provider = new HybridQuranAsrProvider();
    const result = await provider.evaluate({
      verseKey: "1:1",
      expectedArabicText: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
      audioMimeType: "audio/webm",
      durationMs: 3200,
      consentGranted: false,
      clientTranscript: "بسم الله الرحمن الرحيم",
    });

    expect(result.status).toBe("consent_required");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.confidenceScore).toBeNull();
  });

  it("aligns browser Web Speech or manual Arabic transcript when external HTTP ASR URL is unset", async () => {
    const provider = new HybridQuranAsrProvider();
    const result = await provider.evaluate({
      verseKey: "1:1",
      expectedArabicText: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
      audioMimeType: "audio/webm",
      durationMs: 3200,
      consentGranted: true,
      clientTranscript: "بسم الله الرحمن الرحيم",
    });

    expect(result.providerName).toBe("hybrid-quran-asr");
    expect(result.scope).toBe("sequence_check");
    expect(result.status).toBe("completed");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.8);
    expect(result.recognizedText).toBe("بسم الله الرحمن الرحيم");
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("returns unavailable with requiresHumanReview when both HTTP ASR URL and transcript are absent", async () => {
    const provider = new HybridQuranAsrProvider();
    const result = await provider.evaluate({
      verseKey: "1:1",
      expectedArabicText: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
      audioMimeType: "audio/webm",
      durationMs: 3200,
      consentGranted: true,
    });

    expect(result.status).toBe("unavailable");
    expect(result.requiresHumanReview).toBe(true);
  });
});
