import {
  ARABIC_READING_MODULES,
  TAJWEED_LESSONS,
} from "@/lib/content/arabic-curriculum";
import {
  getAvailableSurahs,
  getMushafPageData,
  getMutashabihatForVerse,
  getSurahEntry,
  getVerseByKey,
  getWordByLocation,
  searchQuranVerses,
} from "@/lib/content/canonical-loader";
import { toTurkishReading } from "@/lib/content/turkish-reading";
import { getReciterAyahAudioUrl, getReciterById } from "@/lib/audio/reciters";
import { alignAsrTranscript } from "@/lib/audio/sequence-aligner";
import type { DashboardStateSnapshot, ProgressRepository } from "@/lib/db/types";
import { prioritizeDueCards } from "@/lib/learning-engine";
import type {
  TutorAudioCue,
  TutorRecitationCheck,
  TutorStageCard,
} from "./types";

export function buildTodayTutorBrief(
  snapshot: DashboardStateSnapshot,
  overridePage?: number
): {
  card: Extract<TutorStageCard, { kind: "brief" }>;
  firstVerseKey: string;
} {
  const pageNumber = overridePage ?? snapshot.profile.currentPageNumber ?? 1;
  const pageData = getMushafPageData(pageNumber);
  const firstSection = pageData.sections[0];
  const firstVerse = firstSection?.verses[0];
  const surahNameTr = firstSection?.surah.nameTurkish ?? "Fâtiha";
  const dueCards = prioritizeDueCards(snapshot.cards);
  const remainingReadingModules = Math.max(
    0,
    ARABIC_READING_MODULES.length - snapshot.completedReadingModuleIds.length
  );
  const remainingTajweedLessons = Math.max(
    0,
    TAJWEED_LESSONS.length - snapshot.practicedTajweedSlugs.length
  );
  const estimatedMinutes = Math.min(
    25,
    Math.max(8, (dueCards.length > 0 ? 4 : 2) + (remainingReadingModules > 0 ? 3 : 0) + 8)
  );

  return {
    card: {
      kind: "brief",
      pageNumber: pageData.pageNumber,
      surahNameTr,
      dueCardsCount: dueCards.length,
      remainingReadingModules,
      remainingTajweedLessons,
      estimatedMinutes,
    },
    firstVerseKey: firstVerse?.verseKey ?? "1:1",
  };
}

export function getNextReadingWarmup(snapshot: DashboardStateSnapshot): {
  card: Extract<TutorStageCard, { kind: "reading_module" }>;
  audioCue: TutorAudioCue | null;
} | null {
  const completed = new Set(snapshot.completedReadingModuleIds);
  const nextMod = ARABIC_READING_MODULES.find((m) => !completed.has(m.id));
  if (!nextMod) return null;

  const firstAudioExample = nextMod.examples.find((ex) => Boolean(ex.audioUrl));
  return {
    card: {
      kind: "reading_module",
      moduleId: nextMod.id,
      titleTr: nextMod.titleTr,
      subtitleTr: nextMod.subtitleTr,
      explanationTr: nextMod.explanationTr,
      commonMistakeTr: nextMod.commonMistakeTr,
      examples: nextMod.examples.slice(0, 4).map((ex) => ({
        arabic: ex.arabic,
        labelTr: ex.labelTr,
        audioUrl: ex.audioUrl,
      })),
    },
    audioCue: firstAudioExample?.audioUrl
      ? {
          kind: "example",
          url: firstAudioExample.audioUrl,
          labelTr: `Örnek ses: ${firstAudioExample.labelTr}`,
          autoPlay: true,
        }
      : null,
  };
}

export function getNextTajweedWarmup(snapshot: DashboardStateSnapshot): {
  card: Extract<TutorStageCard, { kind: "tajweed_lesson" }>;
  audioCue: TutorAudioCue | null;
} | null {
  const practiced = new Set(snapshot.practicedTajweedSlugs);
  const nextLesson = TAJWEED_LESSONS.find((l) => !practiced.has(l.slug));
  if (!nextLesson) return null;

  return {
    card: {
      kind: "tajweed_lesson",
      slug: nextLesson.slug,
      nameTr: nextLesson.nameTr,
      nameArabic: nextLesson.nameArabic,
      summaryTr: nextLesson.summaryTr,
      listenTipTr: nextLesson.listenDiscriminationTipTr,
      exampleArabic: nextLesson.fatihaExample?.arabic,
      exampleExplanationTr: nextLesson.fatihaExample?.explanationTr,
      exampleAudioUrl: nextLesson.fatihaExample?.audioUrl,
    },
    audioCue: nextLesson.fatihaExample?.audioUrl
      ? {
          kind: "example",
          url: nextLesson.fatihaExample.audioUrl,
          labelTr: `Tecvid örneği: ${nextLesson.nameTr}`,
          autoPlay: true,
        }
      : null,
  };
}

