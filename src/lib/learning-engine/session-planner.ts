import { prioritizeDueCards, type StoredLearningCard } from "./fsrs-scheduler";
import type { MemorizationState } from "./mastery";

export type SessionMode = "normal" | "intensive" | "recovery";

export interface DailyPlanStep {
  id: string;
  order: number;
  kind:
    | "warmup"
    | "vocab_review"
    | "verse_review"
    | "arabic_reading"
    | "new_passage"
    | "memorization"
    | "assessment";
  titleTr: string;
  descriptionTr: string;
  estimatedMinutes: number;
  href: string;
  priority: "overdue" | "core" | "new";
}

export interface DailyLearningPlan {
  mode: SessionMode;
  totalEstimatedMinutes: number;
  reviewSharePercent: number;
  newMaterialSharePercent: number;
  isRecoverySuggested: boolean;
  recoveryMessageTr: string | null;
  dueCardsCount: number;
  overdueVersesCount: number;
  steps: DailyPlanStep[];
}

export interface PlannerContext {
  requestedMode: SessionMode;
  cards: StoredLearningCard[];
  verseStates: Array<{ verseKey: string; memorizationState: MemorizationState }>;
  currentPageNumber: number;
  daysSinceLastStudy: number;
  placementCompleted: boolean;
  now?: Date;
}

