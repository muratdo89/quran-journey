import { describe, expect, it } from "vitest";
import {
  TAJWEED_LEGEND,
  analyzeVerseTajweed,
  analyzeWordTajweed,
  type TajweedRuleId,
} from "../src/lib/content/tajweed-analyzer";
import { getSurahEntry, getVerseByKey } from "../src/lib/content/canonical-loader";
import {
  buildRangePlaybackQueue,
  normalizeRangeLoopConfig,
} from "../src/lib/audio/range-loop-player";
import { HybridQuranAsrProvider } from "../src/lib/audio/assessment-provider";

/** Rule ids per word of a canonical verse, e.g. rulesOf("2:3")[3]. */
function rulesOf(verseKey: string): TajweedRuleId[][] {
  const verse = getVerseByKey(verseKey)!;
  return analyzeVerseTajweed(verse.words.map((w) => w.textUthmani)).map((w) =>
    w.rules.map((r) => r.id)
  );
}

/** Letters of a word that carry a given rule. */
function lettersWith(verseKey: string, wordIndex: number, id: TajweedRuleId): string[] {
  const verse = getVerseByKey(verseKey)!;
  const analysis = analyzeVerseTajweed(verse.words.map((w) => w.textUthmani));
  return analysis[wordIndex]!.segments.filter((s) => s.ruleIds.includes(id)).map((s) => s.text);
}