export function getNextVocabularyQuizItem(
  snapshot: DashboardStateSnapshot,
  pageNumber: number,
  excludeLocations: string[] = []
): {
  card: Extract<TutorStageCard, { kind: "vocabulary_quiz" }>;
  audioCue: TutorAudioCue | null;
} | null {
  const excluded = new Set(excludeLocations);
  const excludedSurface = new Set<string>();
  for (const loc of excludeLocations) {
    const w = getWordByLocation(loc);
    if (w?.textUthmani) excludedSurface.add(w.textUthmani.trim());
  }

  const dueCards = prioritizeDueCards(snapshot.cards).filter(
    (c) => c.cardType === "vocabulary" && !excluded.has(c.targetKey)
  );

  for (const card of dueCards) {
    const word = getWordByLocation(card.targetKey);
    if (!word || !word.translationTr?.trim()) continue;
    if (excludedSurface.has(word.textUthmani.trim())) continue;
    return {
      card: {
        kind: "vocabulary_quiz",
        cardId: card.id,
        wordLocation: word.location,
        verseKey: word.verseKey,
        surahNameTr: word.surahNameTr,
        textUthmani: word.textUthmani,
        turkishReading: word.transliteration ? toTurkishReading(word.transliteration) : null,
        meaningTr: word.translationTr,
        verseTranslationTr: word.verseTranslationTr,
        rootArabic: word.morphology.rootArabic,
        audioUrl: word.audioUrl,
        revealed: false,
      },
      audioCue: word.audioUrl
        ? {
            kind: "word",
            url: word.audioUrl,
            labelTr: `Kelime telaffuzu (${word.verseKey})`,
            autoPlay: true,
          }
        : null,
    };
  }

  // Fallback: pick an unasked, distinct word with a Turkish meaning from the learner's active Mushaf page
  const pageData = getMushafPageData(pageNumber);
  for (const section of pageData.sections) {
    for (const verse of section.verses) {
      for (const word of verse.words) {
        if (excluded.has(word.location)) continue;
        if (!word.translationTr?.trim()) continue;
        if (excludedSurface.has(word.textUthmani.trim())) continue;
        return {
          card: {
            kind: "vocabulary_quiz",
            cardId: null,
            wordLocation: word.location,
            verseKey: verse.verseKey,
            surahNameTr: section.surah.nameTurkish,
            textUthmani: word.textUthmani,
            turkishReading: word.transliteration ? toTurkishReading(word.transliteration) : null,
            meaningTr: word.translationTr,
            verseTranslationTr: verse.translations[0]?.text ?? "",
            rootArabic: word.morphology.rootArabic,
            audioUrl: word.audioUrl,
            revealed: false,
          },
          audioCue: word.audioUrl
            ? {
                kind: "word",
                url: word.audioUrl,
                labelTr: `Kelime telaffuzu (${verse.verseKey})`,
                autoPlay: true,
              }
            : null,
        };
      }
    }
  }

  return null;
}

export function getVerseStudyCard(params: {
  verseKey?: string | null;
  pageNumber: number;
  reciterId: number;
  hideArabicText: boolean;
  recitationCheck?: TutorRecitationCheck;
}): {
  card: Extract<TutorStageCard, { kind: "verse_study" }>;
  audioCue: TutorAudioCue | null;
  nextVerseKeyOnPage: string | null;
} {
  const pageData = getMushafPageData(params.pageNumber);
  const allVersesOnPage = pageData.sections.flatMap((s) =>
    s.verses.map((v) => ({ verse: v, surahNameTr: s.surah.nameTurkish }))
  );

  let target = params.verseKey
    ? allVersesOnPage.find((item) => item.verse.verseKey === params.verseKey)
    : undefined;

  if (!target && params.verseKey) {
    const direct = getVerseByKey(params.verseKey);
    if (direct) {
      const directPage = getMushafPageData(direct.pageNumber);
      const sec = directPage.sections.find((s) => s.surah.id === direct.surahId);
      target = { verse: direct, surahNameTr: sec?.surah.nameTurkish ?? `Sure ${direct.surahId}` };
    }
  }

  if (!target) {
    target = allVersesOnPage[0]!;
  }

  const idx = allVersesOnPage.findIndex((i) => i.verse.verseKey === target!.verse.verseKey);
  const nextVerseKeyOnPage =
    idx >= 0 && idx + 1 < allVersesOnPage.length
      ? allVersesOnPage[idx + 1]!.verse.verseKey
      : null;

  const reciter = getReciterById(params.reciterId);
  const audioUrl = getReciterAyahAudioUrl(target.verse, params.reciterId);
  const mutashabihatCount = getMutashabihatForVerse(target.verse.verseKey).length;

  return {
    card: {
      kind: "verse_study",
      verseKey: target.verse.verseKey,
      surahNameTr: target.surahNameTr,
      pageNumber: target.verse.pageNumber,
      textUthmani: target.verse.textUthmani,
      translationTr: target.verse.translations[0]?.text ?? "",
      reciterNameTr: reciter.nameTr,
      audioUrl,
      hideArabicText: params.hideArabicText,
      mutashabihatCount,
      recitationCheck: params.recitationCheck,
    },
    audioCue:
      audioUrl && !params.hideArabicText
        ? {
            kind: "ayah",
            url: audioUrl,
            labelTr: `${target.surahNameTr} ${target.verse.verseKey} (${reciter.nameTr})`,
            autoPlay: true,
          }
        : null,
    nextVerseKeyOnPage,
  };
}

