import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import quranMetaJson from "@/data/canonical/quran-meta.json";
import fatihaJson from "@/data/canonical/surah-1-fatiha.json";
import manifestJson from "@/data/manifest.json";
import type {
  CanonicalSurahDataset,
  CanonicalSurahEntry,
  CanonicalSurahMeta,
  CanonicalVerse,
  CanonicalWord,
  ContentManifest,
  LexiconIndexData,
  MushafPageData,
  MutashabihatMatch,
  QuranMetaDataset,
  RootFrequencyEntry,
  RootOccurrenceSample,
} from "./types";

const fatihaDataset = fatihaJson as unknown as CanonicalSurahDataset;
const quranMetaDataset = quranMetaJson as unknown as QuranMetaDataset;
const contentManifest = manifestJson as unknown as ContentManifest;

const SURAHS_DIR = path.join(process.cwd(), "src", "data", "canonical", "surahs");
const LEXICON_INDEX_PATH = path.join(
  process.cwd(),
  "src",
  "data",
  "canonical",
  "lexicon-index.json.gz"
);

const ALL_PAGES = Array.from({ length: quranMetaDataset.totalPages }, (_, i) => i + 1);
const SURAH_META_MAP = new Map<number, CanonicalSurahMeta>(
  quranMetaDataset.surahs.map((s) => [s.id, s])
);

const MAX_SURAH_CACHE = 40;
const surahCache = new Map<number, CanonicalSurahEntry>();
let lexiconIndexCache: LexiconIndexData | null = null;

export interface EnrichedWord extends CanonicalWord {
  surahId: number;
  surahNameTr: string;
  verseKey: string;
  verseTranslationTr: string;
}

export interface QuranSearchResult {
  verseKey: string;
  surahId: number;
  surahNameTr: string;
  pageNumber: number;
  textUthmani: string;
  translationDiyanet: string;
  translationElmalili: string;
}

