import { getMushafPageData, getQuranMeta, getVerseByKey } from "@/lib/content/canonical-loader";
import { getReciterAyahAudioUrl } from "@/lib/audio/reciters";
import { toTurkishReading } from "@/lib/content/turkish-reading";
import { looksEnglishGloss } from "@/lib/content/warmup";

export interface HifzWord {
  text: string;
  reading: string | null;
  gloss: string | null;
  audioUrl: string | null;
}

export interface HifzVerse {
  key: string;
  verseNumber: number;
  surahNameTr: string;
  /** True for the first verse of a surah that starts on this page. */
  startsSurah: boolean;
  text: string;
  meal: string;
  reading: string;
  audioUrl: string | null;
  words: HifzWord[];
  /** Indices of up to 4 content words worth learning first ("anahtar kelimeler"). */
  keyWords: number[];
  /** Letter count (no diacritics), used to split the page into parts and chunks. */
  letters: number;
}

export interface HifzPageData {
  page: number;
  juz: number;
  label: string;
  verses: HifzVerse[];
}

const ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

function cleanMeal(text: string): string {
  return text
    .replace(/<sup[^>]*>.*?<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(quot|#39|apos|amp|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

const DIACRITICS =/[ً-ٰٟۖ-ۭـ\s]/g;
const countLetters = (t: string) => t.replace(DIACRITICS, "").length;

function pickKeyWords(words: HifzWord[]): number[] {
  const seen = new Set<string>();
  const candidates = words
    .map((w, i) => ({ w, i, n: countLetters(w.text) }))
    .filter(({ w, n }) => {
      if (!w.gloss || n < 4 || seen.has(w.text)) return false;
      seen.add(w.text);
      return true;
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map(({ i }) => i);
  return candidates.sort((a, b) => a - b);
}

export function pageLabel(pageNumber: number): string {
  const meta = getQuranMeta();
  const ids = meta.pageSurahs[String(pageNumber)] ?? [];
  return ids
    .map((id) => meta.surahs.find((s) => s.id === id)?.nameTurkish)
    .filter(Boolean)
    .join(", ");
}

/** Page labels for every page ("Nâs, Felak, İhlâs"), small enough to send to the client. */
export function allPageLabels(): Record<number, string> {
  const out: Record<number, string> = {};
  for (let p = 1; p <= getQuranMeta().totalPages; p++) out[p] = pageLabel(p);
  return out;
}

export function buildHifzPageData(pageNumber: number, reciterId: number): HifzPageData {
  const page = getMushafPageData(pageNumber);
  const verses: HifzVerse[] = [];
  for (const section of page.sections) {
    for (const v of section.verses) {
      const words: HifzWord[] = v.words.map((w) => {
        const gloss = w.translationTr?.trim();
        return {
          text: w.textUthmani,
          reading: toTurkishReading(w.transliteration),
          gloss: gloss && !looksEnglishGloss(gloss) ? gloss : null,
          audioUrl: w.audioUrl,
        };
      });
      const tr = v.translations.find((t) => t.resourceId === 77) ?? v.translations.find((t) => t.languageCode === "tr");
      verses.push({
        key: v.verseKey,
        verseNumber: v.verseNumber,
        surahNameTr: section.surah.nameTurkish,
        startsSurah: v.verseNumber === 1,
        text: v.textUthmani,
        meal: cleanMeal(tr?.text ?? ""),
        reading: words.map((w) => w.reading ?? "").filter(Boolean).join(" "),
        audioUrl: getReciterAyahAudioUrl(v, reciterId),
        words,
        keyWords: pickKeyWords(words),
        letters: countLetters(v.textUthmani),
      });
    }
  }
  return { page: page.pageNumber, juz: page.juzNumber, label: pageLabel(page.pageNumber), verses };
}

const MEMORIZED_STATES = new Set(["provisional_mastery", "stable_memorization"]);

/**
 * Pages whose every verse was marked memorized on the older, surah-based Ezber page.
 * Used once to carry that progress into the page-by-page plan.
 */
export function legacyMemorizedPages(verseProgress: Array<{ verseKey: string; memorizationState: string }>): number[] {
  const memorized = new Set(verseProgress.filter((v) => MEMORIZED_STATES.has(v.memorizationState)).map((v) => v.verseKey));
  if (memorized.size === 0) return [];
  const candidatePages = new Set<number>();
  for (const key of memorized) {
    const v = getVerseByKey(key);
    if (v) candidatePages.add(v.pageNumber);
  }
  const pages: number[] = [];
  for (const p of candidatePages) {
    const keys = getMushafPageData(p).sections.flatMap((s) => s.verses.map((v) => v.verseKey));
    if (keys.length > 0 && keys.every((k) => memorized.has(k))) pages.push(p);
  }
  return pages.sort((a, b) => a - b);
}
