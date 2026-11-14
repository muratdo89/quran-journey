import { describe, expect, it } from "vitest";
import {
  getAllFatihaWords,
  getAllVerifiedWords,
  getAvailablePages,
  getAvailableSurahs,
  getCanonicalCollection,
  getContentManifest,
  getFatihaDataset,
  getMushafPageData,
  getWordByLocation,
  getWordsByRoot,
  verifyVerseSha256,
} from "@/lib/content/canonical-loader";

describe("Canonical Quran Content Integrity (Surah Al-Fatiha & Juz Amma)", () => {
  const fatiha = getFatihaDataset();
  const collection = getCanonicalCollection();
  const manifest = getContentManifest();

  it("matches exact Surah Al-Fatiha metadata and Madinah Mushaf page 1", () => {
    expect(fatiha.surah.id).toBe(1);
    expect(fatiha.surah.versesCount).toBe(7);
    expect(fatiha.surah.pages).toEqual([1, 1]);
    expect(fatiha.verses).toHaveLength(7);
    expect(getAllFatihaWords()).toHaveLength(29);
  });

  it("contains all 38 Surahs (Fatiha + Juz Amma 78..114) and 24 Madinah Mushaf pages", () => {
    const surahs = getAvailableSurahs();
    const pages = getAvailablePages();

    expect(collection.surahs).toHaveLength(38);
    expect(surahs.map((s) => s.id)).toEqual([1, ...Array.from({ length: 37 }, (_, i) => 78 + i)]);
    expect(pages).toEqual([1, ...Array.from({ length: 23 }, (_, i) => 582 + i)]);
    expect(getAllVerifiedWords()).toHaveLength(2337);
  });

  it("verifies SHA-256 checksums, translations, and sequential word audio across all 571 verses", () => {
    let totalVerses = 0;
    let totalWords = 0;
    const validPages = new Set(getAvailablePages());

    for (const entry of collection.surahs) {
      expect(entry.verses).toHaveLength(entry.surah.versesCount);

      for (const verse of entry.verses) {
        totalVerses += 1;
        expect(verifyVerseSha256(verse)).toBe(true);
        expect(validPages.has(verse.pageNumber)).toBe(true);
        expect(verse.textUthmani.trim().length).toBeGreaterThan(2);
        expect(verse.textUthmaniTanzil.trim().length).toBeGreaterThan(2);

        const resourceIds = verse.translations.map((t) => t.resourceId);
        expect(resourceIds).toContain(77);
        expect(resourceIds).toContain(52);
        for (const tr of verse.translations) {
          expect(tr.text.trim().length).toBeGreaterThan(2);
        }

        expect(verse.audio.alafasyAyahUrl).toMatch(/^https:\/\//);
        expect(verse.audio.husaryMuallimAyahUrl).toMatch(/^https:\/\//);

        verse.words.forEach((word, idx) => {
          totalWords += 1;
          expect(word.position).toBe(idx + 1);
          expect(word.location).toBe(`${entry.surah.id}:${verse.verseNumber}:${idx + 1}`);
          expect(word.translationTr.trim().length).toBeGreaterThan(0);
          expect(word.audioUrl).toMatch(/^https:\/\/audio\.qurancdn\.com\/wbw\/.+\.mp3$/);
        });
      }
    }

    expect(totalVerses).toBe(571);
    expect(totalWords).toBe(2337);
  });

  it("renders multi-surah Mushaf pages accurately and supports root lookup across the collection", () => {
    const page604 = getMushafPageData(604);
    expect(page604.pageNumber).toBe(604);
    expect(page604.sections.map((s) => s.surah.id)).toEqual([112, 113, 114]);
    expect(page604.sections.every((s) => s.startsOnThisPage)).toBe(true);

    const nabaStart = getMushafPageData(582);
    expect(nabaStart.sections.some((s) => s.surah.id === 78)).toBe(true);

    const rahmanWord = getWordByLocation("1:1:3");
    const root = rahmanWord?.morphology.rootArabic;
    expect(root).toBeTruthy();
    const rootMatches = getWordsByRoot(root!);
    expect(rootMatches.length).toBeGreaterThanOrEqual(4);
    expect(new Set(rootMatches.map((m) => m.surahId)).size).toBeGreaterThanOrEqual(2);
  });

  it("documents all external sources and both canonical datasets in manifest.json", () => {
    const ids = manifest.sources.map((s) => s.id);
    expect(ids).toContain("tanzil-uthmani");
    expect(ids).toContain("quran-com-api-v4");
    expect(ids).toContain("quran-arabic-corpus-morphology");
    expect(manifest.datasets["surah-1-fatiha"]?.versesCount).toBe(7);
    expect(manifest.datasets["fatiha-and-juz-amma"]?.surahsCount).toBe(38);
    expect(manifest.datasets["fatiha-and-juz-amma"]?.pagesCount).toBe(24);
    expect(manifest.datasets["fatiha-and-juz-amma"]?.versesCount).toBe(571);
    expect(manifest.datasets["fatiha-and-juz-amma"]?.wordsCount).toBe(2337);
  });
});