export function evaluateCanonicalRecitation(
  verseKey: string,
  recognizedTranscript: string
): TutorRecitationCheck | null {
  const verse = getVerseByKey(verseKey);
  if (!verse) return null;

  const alignment = alignAsrTranscript(verse.textUthmani, recognizedTranscript, verseKey);
  const missedWords = alignment.diffs
    .filter((d) => (d.type === "missing" || d.type === "substitution") && d.expectedWord)
    .map((d) => d.expectedWord!);

  const pct = Math.round(alignment.wordMatchRatio * 100);
  const summaryTr =
    alignment.wordMatchRatio >= 0.85
      ? `Kelime sırası eşleşmesi %${pct} (${alignment.matchedCount}/${alignment.expectedCount}). Not: Bu kontrol yalnızca kelime dizisini ölçer; tecvid ve mahreç için referans okuyucu veya uzman hoca teyidi esastır.`
      : `Kelime sırası eşleşmesi %${pct} (${alignment.matchedCount}/${alignment.expectedCount}). Takılınan kelimeler: ${missedWords.slice(0, 3).join("، ") || "belirsiz"}.`;

  return {
    verseKey,
    wordMatchRatio: Number(alignment.wordMatchRatio.toFixed(3)),
    matchedCount: alignment.matchedCount,
    expectedCount: alignment.expectedCount,
    missedWords,
    diffs: alignment.diffs.map((d) => ({
      type: d.type,
      expectedWord: d.expectedWord,
      recognizedWord: d.recognizedWord,
    })),
    requiresHumanReview: true,
    summaryTr,
  };
}

