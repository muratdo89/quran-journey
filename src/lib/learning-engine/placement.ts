import {
  ARABIC_READING_MODULES,
  PLACEMENT_QUESTIONS,
  type ArabicReadingSkillCategory,
} from "@/lib/content/arabic-curriculum";

export interface PlacementSubmission {
  answers: Record<string, string>; // questionId -> selectedOptionId
}

export interface PlacementEvaluation {
  score: number;
  maxScore: number;
  scorePercent: number;
  levelLabelTr: string;
  weakCategories: ArabicReadingSkillCategory[];
  masteredCategories: ArabicReadingSkillCategory[];
  recommendedModuleIds: string[];
  summaryTr: string;
  questionResults: Array<{
    questionId: string;
    category: ArabicReadingSkillCategory;
    isCorrect: boolean;
    explanationTr: string;
  }>;
}

export function evaluatePlacementAssessment(
  submission: PlacementSubmission
): PlacementEvaluation {
  let score = 0;
  const categoryStats = new Map<ArabicReadingSkillCategory, { correct: number; total: number }>();

  const questionResults = PLACEMENT_QUESTIONS.map((q) => {
    const selectedId = submission.answers[q.id];
    const selectedOpt = q.options.find((o) => o.id === selectedId);
    const isCorrect = Boolean(selectedOpt?.isCorrect);
    if (isCorrect) score += 1;

    const stat = categoryStats.get(q.category) ?? { correct: 0, total: 0 };
    stat.total += 1;
    if (isCorrect) stat.correct += 1;
    categoryStats.set(q.category, stat);

    return {
      questionId: q.id,
      category: q.category,
      isCorrect,
      explanationTr: q.explanationTr,
    };
  });

  const maxScore = PLACEMENT_QUESTIONS.length;
  const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  const weakCategories: ArabicReadingSkillCategory[] = [];
  const masteredCategories: ArabicReadingSkillCategory[] = [];

  for (const [category, stat] of categoryStats.entries()) {
    if (stat.correct < stat.total) {
      weakCategories.push(category);
    } else {
      masteredCategories.push(category);
    }
  }

  const recommendedModuleIds = ARABIC_READING_MODULES.filter((m) =>
    weakCategories.length > 0 ? weakCategories.includes(m.category) : m.order >= 5
  ).map((m) => m.id);

  let levelLabelTr = "Temel Tekrar";
  let summaryTr =
    "Temel harf tanıma ve birleşimlerde kısa bir tekrar ile kısa sürede Mushaf okumasına geçebilirsiniz.";

  if (scorePercent >= 85) {
    levelLabelTr = "Akıcı Okumaya Hazır";
    summaryTr =
      "Harf şekilleri, harekeler ve birleşimlerde güçlü bir temeliniz var. Sıfırdan başlamanıza gerek yok; doğrudan bağlantı kuralları ve Fâtiha tecvid çalışmasına odaklanıyoruz.";
  } else if (scorePercent >= 50) {
    levelLabelTr = "Orta Düzey — Seçici Pekiştirme";
    summaryTr =
      "Harflerin çoğunu tanıyorsunuz; yalnızca eksik çıkan başlıklarda (örneğin şedde, med veya bitişik okuma) hedefli dersler açıldı.";
  }

  return {
    score,
    maxScore,
    scorePercent,
    levelLabelTr,
    weakCategories,
    masteredCategories,
    recommendedModuleIds,
    summaryTr,
    questionResults,
  };
}
