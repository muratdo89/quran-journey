import { describe, expect, it } from "vitest";
import {
  getAllFatihaWords,
  getAvailablePages,
  getAvailableSurahs,
  getContentManifest,
  getFatihaDataset,
  getLexiconIndex,
  getMushafPageData,
  getMutashabihatForVerse,
  getQuranMeta,
  getQuranTotals,
  getSurahEntry,
  getTopRoots,
  getWordByLocation,
  getWordsByRoot,
  getWordsPage,
  searchQuranVerses,
  verifyVerseSha256,
} from "@/lib/content/canonical-loader";

describe("Canonical Quran Content Integrity (Full 604-Page / 114-Surah Corpus)", () => {
  const fatiha = getFatihaDataset();
  const quranMeta = getQuranMeta();
  const totals = getQuranTotals();
  const manifest = getContentManifest();

  it("matches exact Surah Al-Fatiha metadata and Madinah Mushaf page 1", () => {
    expect(fatiha.surah.id).toBe(1);
    expect(fatiha.surah.versesCount).toBe(7);
    expect(fatiha.surah.pages).toEqual([1, 1]);
    expect(fatiha.verses).toHaveLength(7);
    expect(getAllFatihaWords()).toHaveLength(29);
  });

  it("covers all 114 Surahs, 604 Madinah Mushaf pages, 6,236 verses, and 77,429 words", () => {
    const surahs = getAvailableSurahs();
    const pages = getAvailablePages();

    expect(totals.totalSurahs).toBe(114);
    expect(totals.totalPages).toBe(604);
    expect(totals.totalVerses).toBe(6236);
    expect(totals.totalWords).toBe(77429);
    expect(surahs.map((s) => s.id)).toEqual(Array.from({ length: 114 }, (_, i) => i + 1));
    expect(pages).toEqual(Array.from({ length: 604 }, (_, i) => i + 1));
    expect(Object.keys(quranMeta.pageSurahs)).toHaveLength(604);
    expect(Object.keys(quranMeta.pageJuzHizb)).toHaveLength(604);
  });

  it("verifies SHA-256 checksums, translations, audio URLs, and word locations across all 6,236 verses", () => {
    let totalVerses = 0;
    let totalWords = 0;
    const seenPages = new Set<number>();
    const missingAudioLocations: string[] = [];

    for (let surahId = 1; surahId <= 114; surahId += 1) {
      const entry = getSurahEntry(surahId);
      expect(entry, `Missing compressed surah ${surahId}`).toBeDefined();
      expect(entry!.verses).toHaveLength(entry!.surah.versesCount);

      for (const verse of entry!.verses) {
        totalVerses += 1;
        expect(verifyVerseSha256(verse)).toBe(true);
        expect(verse.pageNumber).toBeGreaterThanOrEqual(1);
        expect(verse.pageNumber).toBeLessThanOrEqual(604);
        seenPages.add(verse.pageNumber);
        expect(verse.textUthmani.trim().length).toBeGreaterThan(0);
        expect(verse.textUthmaniTanzil.trim().length).toBeGreaterThan(0);

        const resourceIds = verse.translations.map((t) => t.resourceId);
        expect(resourceIds).toContain(77);
        expect(resourceIds).toContain(52);
        for (const tr of verse.translations) {
          expect(tr.text.trim().length).toBeGreaterThan(0);
        }

        expect(verse.audio.alafasyAyahUrl).toMatch(/^https:\/\//);
        expect(verse.audio.husaryMuallimAyahUrl).toMatch(/^https:\/\//);

        verse.words.forEach((word, idx) => {
          totalWords += 1;
          expect(word.position).toBe(idx + 1);
          expect(word.location).toBe(`${surahId}:${verse.verseNumber}:${idx + 1}`);
          expect(word.translationTr.trim().length).toBeGreaterThan(0);
          if (word.audioUrl === null) {
            missingAudioLocations.push(word.location);
          } else {
            expect(word.audioUrl).toMatch(/^https:\/\/audio\.qurancdn\.com\/wbw\/.+\.mp3$/);
          }
        });
      }
    }

    expect(seenPages.size).toBe(604);
    expect(totalVerses).toBe(6236);
    expect(totalWords).toBe(77429);
    // Known upstream Quran.com WBW exception at Yasin 36:52:7 (Saktah pause token)
    expect(missingAudioLocations).toEqual(["36:52:7"]);
  });

  it("renders single-surah and multi-surah Mushaf pages accurately across all 604 pages", () => {
    const page2 = getMushafPageData(2);
    expect(page2.pageNumber).toBe(2);
    expect(page2.sections[0]?.surah.id).toBe(2);
    expect(page2.sections[0]?.startsOnThisPage).toBe(true);

    const page582 = getMushafPageData(582);
    expect(page582.sections.some((s) => s.surah.id === 78)).toBe(true);

    const page604 = getMushafPageData(604);
    expect(page604.pageNumber).toBe(604);
    expect(page604.sections.map((s) => s.surah.id)).toEqual([112, 113, 114]);
    expect(page604.sections.every((s) => s.startsOnThisPage)).toBe(true);
  });

  it("supports normalized Arabic & Turkish search, 1,651 root families, mutashabihat, and word pagination", () => {
    const arSearch = searchQuranVerses({ query: "الحمد لله رب" });
    expect(arSearch.totalMatches).toBeGreaterThanOrEqual(1);
    expect(arSearch.results.some((r) => r.verseKey === "1:2")).toBe(true);

    const trSearch = searchQuranVerses({ query: "rahmet", scope: "turkish" });
    expect(trSearch.totalMatches).toBeGreaterThanOrEqual(10);

    const roots = getTopRoots({ page: 1, pageSize: 20 });
    expect(roots.total).toBe(1651);
    expect(roots.items[0]?.count).toBeGreaterThan(roots.items[19]!.count);

    const rahmanWord = getWordByLocation("1:1:3");
    const root = rahmanWord?.morphology.rootArabic;
    expect(root).toBeTruthy();
    const rootMatches = getWordsByRoot(root!);
    expect(rootMatches.length).toBeGreaterThan(50);

    const lexIndex = getLexiconIndex();
    expect(Object.keys(lexIndex.mutashabihat).length).toBeGreaterThanOrEqual(1000);
    expect(getMutashabihatForVerse("55:13").length).toBeGreaterThan(0);
    expect(getMutashabihatForVerse("1:1").length).toBeGreaterThan(0);

    const globalWordsPage = getWordsPage({ page: 1, pageSize: 24 });
    expect(globalWordsPage.total).toBe(77429);
    expect(globalWordsPage.items).toHaveLength(24);

    const baqarahWordsPage = getWordsPage({ surahId: 2, page: 1, pageSize: 24 });
    expect(baqarahWordsPage.total).toBeGreaterThan(5000);
    expect(baqarahWordsPage.items[0]?.surahId).toBe(2);
  });

  it("documents all external sources and full-Quran manifest datasets cleanly", () => {
    const ids = manifest.sources.map((s) => s.id);
    expect(ids).toContain("tanzil-uthmani");
    expect(ids).toContain("quran-com-api-v4");
    expect(ids).toContain("quran-arabic-corpus-morphology");
    expect(manifest.datasets["surah-1-fatiha"]?.versesCount).toBe(7);
    expect(manifest.datasets["quran-meta"]?.surahsCount).toBe(114);
    expect(manifest.datasets["quran-meta"]?.pagesCount).toBe(604);
    expect(manifest.datasets["quran-meta"]?.versesCount).toBe(6236);
    expect(manifest.datasets["quran-meta"]?.wordsCount).toBe(77429);
    expect(manifest.datasets["lexicon-index"]?.rootsCount).toBe(1651);
    expect(Object.keys(manifest.surahChecksums ?? {})).toHaveLength(114);
  });
});