export function buildDailyLearningPlan(ctx: PlannerContext): DailyLearningPlan {
  const now = ctx.now ?? new Date();
  const dueCards = prioritizeDueCards(ctx.cards, now);
  const overdueVerses = ctx.verseStates.filter(
    (v) => v.memorizationState === "needs_revision"
  );
  const unmemorizedVerses = ctx.verseStates.filter(
    (v) => v.memorizationState === "not_started" || v.memorizationState === "learning"
  );

  const isRecoverySuggested = ctx.daysSinceLastStudy >= 2 || ctx.requestedMode === "recovery";
  const effectiveMode: SessionMode =
    ctx.requestedMode === "recovery" ? "recovery" : ctx.requestedMode;

  const recoveryMessageTr =
    ctx.daysSinceLastStudy >= 2
      ? `${ctx.daysSinceLastStudy} gündür ara vermişsiniz — hiç sorun değil. Yığılmayı önlemek için önce kritik tekrarları içeren 4 dakikalık sakin bir toparlanma oturumu öneriyoruz.`
      : effectiveMode === "recovery"
        ? "Bugün kısa bir 3–5 dakikalık minimum çaba oturumu seçildi. Küçük ama tutarlı bir adım yeterlidir."
        : null;

  if (effectiveMode === "recovery") {
    const steps: DailyPlanStep[] = [
      {
        id: "step-recovery-review",
        order: 1,
        kind: "vocab_review",
        titleTr: `Öncelikli Tekrar (${Math.min(6, Math.max(3, dueCards.length))} kart)`,
        descriptionTr: "En çok unutulma riski taşıyan kelimeleri ve harf kavramlarını tazeleyin.",
        estimatedMinutes: 2,
        href: "/review?mode=recovery",
        priority: "overdue",
      },
      {
        id: "step-recovery-verse",
        order: 2,
        kind: "verse_review",
        titleTr:
          overdueVerses.length > 0
            ? `Tekrar Bekleyen Ayet (${overdueVerses[0]?.verseKey})`
            : `Sayfa ${ctx.currentPageNumber} — 1 Ayet Dinle ve Oku`,
        descriptionTr: "Mushaf'ta tek bir ayeti sesli dinleyip kelime anlamını hatırlayın.",
        estimatedMinutes: 2,
        href: `/mushaf?page=${ctx.currentPageNumber}`,
        priority: overdueVerses.length > 0 ? "overdue" : "core",
      },
    ];

    return {
      mode: "recovery",
      totalEstimatedMinutes: 4,
      reviewSharePercent: 100,
      newMaterialSharePercent: 0,
      isRecoverySuggested,
      recoveryMessageTr,
      dueCardsCount: dueCards.length,
      overdueVersesCount: overdueVerses.length,
      steps,
    };
  }

  const isIntensive = effectiveMode === "intensive";
  const steps: DailyPlanStep[] = [];
  let order = 1;

  // Always open with a one-minute, audio-first warm-up: an easy first win.
  steps.push({
    id: "step-warmup",
    order: order++,
    kind: "warmup",
    titleTr: "1 dakikalık ısınma: dinle ve tanı",
    descriptionTr: "Hocanın sesinden bugünkü sayfadan üç kelime: dinle, tanı, anlamını seç.",
    estimatedMinutes: 1,
    href: "/warmup",
    priority: "core",
  });

  if (dueCards.length > 0) {
    steps.push({
      id: "step-vocab-review",
      order: order++,
      kind: "vocab_review",
      titleTr: `Kelime ve Kavram Tekrarı (${Math.min(isIntensive ? 18 : 10, dueCards.length)} kart)`,
      descriptionTr: "Aralıklı tekrar (FSRS) ile gecikmiş kelime ve okuma kartlarını gözden geçirin.",
      estimatedMinutes: isIntensive ? 7 : 5,
      href: "/review",
      priority: "overdue",
    });
  }

  if (overdueVerses.length > 0 || ctx.verseStates.some((v) => v.memorizationState !== "not_started")) {
    steps.push({
      id: "step-verse-review",
      order: order++,
      kind: "verse_review",
      titleTr: "Önceki Ayetlerin Pekiştirilmesi",
      descriptionTr:
        overdueVerses.length > 0
          ? `${overdueVerses.length} ayette hatırlama zayıflaması var; yeni ezberden önce bunları pekiştirin.`
          : "Daha önce çalıştığınız ayetleri bakmadan hatırlama testiyle sağlamlaştırın.",
      estimatedMinutes: isIntensive ? 8 : 5,
      href: "/memorization?tab=review",
      priority: overdueVerses.length > 0 ? "overdue" : "core",
    });
  }

  // Only introduce new material proportionally after prioritizing overdue reviews
  const hasHeavyOverdueBacklog = dueCards.length > 20 || overdueVerses.length >= 4;
  if (!hasHeavyOverdueBacklog || isIntensive) {
    steps.push({
      id: "step-new-passage",
      order: order++,
      kind: "new_passage",
      titleTr:
        ctx.currentPageNumber === 1
          ? "Sayfa 1: Fâtiha Dinleme, Okuma ve Kelime Analizi"
          : `Sayfa ${ctx.currentPageNumber}: Mushaf Dinleme, Okuma ve Kelime Analizi`,
      descriptionTr:
        "Kâri'yi dinleyin, Arapça metni takip edin, kelimelere dokunup kök ve Türkçe anlamlarını inceleyin.",
      estimatedMinutes: isIntensive ? 10 : 5,
      href: `/mushaf?page=${ctx.currentPageNumber}`,
      priority: "new",
    });

    if (unmemorizedVerses.length > 0) {
      steps.push({
        id: "step-memorize-new",
        order: order++,
        kind: "memorization",
        titleTr: `Aktif Ezber: ${unmemorizedVerses[0]?.verseKey ?? "1:1"} Ayeti`,
        descriptionTr: "Kelime gizleme ve boşluk doldurma ile aktif geri çağırma pratiği yapın.",
        estimatedMinutes: isIntensive ? 7 : 4,
        href: "/memorization",
        priority: "new",
      });
    }
  }

  // The placement test is useful but long; offer it last so it never blocks starting.
  if (!ctx.placementCompleted) {
    steps.push({
      id: "step-placement",
      order: order++,
      kind: "assessment",
      titleTr: "İsteğe bağlı: 6 soruluk seviye testi",
      descriptionTr: "Bildiğin konuları atlamak için kısa bir test; istediğin gün yapabilirsin.",
      estimatedMinutes: 3,
      href: "/learn-arabic?placement=1",
      priority: "core",
    });
  }

  const totalMinutes = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const reviewMinutes = steps
    .filter((s) => s.kind === "vocab_review" || s.kind === "verse_review")
    .reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const reviewSharePercent =
    totalMinutes > 0 ? Math.round((reviewMinutes / totalMinutes) * 100) : 60;

  return {
    mode: effectiveMode,
    totalEstimatedMinutes: totalMinutes,
    reviewSharePercent,
    newMaterialSharePercent: 100 - reviewSharePercent,
    isRecoverySuggested,
    recoveryMessageTr,
    dueCardsCount: dueCards.length,
    overdueVersesCount: overdueVerses.length,
    steps,
  };
}
