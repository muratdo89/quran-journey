import { getMushafPageData, getQuranMeta } from "@/lib/content/canonical-loader";

export interface DailyVerse {
  verseKey: string;
  textUthmani: string;
  translationTr: string;
  surahNameTr: string;
  pageNumber: number;
}

export interface JuzProgress {
  juzNumber: number;
  hizbNumber: number;
  pagesInJuz: number;
  studiedPagesInJuz: number;
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

/**
 * A short verse from the learner's current page, rotating daily. It is a calm entry
 * point that also previews what today's reading is about. Prefers short verses so
 * the card stays light.
 */
export function getDailyVerse(pageNumber: number, now = new Date()): DailyVerse | null {
  const page = getMushafPageData(pageNumber);
  const verses = page.sections.flatMap((s) =>
    s.verses.map((v) => ({ v, surahNameTr: s.surah.nameTurkish }))
  );
  if (verses.length === 0) return null;
  const sorted = [...verses].sort((a, b) => a.v.textUthmani.length - b.v.textUthmani.length);
  const pool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  const pick = pool[dayOfYear(now) % pool.length]!;
  const tr =
    pick.v.translations.find((t) => t.languageCode === "tr") ?? pick.v.translations[0];
  return {
    verseKey: pick.v.verseKey,
    textUthmani: pick.v.textUthmani,
    translationTr: tr?.text ?? "",
    surahNameTr: pick.surahNameTr,
    pageNumber: page.pageNumber,
  };
}

export function getJuzProgress(pageNumber: number, studiedPages: number[]): JuzProgress {
  const meta = getQuranMeta();
  const [juzNumber, hizbNumber] = meta.pageJuzHizb[String(pageNumber)] ?? [1, 1];
  const studied = new Set(studiedPages);
  let pagesInJuz = 0;
  let studiedPagesInJuz = 0;
  for (const [page, [juz]] of Object.entries(meta.pageJuzHizb)) {
    if (juz !== juzNumber) continue;
    pagesInJuz += 1;
    if (studied.has(Number(page))) studiedPagesInJuz += 1;
  }
  return { juzNumber, hizbNumber, pagesInJuz, studiedPagesInJuz };
}
