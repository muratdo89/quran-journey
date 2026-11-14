import type { StoredLearningCard } from "./fsrs-scheduler";

export interface ErrorPatternInsight {
  id: string;
  categoryTr: string;
  severity: "high" | "medium" | "info";
  titleTr: string;
  detailTr: string;
  actionHref: string;
  actionLabelTr: string;
}

export interface RootMistakeBucket {
  rootArabic: string;
  missedCount: number;
  sampleWords: string[];
}

export interface JuzSummaryBucket {
  juzNumber: number;
  startPage: number;
  endPage: number;
  studiedPages: number;
  completedPages: number;
  totalPages: number;
}

export function buildErrorPatternInsights(params: {
  cards: StoredLearningCard[];
  wordMistakes: Array<{
    wordLocation: string;
    arabic: string;
    meaningTr: string;
    rootArabic: string | null;
    partOfSpeech: string | null;
    timesMissed: number;
  }>;
  verseStates: Array<{ verseKey: string; memorizationState: string }>;
  completedReadingModuleIds: string[];
  totalReadingModules: number;
  practicedTajweedSlugs: string[];
  totalTajweedLessons: number;
}): {
  insights: ErrorPatternInsight[];
  topMissedRoots: RootMistakeBucket[];
  lapsedCardsCount: number;
  revisionVersesCount: number;
} {
  const {
    cards,
    wordMistakes,
    verseStates,
    completedReadingModuleIds,
    totalReadingModules,
    practicedTajweedSlugs,
    totalTajweedLessons,
  } = params;

  const rootMap = new Map<string, { missed: number; words: Set<string> }>();
  const posMap = new Map<string, number>();

  for (const wm of wordMistakes) {
    if (wm.timesMissed <= 0) continue;
    if (wm.rootArabic) {
      const existing = rootMap.get(wm.rootArabic) ?? { missed: 0, words: new Set<string>() };
      existing.missed += wm.timesMissed;
      existing.words.add(wm.arabic);
      rootMap.set(wm.rootArabic, existing);
    }
    if (wm.partOfSpeech) {
      posMap.set(wm.partOfSpeech, (posMap.get(wm.partOfSpeech) ?? 0) + wm.timesMissed);
    }
  }

  const topMissedRoots: RootMistakeBucket[] = Array.from(rootMap.entries())
    .map(([rootArabic, info]) => ({
      rootArabic,
      missedCount: info.missed,
      sampleWords: Array.from(info.words).slice(0, 4),
    }))
    .sort((a, b) => b.missedCount - a.missedCount)
    .slice(0, 6);

  const lapsedCards = cards.filter((c) => c.lapses > 0);
  const revisionVerses = verseStates.filter((v) => v.memorizationState === "needs_revision");
  const insights: ErrorPatternInsight[] = [];

  if (revisionVerses.length > 0) {
    insights.push({
      id: "hifz-decay",
      categoryTr: "Ezber / Hıfz",
      severity: "high",
      titleTr: `${revisionVerses.length} ayette ezber pekiştirmesi zayıfladı`,
      detailTr: `Tekrar bekleyen ayetler (${revisionVerses
        .slice(0, 4)
        .map((v) => v.verseKey)
        .join(", ")}) yeni ezbere geçmeden önce öncelikli olarak gözden geçirilmeli.`,
      actionHref: `/memorization?verse=${encodeURIComponent(revisionVerses[0]!.verseKey)}`,
      actionLabelTr: "Ayetleri Tekrarla",
    });
  }

  if (lapsedCards.length > 0) {
    insights.push({
      id: "fsrs-lapses",
      categoryTr: "Kelime Hatırlama",
      severity: lapsedCards.length >= 4 ? "high" : "medium",
      titleTr: `${lapsedCards.length} kelime kartında unutma (lapse) tespit edildi`,
      detailTr:
        "FSRS motoru zorlanılan kelimeleri kolaylaştırmak için aralıklarını otomatik kısalttı. Bugünkü aktif tekrar seansında bu kartlar önce sorulacak.",
      actionHref: "/review",
      actionLabelTr: "Tekrar Kuyruğunu Aç",
    });
  }

  if (topMissedRoots.length > 0) {
    const top = topMissedRoots[0]!;
    insights.push({
      id: "root-weakness",
      categoryTr: "Kök Ailesi Analizi",
      severity: "medium",
      titleTr: `En çok zorlanılan kök: ${top.rootArabic} (${top.missedCount} hata)`,
      detailTr: `Bu köke bağlı kelimeleri (${top.sampleWords.join(", ")}) kök ailesi görünümünde birlikte çalışmak tek tek ezberlemekten daha kalıcıdır.`,
      actionHref: `/vocabulary?root=${encodeURIComponent(top.rootArabic)}`,
      actionLabelTr: "Kök Ailesini İncele",
    });
  }

  if (completedReadingModuleIds.length < totalReadingModules) {
    insights.push({
      id: "reading-gaps",
      categoryTr: "Arapça Okuma",
      severity: "info",
      titleTr: `${totalReadingModules - completedReadingModuleIds.length} okuma modülü henüz tamamlanmadı`,
      detailTr:
        "Harekeler, cezim/şedde ve hemze-i vasıl modüllerini tamamlamak Mushaf okuma akıcılığınızı ve kelime tanıma hızınızı yükseltir.",
      actionHref: "/learn-arabic",
      actionLabelTr: "Okuma Derslerine Git",
    });
  }

  if (practicedTajweedSlugs.length < totalTajweedLessons) {
    insights.push({
      id: "tajweed-gaps",
      categoryTr: "Tecvid Farkındalığı",
      severity: "info",
      titleTr: `${totalTajweedLessons - practicedTajweedSlugs.length} tecvid kuralı pratik bekliyor`,
      detailTr:
        "Mahreç, med, gunne ve kalkale derslerindeki referans kelimeleri dinleyerek kulak aşinalığı oluşturun.",
      actionHref: "/learn-arabic?tab=tajweed",
      actionLabelTr: "Tecvid Derslerini Aç",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "balanced-progress",
      categoryTr: "Dengeli İlerleme",
      severity: "info",
      titleTr: "Şu ana kadar belirgin bir hata birikimi görünmüyor",
      detailTr:
        "Çalışma geçmişiniz arttıkça burada unutulan kökler, zorlanılan ayetler ve okuma örüntüleri otomatik sınıflandırılacaktır.",
      actionHref: "/mushaf",
      actionLabelTr: "Mushaf'ta Devam Et",
    });
  }

  return {
    insights,
    topMissedRoots,
    lapsedCardsCount: lapsedCards.length,
    revisionVersesCount: revisionVerses.length,
  };
}

