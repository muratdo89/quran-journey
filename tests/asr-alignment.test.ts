import { describe, expect, it, vi } from "vitest";
import {
  ConfigurableHttpAsrProvider,
  LocalComparisonOnlyProvider,
} from "@/lib/audio/assessment-provider";
import {
  alignAsrTranscript,
  normalizeArabicForAlignment,
} from "@/lib/audio/sequence-aligner";
import { createInitialCardRecord } from "@/lib/learning-engine";
import {
  buildErrorPatternInsights,
  buildJuzProgressGrid,
} from "@/lib/learning-engine/analytics";

describe("Quranic Arabic Sequence Alignment & ASR Honesty Guarantees", () => {
  it("normalizes Uthmani diacritics and alef variants cleanly", () => {
    const raw = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ";
    const norm = normalizeArabicForAlignment(raw);
    expect(norm).toBe("بسم الله الرحمن");
  });

  it("identifies exact match, missing words, and substitutions while always requiring human review", () => {
    const exact = alignAsrTranscript(
      "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
      "بسم الله الرحمن الرحيم",
      "1:1"
    );
    expect(exact.wordMatchRatio).toBe(1);
    expect(exact.matchedCount).toBe(4);
    expect(exact.findings.some((f) => f.kind === "expert_verification_needed")).toBe(true);

    const missingWord = alignAsrTranscript(
      "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
      "بسم الله الرحيم",
      "1:1"
    );
    expect(missingWord.wordMatchRatio).toBe(0.75);
    expect(missingWord.findings.some((f) => f.kind === "possible_missing_word")).toBe(true);

    const subWord = alignAsrTranscript(
      "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ",
      "الحمد لله مالك العالمين",
      "1:2"
    );
    expect(subWord.matchedCount).toBe(3);
    expect(subWord.findings.some((f) => f.kind === "possible_word_substitution")).toBe(true);
    expect(subWord.findings.some((f) => f.kind === "expert_verification_needed")).toBe(true);
  });

  it("blocks external ASR upload when explicit consentGranted is false", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = new ConfigurableHttpAsrProvider("https://asr.example.test/v1/transcribe", "secret");

    const res = await provider.evaluate({
      verseKey: "1:1",
      expectedArabicText: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
      audioMimeType: "audio/webm",
      durationMs: 3200,
      consentGranted: false,
      audioBytes: new Uint8Array([1, 2, 3]),
    });

    expect(res.status).toBe("consent_required");
    expect(res.requiresHumanReview).toBe(true);
    expect(res.confidenceScore).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns unavailable when ASR endpoint URL or audio payload is absent", async () => {
    const noUrlProvider = new ConfigurableHttpAsrProvider("", undefined);
    const noAudioRes = await noUrlProvider.evaluate({
      verseKey: "1:1",
      expectedArabicText: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
      audioMimeType: "audio/webm",
      durationMs: 3000,
      consentGranted: true,
    });
    expect(noAudioRes.status).toBe("unavailable");
    expect(noAudioRes.requiresHumanReview).toBe(true);

    const localOnly = new LocalComparisonOnlyProvider();
    const localRes = await localOnly.evaluate({
      verseKey: "1:1",
      expectedArabicText: "بِسْمِ ٱللَّهِ",
      audioMimeType: "audio/webm",
      durationMs: 2500,
      consentGranted: true,
    });
    expect(localRes.status).toBe("unavailable");
    expect(localRes.requiresHumanReview).toBe(true);
  });

  it("aligns transcript from mocked HTTP ASR provider while marking human Tajweed review mandatory", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ text: "الحمد لله رب العالمين" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const provider = new ConfigurableHttpAsrProvider("https://asr.example.test/v1/transcribe", "test-key");
    const res = await provider.evaluate({
      verseKey: "1:2",
      expectedArabicText: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ",
      audioMimeType: "audio/webm",
      durationMs: 3800,
      consentGranted: true,
      audioBytes: new Uint8Array([10, 20, 30]),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe("completed");
    expect(res.scope).toBe("sequence_check");
    expect(res.confidenceScore).toBe(1);
    expect(res.requiresHumanReview).toBe(true);
    expect(res.summaryTr).toContain("tecvid kalitesini ölçmez");
    mockFetch.mockRestore();
  });
});

describe("Longitudinal Error-Pattern & 30-Juz Analytics", () => {
  it("categorizes missed roots, lapsed FSRS cards, and decayed Hifz verses accurately", () => {
    const lapsedCard = {
      ...createInitialCardRecord("c1", "vocabulary", "1:1:3", "ar_to_tr"),
      lapses: 2,
    };

    const report = buildErrorPatternInsights({
      cards: [lapsedCard],
      wordMistakes: [
        {
          wordLocation: "1:1:3",
          arabic: "ٱلرَّحْمَـٰنِ",
          meaningTr: "Rahman",
          rootArabic: "رحم",
          partOfSpeech: "N",
          timesMissed: 3,
        },
        {
          wordLocation: "1:1:4",
          arabic: "ٱلرَّحِيمِ",
          meaningTr: "Rahim",
          rootArabic: "رحم",
          partOfSpeech: "N",
          timesMissed: 2,
        },
      ],
      verseStates: [{ verseKey: "1:7", memorizationState: "needs_revision" }],
      completedReadingModuleIds: ["m1", "m2"],
      totalReadingModules: 8,
      practicedTajweedSlugs: ["med"],
      totalTajweedLessons: 8,
    });

    expect(report.lapsedCardsCount).toBe(1);
    expect(report.revisionVersesCount).toBe(1);
    expect(report.topMissedRoots[0]?.rootArabic).toBe("رحم");
    expect(report.topMissedRoots[0]?.missedCount).toBe(5);
    expect(report.insights.map((i) => i.id)).toContain("hifz-decay");
    expect(report.insights.map((i) => i.id)).toContain("fsrs-lapses");
    expect(report.insights.map((i) => i.id)).toContain("root-weakness");
  });

  it("maps all 604 Madinah Mushaf pages cleanly into 30 Juz buckets", () => {
    const grid = buildJuzProgressGrid([
      { pageNumber: 1, status: "completed" },
      { pageNumber: 2, status: "in_progress" },
      { pageNumber: 604, status: "completed" },
    ]);

    expect(grid).toHaveLength(30);
    expect(grid[0]?.totalPages).toBe(21);
    expect(grid[0]?.studiedPages).toBe(2);
    expect(grid[0]?.completedPages).toBe(1);
    expect(grid[29]?.totalPages).toBe(23); // Juz 30: pages 582..604
    expect(grid[29]?.completedPages).toBe(1);
    const totalGridPages = grid.reduce((acc, g) => acc + g.totalPages, 0);
    expect(totalGridPages).toBe(604);
  });
});