describe("Phase 7A — Colored Tajweed Analyzer", () => {
  it("exposes 5 standardized Tajweed legend categories with light and dark colors", () => {
    expect(TAJWEED_LEGEND).toHaveLength(5);
    expect(TAJWEED_LEGEND.map((item) => item.category)).toEqual([
      "qalqalah",
      "ghunnah",
      "madd",
      "noon_meem_sakin",
      "tafkhim",
    ]);
    for (const item of TAJWEED_LEGEND) expect(item.colorHexDark).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps the original word text intact across letter segments", () => {
    const verse = getVerseByKey("2:2")!;
    const words = verse.words.map((w) => w.textUthmani);
    const analysis = analyzeVerseTajweed(words);
    analysis.forEach((w, i) => expect(w.segments.map((s) => s.text).join("")).toBe(words[i]));
  });

  it("resolves sâkin nûn and tenvîn against the first letter of the next word", () => {
    // 2:2 هُدًۭى لِّلْمُتَّقِينَ → İdğâm-ı Bilâ Gunne
    expect(rulesOf("2:2")[5]).toContain("idgham_no_ghunnah");
    // 2:5 هُدًۭى مِّن → İdğâm-ı Meal Gunne, مِّن رَّبِّهِمْ → Bilâ Gunne
    expect(rulesOf("2:5")[2]).toContain("idgham_ghunnah");
    expect(rulesOf("2:5")[3]).toContain("idgham_no_ghunnah");
    // 2:4 مِن قَبْلِكَ → İhfâ (across words), أُنزِلَ → İhfâ (inside the word)
    expect(rulesOf("2:4")[7]).toContain("ikhfa");
    expect(lettersWith("2:4", 3, "ikhfa")).toEqual(["ن"]);
    // 2:10 أَلِيمٌۢ بِمَا → İklâb
    expect(rulesOf("2:10")[8]).toContain("iqlab");
    // 2:7 عَذَابٌ عَظِيمٌۭ → İzhâr (explained, not colored)
    const izhar = analyzeVerseTajweed(["عَذَابٌ", "عَظِيمٌۭ"])[0]!;
    expect(izhar.rules.find((r) => r.id === "izhar")?.highlighted).toBe(false);
    expect(izhar.segments.some((s) => s.category === "noon_meem_sakin")).toBe(false);
  });

  it("resolves sâkin mîm rules (İhfâ-i Şefevî, İdğâm-ı Misleyn, İzhâr-ı Şefevî)", () => {
    expect(rulesOf("2:8")[9]).toContain("ikhfa_shafawi"); // هُم بِمُؤْمِنِينَ
    expect(rulesOf("2:10")[1]).toContain("idgham_shafawi"); // قُلُوبِهِم مَّرَضٌۭ
    expect(rulesOf("1:7")[3]).toContain("izhar_shafawi"); // عَلَيْهِمْ غَيْرِ
  });

  it("does not apply tenvîn/nûn rules at the verse-end stop", () => {
    // 2:7 ends with عَظِيمٌۭ
    const end = rulesOf("2:7").at(-1)!;
    expect(end).not.toContain("izhar");
    expect(end).not.toContain("ikhfa");
    expect(end).not.toContain("idgham_ghunnah");
  });

  it("classifies madd types", () => {
    expect(rulesOf("1:7").at(-1)).toContain("madd_lazim"); // ٱلضَّآلِّينَ
    expect(rulesOf("2:6")[3]).toContain("madd_muttasil"); // سَوَآءٌ
    expect(rulesOf("2:4")[2]).toContain("madd_munfasil"); // بِمَآ أُنزِلَ
    expect(rulesOf("2:1")[0]).toContain("madd_lazim_harfi"); // الٓمٓ
    expect(rulesOf("1:1").at(-1)).toContain("madd_arid"); // ٱلرَّحِيمِ (stop)
    expect(rulesOf("106:1").at(-1)).toContain("madd_lin"); // قُرَيْشٍ (stop)
    // yâ-i nidâ written joined is munfasil, not muttasil
    expect(analyzeVerseTajweed(["يَـٰٓأَيُّهَا", "ٱلنَّاسُ"])[0]!.rules.map((r) => r.id)).toEqual([
      "madd_munfasil",
    ]);
  });

  it("applies Kalkale sügrâ inside words and kübrâ only at the verse-end stop", () => {
    expect(rulesOf("2:3")[6]).toContain("qalqalah_sughra"); // رَزَقْنَـٰهُمْ
    expect(rulesOf("112:1").at(-1)).toContain("qalqalah_kubra"); // أَحَدٌ (stop)
    // رَبِّ mid-verse is not a qalqalah (1:2 ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ)
    expect(rulesOf("1:2")[2]).not.toContain("qalqalah_kubra");
    // fathatan + alif at the stop is read as "â" (no qalqalah): سَدِيدًا
    expect(analyzeVerseTajweed(["قَوْلًۭا", "سَدِيدًۭا"])[1]!.rules.map((r) => r.id)).not.toContain(
      "qalqalah_kubra"
    );
  });

  it("colors ghunnah and heavy letters at letter level", () => {
    const ghunnah = lettersWith("2:3", 5, "ghunnah"); // وَمِمَّا
    expect(ghunnah).toHaveLength(1);
    expect(ghunnah[0]!.startsWith("م")).toBe(true);
    expect(ghunnah[0]).toContain("\u0651");
    expect(lettersWith("1:7", 5, "tafkhim").join("")).toContain("غ"); // ٱلْمَغْضُوبِ
  });

  it("keeps a category-level summary for single words with context", () => {
    expect(analyzeWordTajweed("بِسْمِ")).toEqual([]);
    expect(
      analyzeWordTajweed("مِن", { nextWord: "قَبْلِكَ" }).map((r) => r.category)
    ).toEqual(["noon_meem_sakin"]);
  });

  it("agrees with the Uthmani script's own nûn/tenvîn markings across the whole Quran", () => {
    // In this encoding a sükûn on nûn means İzhâr and a small mîm (U+06E2) means İklâb;
    // a tenvîn without the following U+06E2/U+06ED marker is İzhâr (or a stop).
    let checked = 0;
    for (let surahId = 1; surahId <= 114; surahId += 1) {
      for (const verse of getSurahEntry(surahId)!.verses) {
        const words = verse.words.map((w) => w.textUthmani);
        const analysis = analyzeVerseTajweed(words);
        analysis.forEach((word, wi) => {
          for (const seg of word.segments) {
            // only single-letter segments (one base letter + its marks)
            if (!/^[\u0621-\u064A\u0671][\u064B-\u065F\u0670\u06D6-\u06ED]*$/.test(seg.text)) continue;
            const noonRules = seg.ruleIds.filter((id) =>
              ["izhar", "idgham_ghunnah", "idgham_no_ghunnah", "ikhfa", "iqlab"].includes(id)
            );
            if (noonRules.length === 0) continue;
            checked += 1;
            const label = `${verse.verseKey} ${words[wi]}`;
            const hasTanwin = /[\u064B-\u064D]/.test(seg.text);
            if (!hasTanwin && seg.text.includes("\u06E2")) expect(noonRules, label).toEqual(["iqlab"]);
            if (!hasTanwin && seg.text.includes("\u0652")) expect(noonRules, label).toEqual(["izhar"]);
            if (hasTanwin) {
              const rest = words[wi]!.slice(words[wi]!.lastIndexOf(seg.text) + seg.text.length);
              const openTanwin =
                /[\u06E2\u06ED]/.test(seg.text) || /^[\u0627\u0649]?[\u06E2\u06ED]/.test(rest);
              if (!openTanwin) expect(noonRules, label).toEqual(["izhar"]);
              else expect(noonRules, label).not.toEqual(["izhar"]);
            }
          }
        });
      }
    }
    expect(checked).toBeGreaterThan(13000);
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