export function checkVocabularyAnswerMatch(userAnswerTr: string, expectedMeaningTr: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/\([^)]*\)/g, " ")
      .toLocaleLowerCase("tr-TR")
      .replace(/â/g, "a")
      .replace(/î/g, "i")
      .replace(/û/g, "u")
      .replace(/['’`]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  const ans = norm(userAnswerTr);
  const exp = norm(expectedMeaningTr);
  if (!ans || !exp || ans.length < 2) return false;

  const stopWords = new Set([
    "ve",
    "ile",
    "bir",
    "bu",
    "şu",
    "o",
    "da",
    "de",
    "için",
    "olan",
    "en",
    "mi",
    "mı",
    "mu",
    "mü",
    "ne",
    "ben",
    "sen",
    "biz",
    "siz",
    "evet",
    "hayır",
    "tamam",
    "peki",
    "yani",
    "şey",
    "galiba",
    "sanırım",
    "demek",
    "anlamı",
    "kelime",
  ]);

  if (ans === exp) return true;
  if (exp.length >= 3 && ans.includes(exp)) return true;

  const expTokens = exp.split(" ").filter((t) => t.length >= 2 && !stopWords.has(t));
  const ansTokens = ans.split(" ").filter((t) => t.length >= 2 && !stopWords.has(t));
  if (expTokens.length === 0 || ansTokens.length === 0) return false;

  // Exact token match (handles short valid Turkish words like "din", "rab", "hak", "yol", "nur")
  if (expTokens.some((et) => ansTokens.includes(et))) return true;

  // Word-start stem match for agglutinative Turkish suffixes (e.g. yol->yola, rab->rabbi, gün->gününün, nimet->nimetler)
  return expTokens.some((et) =>
    ansTokens.some((at) => {
      if (at.length >= 3 && et.startsWith(at)) return true;
      if (et.length >= 3 && at.startsWith(et)) return true;
      if (et.length >= 4 && at.length >= 4) {
        return at.startsWith(et.slice(0, 4)) || et.startsWith(at.slice(0, 4));
      }
      return false;
    })
  );
}

export function lookupCanonicalInfo(query: string): {
  found: boolean;
  summaryTr: string;
} {
  const trimmed = query.trim();
  const directWord = getWordByLocation(trimmed);
  if (directWord) {
    return {
      found: true,
      summaryTr: `${directWord.textUthmani} (${directWord.location}): Kelime anlamı "${directWord.translationTr}".${directWord.morphology.rootArabic ? ` Kökü: ${directWord.morphology.rootArabic}.` : ""} Ayet meali: "${directWord.verseTranslationTr}"`,
    };
  }

  const hits = searchQuranVerses({ query: trimmed, limit: 2 });
  if (hits.results.length > 0) {
    const first = hits.results[0]!;
    return {
      found: true,
      summaryTr: `${first.surahNameTr} ${first.verseKey} (Sayfa ${first.pageNumber}): "${first.translationDiyanet}"`,
    };
  }

  return {
    found: false,
    summaryTr: "Doğrulanmış Kur'an verisinde bu sorguyla doğrudan eşleşen kayıt bulunamadı.",
  };
}

function foldTurkishAscii(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ı/g, "i")
    .replace(/['’`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveNavigationRequest(text: string): {
  pageNumber: number;
  verseKey: string;
  labelTr: string;
} | null {
  const low = text.toLocaleLowerCase("tr-TR");
  const folded = foldTurkishAscii(text);

  // 1. Explicit Mushaf page request: "sayfa 604", "sayfa 604'e geç", "604. sayfa", "604. sayfaya"
  const pageMatch =
    /\bsayfa\s*(\d{1,3})\b/.exec(folded) ?? /\b(\d{1,3})\.?\s*sayfa/.exec(folded);
  if (pageMatch) {
    const num = Number(pageMatch[1]);
    if (Number.isInteger(num) && num >= 1 && num <= 604) {
      const pageData = getMushafPageData(num);
      const firstSec = pageData.sections[0];
      const firstVerse = firstSec?.verses[0];
      if (firstVerse) {
        return {
          pageNumber: num,
          verseKey: firstVerse.verseKey,
          labelTr: `Sayfa ${num} (${firstSec.surah.nameTurkish})`,
        };
      }
    }
  }

  // 2. Explicit Surah name (+ optional ayah number): "bakara suresi", "yasin 5. ayet", "ihlas'a geç"
  const hasNavCue =
    /(?:sure|ayet|geç|aç|başla|çalış|oku|dinle|tekrar)/.test(low);
  if (!hasNavCue) return null;

  const surahs = getAvailableSurahs();
  const sorted = [...surahs].sort((a, b) => b.nameTurkish.length - a.nameTurkish.length);
  for (const s of sorted) {
    const targetFolded = foldTurkishAscii(s.nameTurkish);
    if (targetFolded.length < 3) continue;
    // Match exact Surah word (apostrophe was normalized to space, so "ihlas'a" -> "ihlas a")
    const pattern = new RegExp(`(?:^|\\s)${targetFolded}(?:\\s|$)`);
    if (pattern.test(folded)) {
      const entry = getSurahEntry(s.id);
      if (!entry || entry.verses.length === 0) continue;
      const ayahMatch = /\b(\d{1,3})\.?\s*ayet/.exec(folded) ?? /\bayet\s*(\d{1,3})\b/.exec(folded);
      const requestedAyah = ayahMatch ? Number(ayahMatch[1]) : 1;
      const verse =
        entry.verses.find((v) => v.verseNumber === requestedAyah) ?? entry.verses[0]!;
      return {
        pageNumber: verse.pageNumber,
        verseKey: verse.verseKey,
        labelTr: `${s.nameTurkish} Suresi ${verse.verseKey} (Sayfa ${verse.pageNumber})`,
      };
    }
  }

  return null;
}

export async function persistTutorProgress(
  repo: ProgressRepository,
  action:
    | { kind: "grade_vocab"; wordLocation: string; cardId: string | null; correct: boolean }
    | { kind: "verse_outcome"; verseKey: string; outcome: "clean_recall" | "partial_recall" | "failed_recall" }
    | { kind: "complete_reading"; moduleId: string }
    | { kind: "complete_tajweed"; slug: string }
    | { kind: "mark_page"; pageNumber: number }
): Promise<void> {
  if (action.kind === "grade_vocab") {
    const cardId =
      action.cardId ??
      (await repo.ensureVocabularyCard({ wordLocation: action.wordLocation, direction: "ar_to_tr" })).id;
    await repo.submitCardReview({
      cardId,
      rating: action.correct ? 3 : 1,
    });
    return;
  }

  if (action.kind === "verse_outcome") {
    await repo.updateVerseMemorization({
      verseKey: action.verseKey,
      outcome: action.outcome,
    });
    return;
  }

  if (action.kind === "complete_reading") {
    await repo.completeReadingModule({ moduleId: action.moduleId });
    return;
  }

  if (action.kind === "complete_tajweed") {
    await repo.markTajweedPracticed({ slug: action.slug });
    return;
  }

  if (action.kind === "mark_page") {
    await repo.markPageStudied({ pageNumber: action.pageNumber });
  }
}