export interface PaginatedWordsResult {
  items: EnrichedWord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function normalizeArabicForSearch(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\u0640/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readSurahFromDisk(surahId: number): CanonicalSurahEntry | undefined {
  if (!Number.isInteger(surahId) || surahId < 1 || surahId > 114) {
    return undefined;
  }
  const filePath = path.join(
    SURAHS_DIR,
    `surah-${String(surahId).padStart(3, "0")}.json.gz`
  );
  if (!fs.existsSync(filePath)) return undefined;
  const raw = zlib.gunzipSync(fs.readFileSync(filePath)).toString("utf8");
  return JSON.parse(raw) as CanonicalSurahEntry;
}

function enrichSurahWords(entry: CanonicalSurahEntry): EnrichedWord[] {
  const result: EnrichedWord[] = [];
  for (const v of entry.verses) {
    const verseTranslationTr = v.translations[0]?.text ?? "";
    for (const w of v.words) {
      result.push({
        ...w,
        surahId: entry.surah.id,
        surahNameTr: entry.surah.nameTurkish,
        verseKey: v.verseKey,
        verseTranslationTr,
      });
    }
  }
  return result;
}

export function getFatihaDataset(): CanonicalSurahDataset {
  return fatihaDataset;
}

export function getQuranMeta(): QuranMetaDataset {
  return quranMetaDataset;
}

export function getQuranTotals(): {
  totalSurahs: number;
  totalPages: number;
  totalVerses: number;
  totalWords: number;
} {
  return {
    totalSurahs: quranMetaDataset.totalSurahs,
    totalPages: quranMetaDataset.totalPages,
    totalVerses: quranMetaDataset.totalVerses,
    totalWords: quranMetaDataset.totalWords,
  };
}

export function getContentManifest(): ContentManifest {
  return contentManifest;
}

export function getAvailablePages(): number[] {
  return ALL_PAGES;
}

export function getAvailableSurahs(): CanonicalSurahMeta[] {
  return quranMetaDataset.surahs;
}

export function getSurahMeta(surahId: number): CanonicalSurahMeta | undefined {
  return SURAH_META_MAP.get(surahId);
}

export function getSurahEntry(surahId: number): CanonicalSurahEntry | undefined {
  if (!Number.isInteger(surahId) || surahId < 1 || surahId > 114) {
    return undefined;
  }
  const cached = surahCache.get(surahId);
  if (cached) {
    // Refresh LRU order
    surahCache.delete(surahId);
    surahCache.set(surahId, cached);
    return cached;
  }

  const loaded = readSurahFromDisk(surahId);
  if (!loaded) return undefined;

  if (surahCache.size >= MAX_SURAH_CACHE) {
    const oldestKey = surahCache.keys().next().value;
    if (oldestKey !== undefined) {
      surahCache.delete(oldestKey);
    }
  }
  surahCache.set(surahId, loaded);
  return loaded;
}

export function getMushafPageData(pageNumber: number): MushafPageData {
  const safePage =
    Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= quranMetaDataset.totalPages
      ? pageNumber
      : 1;

  const surahIds = quranMetaDataset.pageSurahs[String(safePage)] ?? [1];
  const [juzNumber, hizbNumber] = quranMetaDataset.pageJuzHizb[String(safePage)] ?? [1, 1];
  const sections: MushafPageData["sections"] = [];

  for (const sid of surahIds) {
    const entry = getSurahEntry(sid);
    if (!entry) continue;
    const versesOnPage = entry.verses.filter((v) => v.pageNumber === safePage);
    if (versesOnPage.length > 0) {
      sections.push({
        surah: entry.surah,
        chapterAudioUrl: entry.chapterRecitations.alafasyChapterAudioUrl,
        startsOnThisPage: versesOnPage[0]!.verseNumber === 1,
        verses: versesOnPage,
      });
    }
  }

  return {
    edition: quranMetaDataset.edition,
    pageNumber: safePage,
    juzNumber,
    hizbNumber,
    availablePages: ALL_PAGES,
    sections,
  };
}

export function getAllFatihaWords(): EnrichedWord[] {
  const fatiha = getSurahEntry(1);
  return fatiha ? enrichSurahWords(fatiha) : [];
}

export function getSurahEnrichedWords(surahId: number): EnrichedWord[] {
  const entry = getSurahEntry(surahId);
  return entry ? enrichSurahWords(entry) : [];
}

export function getVerseByKey(verseKey: string): CanonicalVerse | undefined {
  const match = /^(\d+):(\d+)$/.exec(verseKey.trim());
  if (!match) return undefined;
  const surahId = Number(match[1]);
  const entry = getSurahEntry(surahId);
  if (!entry) return undefined;
  return entry.verses.find((v) => v.verseKey === verseKey.trim());
}

export function getFatihaVerseByKey(verseKey: string): CanonicalVerse | undefined {
  return getVerseByKey(verseKey);
}

export function getWordByLocation(location: string): EnrichedWord | undefined {
  const match = /^(\d+):(\d+):(\d+)$/.exec(location.trim());
  if (!match) return undefined;
  const surahId = Number(match[1]);
  const verseNumber = Number(match[2]);
  const pos = Number(match[3]);
  const entry = getSurahEntry(surahId);
  if (!entry) return undefined;
  const verse = entry.verses.find((v) => v.verseNumber === verseNumber);
  if (!verse) return undefined;
  const word = verse.words.find((w) => w.position === pos);
  if (!word) return undefined;
  return {
    ...word,
    surahId: entry.surah.id,
    surahNameTr: entry.surah.nameTurkish,
    verseKey: verse.verseKey,
    verseTranslationTr: verse.translations[0]?.text ?? "",
  };
}

export function getFatihaWordByLocation(location: string): EnrichedWord | undefined {
  return getWordByLocation(location);
}

export function getLexiconIndex(): LexiconIndexData {
  if (lexiconIndexCache) return lexiconIndexCache;
  const raw = zlib.gunzipSync(fs.readFileSync(LEXICON_INDEX_PATH)).toString("utf8");
  lexiconIndexCache = JSON.parse(raw) as LexiconIndexData;
  return lexiconIndexCache;
}

export function getRootOccurrencesPreview(
  rootArabic: string,
  limit = 24
): RootOccurrenceSample[] {
  const idx = getLexiconIndex();
  const found = idx.roots.find((r) => r.root === rootArabic);
  return found ? found.samples.slice(0, limit) : [];
}

export function getWordsByRoot(rootArabic: string): EnrichedWord[] {
  const matches: EnrichedWord[] = [];
  for (let s = 1; s <= 114; s += 1) {
    const entry = surahCache.get(s) ?? readSurahFromDisk(s);
    if (!entry) continue;
    for (const v of entry.verses) {
      const verseTranslationTr = v.translations[0]?.text ?? "";
      for (const w of v.words) {
        if (w.morphology.rootArabic === rootArabic) {
          matches.push({
            ...w,
            surahId: entry.surah.id,
            surahNameTr: entry.surah.nameTurkish,
            verseKey: v.verseKey,
            verseTranslationTr,
          });
        }
      }
    }
  }
  return matches;
}

export function getTopRoots({
  query = "",
  page = 1,
  pageSize = 30,
}: {
  query?: string;
  page?: number;
  pageSize?: number;
}): {
  items: RootFrequencyEntry[];
  total: number;
  page: number;
  totalPages: number;
} {
  const idx = getLexiconIndex();
  const qRaw = query.trim();
  const qNorm = normalizeArabicForSearch(qRaw);
  const qTr = qRaw.toLocaleLowerCase("tr-TR");

  const filtered = qRaw
    ? idx.roots.filter(
        (r) =>
          r.root.includes(qRaw) ||
          normalizeArabicForSearch(r.root).includes(qNorm) ||
          r.samples.some(
            (s) =>
              s.translationTr.toLocaleLowerCase("tr-TR").includes(qTr) ||
              normalizeArabicForSearch(s.textUthmani).includes(qNorm)
          )
      )
    : idx.roots;

  const safeSize = Math.max(1, Math.min(100, pageSize));
  const totalPages = Math.max(1, Math.ceil(filtered.length / safeSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * safeSize;

  return {
    items: filtered.slice(start, start + safeSize),
    total: filtered.length,
    page: safePage,
    totalPages,
  };
}

export function getMutashabihatForVerse(verseKey: string): MutashabihatMatch[] {
  const idx = getLexiconIndex();
  return idx.mutashabihat[verseKey] ?? [];
}

export function getMutashabihatMapForVerses(
  verseKeys: string[]
): Record<string, MutashabihatMatch[]> {
  const idx = getLexiconIndex();
  const map: Record<string, MutashabihatMatch[]> = {};
  for (const key of verseKeys) {
    const matches = idx.mutashabihat[key];
    if (matches && matches.length > 0) {
      map[key] = matches;
    }
  }
  return map;
}

export function searchQuranVerses({
  query,
  scope = "all",
  surahId,
  limit = 30,
}: {
  query: string;
  scope?: "all" | "arabic" | "turkish";
  surahId?: number;
  limit?: number;
}): { results: QuranSearchResult[]; totalMatches: number } {
  const raw = query.trim();
  if (!raw) return { results: [], totalMatches: 0 };

  const idx = getLexiconIndex();
  const normArabicQ = normalizeArabicForSearch(raw);
  const trQ = raw.toLocaleLowerCase("tr-TR");
  const isVerseKeyQuery = /^\d{1,3}(:\d{0,3})?$/.test(raw);
  const safeLimit = Math.max(1, Math.min(60, limit));

  const matched: QuranSearchResult[] = [];
  let totalMatches = 0;

  for (const row of idx.verses) {
    const [verseKey, pageNumber, textUthmani, textImlaei, trDiyanet, trElmalili] = row;
    const rowSurahId = Number(verseKey.split(":")[0]);
    if (surahId && rowSurahId !== surahId) continue;

    let hit = false;
    if (isVerseKeyQuery) {
      hit = raw.includes(":") ? verseKey.startsWith(raw) : String(rowSurahId) === raw;
    } else {
      if (scope === "all" || scope === "arabic") {
        if (normArabicQ && normalizeArabicForSearch(textImlaei).includes(normArabicQ)) {
          hit = true;
        }
      }
      if (!hit && (scope === "all" || scope === "turkish")) {
        if (
          trDiyanet.toLocaleLowerCase("tr-TR").includes(trQ) ||
          trElmalili.toLocaleLowerCase("tr-TR").includes(trQ)
        ) {
          hit = true;
        }
      }
    }

    if (hit) {
      totalMatches += 1;
      if (matched.length < safeLimit) {
        const meta = SURAH_META_MAP.get(rowSurahId);
        matched.push({
          verseKey,
          surahId: rowSurahId,
          surahNameTr: meta?.nameTurkish ?? `Sure ${rowSurahId}`,
          pageNumber,
          textUthmani,
          translationDiyanet: trDiyanet,
          translationElmalili: trElmalili,
        });
      }
    }
  }

  return { results: matched, totalMatches };
}

function compareLocations(a: string, b: string): number {
  const [sa, va, wa] = a.split(":").map(Number);
  const [sb, vb, wb] = b.split(":").map(Number);
  return (sa ?? 0) - (sb ?? 0) || (va ?? 0) - (vb ?? 0) || (wa ?? 0) - (wb ?? 0);
}

export function getWordsPage({
  surahId = "all",
  rootArabic = "all",
  query = "",
  statusFilter = "all",
  statusMap = {},
  page = 1,
  pageSize = 24,
}: {
  surahId?: number | "all";
  rootArabic?: string | "all";
  query?: string;
  statusFilter?: "all" | "new" | "learning" | "known" | "difficult";
  statusMap?: Record<string, string>;
  page?: number;
  pageSize?: number;
}): PaginatedWordsResult {
  const safeSize = Math.max(1, Math.min(48, pageSize));
  const safePage = Math.max(1, page);
  const rawQ = query.trim();
  const trQ = rawQ.toLocaleLowerCase("tr-TR");
  const normArQ = normalizeArabicForSearch(rawQ);

  const matchesWord = (w: EnrichedWord): boolean => {
    const st = statusMap[w.location] ?? "new";
    if (statusFilter !== "all" && st !== statusFilter) return false;
    if (rootArabic !== "all" && w.morphology.rootArabic !== rootArabic) return false;
    if (!rawQ) return true;
    return (
      w.textUthmani.includes(rawQ) ||
      normalizeArabicForSearch(w.textImlaei).includes(normArQ) ||
      w.translationTr.toLocaleLowerCase("tr-TR").includes(trQ) ||
      w.verseKey.startsWith(rawQ) ||
      w.location.startsWith(rawQ) ||
      (w.morphology.rootArabic ?? "").includes(rawQ)
    );
  };

  // Fast Path 1: Single Surah specified (only 1 gzipped file read)
  if (surahId !== "all") {
    const words = getSurahEnrichedWords(surahId).filter(matchesWord);
    const total = words.length;
    const totalPages = Math.max(1, Math.ceil(total / safeSize));
    const clampedPage = Math.min(safePage, totalPages);
    const start = (clampedPage - 1) * safeSize;
    return {
      items: words.slice(start, start + safeSize),
      total,
      page: clampedPage,
      pageSize: safeSize,
      totalPages,
    };
  }

  // Fast Path 2: Specific non-'new' progress filter across studied locations only
  if (statusFilter !== "all" && statusFilter !== "new") {
    const targetLocs = Object.entries(statusMap)
      .filter(([, st]) => st === statusFilter)
      .map(([loc]) => loc)
      .sort(compareLocations);

    const matched: EnrichedWord[] = [];
    for (const loc of targetLocs) {
      const w = getWordByLocation(loc);
      if (w && matchesWord(w)) matched.push(w);
    }

    const total = matched.length;
    const totalPages = Math.max(1, Math.ceil(total / safeSize));
    const clampedPage = Math.min(safePage, totalPages);
    const start = (clampedPage - 1) * safeSize;
    return {
      items: matched.slice(start, start + safeSize),
      total,
      page: clampedPage,
      pageSize: safeSize,
      totalPages,
    };
  }

  // Fast Path 3: Unfiltered full Quran browse (77,429 words) — stream until slice collected!
  if (!rawQ && rootArabic === "all" && statusFilter === "all") {
    const total = quranMetaDataset.totalWords;
    const totalPages = Math.max(1, Math.ceil(total / safeSize));
    const clampedPage = Math.min(safePage, totalPages);
    const skip = (clampedPage - 1) * safeSize;

    const items: EnrichedWord[] = [];
    let offset = 0;

    for (let s = 1; s <= 114; s += 1) {
      const entry = surahCache.get(s) ?? readSurahFromDisk(s);
      if (!entry) continue;
      const surahWordCount = entry.verses.reduce((acc, v) => acc + v.words.length, 0);

      if (offset + surahWordCount <= skip) {
        offset += surahWordCount;
        continue;
      }

      const surahWords = enrichSurahWords(entry);
      const localStart = Math.max(0, skip - offset);
      const remaining = safeSize - items.length;
      items.push(...surahWords.slice(localStart, localStart + remaining));
      offset += surahWordCount;
      if (items.length >= safeSize) break;
    }

    return {
      items,
      total,
      page: clampedPage,
      pageSize: safeSize,
      totalPages,
    };
  }

  // Path 4: Global filtered scan (verseKey prefix optimization first if applicable)
  const verseKeyPrefixMatch = /^(\d{1,3}):/.exec(rawQ);
  if (verseKeyPrefixMatch) {
    const targetSid = Number(verseKeyPrefixMatch[1]);
    if (targetSid >= 1 && targetSid <= 114) {
      const words = getSurahEnrichedWords(targetSid).filter(matchesWord);
      const total = words.length;
      const totalPages = Math.max(1, Math.ceil(total / safeSize));
      const clampedPage = Math.min(safePage, totalPages);
      const start = (clampedPage - 1) * safeSize;
      return {
        items: words.slice(start, start + safeSize),
        total,
        page: clampedPage,
        pageSize: safeSize,
        totalPages,
      };
    }
  }

  // Full streaming scan across Surahs 1..114 (~350ms worst case cold, low RAM)
  const allMatched: EnrichedWord[] = [];
  for (let s = 1; s <= 114; s += 1) {
    const entry = surahCache.get(s) ?? readSurahFromDisk(s);
    if (!entry) continue;
    for (const v of entry.verses) {
      const verseTranslationTr = v.translations[0]?.text ?? "";
      for (const w of v.words) {
        const enriched: EnrichedWord = {
          ...w,
          surahId: entry.surah.id,
          surahNameTr: entry.surah.nameTurkish,
          verseKey: v.verseKey,
          verseTranslationTr,
        };
        if (matchesWord(enriched)) {
          allMatched.push(enriched);
        }
      }
    }
  }

  const total = allMatched.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const clampedPage = Math.min(safePage, totalPages);
  const start = (clampedPage - 1) * safeSize;

  return {
    items: allMatched.slice(start, start + safeSize),
    total,
    page: clampedPage,
    pageSize: safeSize,
    totalPages,
  };
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