// Standard 30-Juz start pages in 604-page Madinah Mushaf
export const MADINAH_JUZ_RANGES: Array<{ juz: number; startPage: number; endPage: number }> = [
  { juz: 1, startPage: 1, endPage: 21 },
  { juz: 2, startPage: 22, endPage: 41 },
  { juz: 3, startPage: 42, endPage: 61 },
  { juz: 4, startPage: 62, endPage: 81 },
  { juz: 5, startPage: 82, endPage: 101 },
  { juz: 6, startPage: 102, endPage: 121 },
  { juz: 7, startPage: 122, endPage: 141 },
  { juz: 8, startPage: 142, endPage: 161 },
  { juz: 9, startPage: 162, endPage: 181 },
  { juz: 10, startPage: 182, endPage: 201 },
  { juz: 11, startPage: 202, endPage: 221 },
  { juz: 12, startPage: 222, endPage: 241 },
  { juz: 13, startPage: 242, endPage: 261 },
  { juz: 14, startPage: 262, endPage: 281 },
  { juz: 15, startPage: 282, endPage: 301 },
  { juz: 16, startPage: 302, endPage: 321 },
  { juz: 17, startPage: 322, endPage: 341 },
  { juz: 18, startPage: 342, endPage: 361 },
  { juz: 19, startPage: 362, endPage: 381 },
  { juz: 20, startPage: 382, endPage: 401 },
  { juz: 21, startPage: 402, endPage: 421 },
  { juz: 22, startPage: 422, endPage: 441 },
  { juz: 23, startPage: 442, endPage: 461 },
  { juz: 24, startPage: 462, endPage: 481 },
  { juz: 25, startPage: 482, endPage: 501 },
  { juz: 26, startPage: 502, endPage: 521 },
  { juz: 27, startPage: 522, endPage: 541 },
  { juz: 28, startPage: 542, endPage: 561 },
  { juz: 29, startPage: 562, endPage: 581 },
  { juz: 30, startPage: 582, endPage: 604 },
];

export function buildJuzProgressGrid(
  pageProgress: Array<{ pageNumber: number; status: string }>
): JuzSummaryBucket[] {
  const statusByPage = new Map(pageProgress.map((p) => [p.pageNumber, p.status]));
  return MADINAH_JUZ_RANGES.map((r) => {
    let studied = 0;
    let completed = 0;
    for (let p = r.startPage; p <= r.endPage; p += 1) {
      const st = statusByPage.get(p);
      if (st && st !== "not_started") studied += 1;
      if (st === "completed") completed += 1;
    }
    return {
      juzNumber: r.juz,
      startPage: r.startPage,
      endPage: r.endPage,
      studiedPages: studied,
      completedPages: completed,
      totalPages: r.endPage - r.startPage + 1,
    };
  });
}
