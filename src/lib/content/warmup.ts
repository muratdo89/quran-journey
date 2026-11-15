import { getMushafPageData } from "@/lib/content/canonical-loader";
import type { CanonicalWord } from "@/lib/content/types";

/**
 * A one-minute, audio-first warm-up built from real Quran word recordings on the
 * learner's current page: listen to one word, pick the word you heard, pick a meaning.
 */

export interface WarmupWord {
  location: string;
  textUthmani: string;
  translationTr: string;
  transliteration: string | null;
  audioUrl: string;
}

export type WarmupRound =
  | { kind: "listen"; word: WarmupWord }
  | { kind: "which_heard"; word: WarmupWord; options: WarmupWord[] }
  | { kind: "meaning"; word: WarmupWord; options: string[] };

export interface Warmup {
  verseKey: string;
  verseText: string;
  verseWords: Array<{ location: string; textUthmani: string }>;
  verseTranslationTr: string;
  verseAudioUrl: string | null;
  surahNameTr: string;
  pageNumber: number;
  /** Locations of the words practised, to highlight them in the verse at the end. */
  practisedLocations: string[];
  rounds: WarmupRound[];
}

const ENGLISH_WORDS =
  /(?<![\p{L}])(the|you|your|their|they|them|he|his|him|of|and|who|is|are|it|we|our|us|those|which|that|will|be|not|to|from|with|for|was|were|has|have|had|do|did|said|indeed|so|then|what|when|a|an|my|me|she|her)(?![\p{L}])/iu;
const TURKISH_LETTERS = /[çğıöşüâîûÇĞİÖŞÜÂÎÛ]/;

/**
 * Some word-by-word glosses in the source data fell back to English. They would look
 * broken in a Turkish quiz, so the warm-up skips them.
 */
export function looksEnglishGloss(text: string): boolean {
  return !TURKISH_LETTERS.test(text) && ENGLISH_WORDS.test(text);
}

function toWarmupWord(w: CanonicalWord): WarmupWord | null {
  if (!w.audioUrl || !w.translationTr || looksEnglishGloss(w.translationTr)) return null;
  return {
    location: w.location,
    textUthmani: w.textUthmani,
    translationTr: w.translationTr.trim(),
    transliteration: w.transliteration,
    audioUrl: w.audioUrl,
  };
}

/** Small deterministic PRNG so a given day always yields the same warm-up. */
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function dayNumber(d: Date): number {
  return Math.floor(d.getTime() / 86_400_000);
}

export function buildWarmup(pageNumber: number, now = new Date()): Warmup | null {
  const page = getMushafPageData(pageNumber);
  const rand = seeded(dayNumber(now) * 31 + page.pageNumber);

  const verses = page.sections.flatMap((s) =>
    s.verses.map((v) => ({ v, surahNameTr: s.surah.nameTurkish }))
  );
  // All usable words on the page (distractor pool), unique by spelling.
  const seen = new Set<string>();
  const pagePool: WarmupWord[] = [];
  for (const { v } of verses) {
    for (const w of v.words) {
      const ww = toWarmupWord(w);
      if (!ww || seen.has(ww.textUthmani)) continue;
      seen.add(ww.textUthmani);
      pagePool.push(ww);
    }
  }
  if (pagePool.length < 4) return null;

  // Pick a verse with at least 3 usable words, rotating daily.
  const candidates = verses.filter(
    ({ v }) => v.words.filter((w) => toWarmupWord(w)).length >= 3
  );
  if (candidates.length === 0) return null;
  const { v: verse, surahNameTr } = candidates[dayNumber(now) % candidates.length]!;

  const verseWords = verse.words.map(toWarmupWord).filter((w): w is WarmupWord => !!w);
  const uniqueVerseWords = verseWords.filter(
    (w, i) => verseWords.findIndex((x) => x.textUthmani === w.textUthmani) === i
  );
  // Prefer content words over short particles (لَا، فِى، هُوَ) so each round feels meaningful.
  const letters = (t: string) => t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\s]/g, "").length;
  const rich = uniqueVerseWords.filter((w) => letters(w.textUthmani) >= 4);
  const ordered = [
    ...shuffle(rich, rand),
    ...shuffle(uniqueVerseWords.filter((w) => !rich.includes(w)), rand),
  ];
  const [first, second, third] = ordered;
  if (!first || !second || !third) return null;

  const distractorsFor = (target: WarmupWord, n: number) =>
    shuffle(
      pagePool.filter(
        (w) => w.textUthmani !== target.textUthmani && w.translationTr !== target.translationTr
      ),
      rand
    ).slice(0, n);

  const heardOptions = shuffle([second, ...distractorsFor(second, 2)], rand);
  const meaningOptions = shuffle(
    [third.translationTr, ...distractorsFor(third, 2).map((w) => w.translationTr)],
    rand
  );

  const tr = verse.translations.find((t) => t.languageCode === "tr") ?? verse.translations[0];

  return {
    verseKey: verse.verseKey,
    verseText: verse.textUthmani,
    verseWords: verse.words.map((w) => ({ location: w.location, textUthmani: w.textUthmani })),
    verseTranslationTr: tr?.text ?? "",
    verseAudioUrl: verse.audio.alafasyAyahUrl,
    surahNameTr,
    pageNumber: page.pageNumber,
    practisedLocations: [first.location, second.location, third.location],
    rounds: [
      { kind: "listen", word: first },
      { kind: "which_heard", word: second, options: heardOptions },
      { kind: "meaning", word: third, options: meaningOptions },
    ],
  };
}
