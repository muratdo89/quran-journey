import crypto from "node:crypto";
import collectionJson from "@/data/canonical/fatiha-and-juz-amma.json";
import fatihaJson from "@/data/canonical/surah-1-fatiha.json";
import manifestJson from "@/data/manifest.json";
import type {
  CanonicalCollectionDataset,
  CanonicalSurahDataset,
  CanonicalSurahEntry,
  CanonicalSurahMeta,
  CanonicalVerse,
  CanonicalWord,
  ContentManifest,
  MushafPageData,
} from "./types";

const fatihaDataset = fatihaJson as unknown as CanonicalSurahDataset;
const collectionDataset = collectionJson as unknown as CanonicalCollectionDataset;
const contentManifest = manifestJson as unknown as ContentManifest;

export interface EnrichedWord extends CanonicalWord {
  surahId: number;
  surahNameTr: string;
  verseKey: string;
  verseTranslationTr: string;
}

// Precompute fast server-side indexes once per module load
const surahMap = new Map<number, CanonicalSurahEntry>();
const verseMap = new Map<string, CanonicalVerse>();
const wordMap = new Map<string, EnrichedWord>();
const allWordsList: EnrichedWord[] = [];
const pageMap = new Map<number, MushafPageData>();

for (const entry of collectionDataset.surahs) {
  surahMap.set(entry.surah.id, entry);
  for (const v of entry.verses) {
    verseMap.set(v.verseKey, v);
    const verseTranslationTr = v.translations[0]?.text ?? "";
    for (const w of v.words) {
      const enriched: EnrichedWord = {
        ...w,
        surahId: entry.surah.id,
        surahNameTr: entry.surah.nameTurkish,
        verseKey: v.verseKey,
        verseTranslationTr,
      };
      wordMap.set(w.location, enriched);
      allWordsList.push(enriched);
    }
  }
}

for (const pageNumber of collectionDataset.includedPages) {
  const sections: MushafPageData["sections"] = [];
  let juzNumber = 1;
  let hizbNumber = 1;

  for (const entry of collectionDataset.surahs) {
    const versesOnPage = entry.verses.filter((v) => v.pageNumber === pageNumber);
    if (versesOnPage.length > 0) {
      juzNumber = versesOnPage[0]!.juzNumber;
      hizbNumber = versesOnPage[0]!.hizbNumber;
      sections.push({
        surah: entry.surah,
        chapterAudioUrl: entry.chapterRecitations.alafasyChapterAudioUrl,
        startsOnThisPage: versesOnPage[0]!.verseNumber === 1,
        verses: versesOnPage,
      });
    }
  }

  pageMap.set(pageNumber, {
    edition: collectionDataset.edition,
    pageNumber,
    juzNumber,
    hizbNumber,
    availablePages: collectionDataset.includedPages,
    sections,
  });
}

export function getFatihaDataset(): CanonicalSurahDataset {
  return fatihaDataset;
}

export function getCanonicalCollection(): CanonicalCollectionDataset {
  return collectionDataset;
}

export function getContentManifest(): ContentManifest {
  return contentManifest;
}

export function getAvailablePages(): number[] {
  return collectionDataset.includedPages;
}

export function getAvailableSurahs(): CanonicalSurahMeta[] {
  return collectionDataset.surahs.map((s) => s.surah);
}

export function getSurahEntry(surahId: number): CanonicalSurahEntry | undefined {
  return surahMap.get(surahId);
}

export function getMushafPageData(pageNumber: number): MushafPageData {
  return (
    pageMap.get(pageNumber) ??
    pageMap.get(1)!
  );
}

export function getAllFatihaWords(): EnrichedWord[] {
  return allWordsList.filter((w) => w.surahId === 1);
}

export function getAllVerifiedWords(): EnrichedWord[] {
  return allWordsList;
}

export function getVerseByKey(verseKey: string): CanonicalVerse | undefined {
  return verseMap.get(verseKey);
}

export function getFatihaVerseByKey(verseKey: string): CanonicalVerse | undefined {
  return verseMap.get(verseKey);
}

export function getWordByLocation(location: string): EnrichedWord | undefined {
  return wordMap.get(location);
}

export function getFatihaWordByLocation(location: string): EnrichedWord | undefined {
  return wordMap.get(location);
}

export function getWordsByRoot(rootArabic: string): EnrichedWord[] {
  return allWordsList.filter((w) => w.morphology.rootArabic === rootArabic);
}

export function verifyVerseSha256(verse: CanonicalVerse): boolean {
  const digest = crypto.createHash("sha256").update(verse.textUthmani, "utf8").digest("hex");
  return digest === verse.textUthmaniSha256;
}

const POS_LABELS_TR: Record<string, string> = {
  N: "İsim",
  PN: "Özel İsim",
  V: "Fiil",
  P: "Edat / Bağlaç",
  DET: "Belirlilik Takısı (El-)",
  ADJ: "Sıfat",
  PREF: "Ön Ek",
  PRON: "Zamir",
};

export function formatPosTurkish(pos: string): string {
  return POS_LABELS_TR[pos] ?? pos;
}
