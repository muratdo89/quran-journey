export type MemorizationState =
  | "not_started"
  | "learning"
  | "practicing"
  | "provisional_mastery"
  | "stable_memorization"
  | "needs_revision";

export interface PillarMasteryScores {
  arabicReading: number; // 0..100
  tajweed: number; // 0..100
  vocabulary: number; // 0..100
  comprehension: number; // 0..100
  memorization: number; // 0..100
}

export interface MasteryInputSnapshot {
  readingModulesCompleted: number;
  totalReadingModules: number;
  placementScorePercent: number | null;
  tajweedLessonsPracticed: number;
  totalTajweedLessons: number;
  recordedVersesCount: number;
  wordProgress: Array<{
    status: "new" | "learning" | "known" | "difficult";
    timesCorrect: number;
    timesMissed: number;
  }>;
  totalVocabularyTarget: number;
  verseProgress: Array<{
    memorizationState: MemorizationState;
    comprehensionScore: number;
  }>;
  totalVersesTarget: number;
}

export const MEMORIZATION_STATE_LABELS_TR: Record<MemorizationState, string> = {
  not_started: "Başlanmadı",
  learning: "Öğreniliyor",
  practicing: "Pekiştiriliyor",
  provisional_mastery: "Geçici Hâkimiyet",
  stable_memorization: "Kalıcı Ezber",
  needs_revision: "Tekrar Gerekiyor",
};

export function transitionMemorizationState(
  current: MemorizationState,
  outcome: "failed_recall" | "partial_recall" | "clean_recall" | "delayed_clean_recall"
): MemorizationState {
  if (outcome === "failed_recall") {
    if (
      current === "provisional_mastery" ||
      current === "stable_memorization" ||
      current === "practicing"
    ) {
      return "needs_revision";
    }
    return "learning";
  }

  if (outcome === "partial_recall") {
    if (current === "not_started" || current === "learning" || current === "needs_revision") {
      return "practicing";
    }
    if (current === "stable_memorization") {
      return "provisional_mastery";
    }
    return current;
  }

  if (outcome === "delayed_clean_recall") {
    if (current === "provisional_mastery" || current === "stable_memorization") {
      return "stable_memorization";
    }
    return "provisional_mastery";
  }

  // clean_recall (immediate practice)
  switch (current) {
    case "not_started":
      return "learning";
    case "learning":
    case "needs_revision":
      return "practicing";
    case "practicing":
      return "provisional_mastery";
    case "provisional_mastery":
      return "provisional_mastery"; // Requires delayed recall for stable_memorization
    case "stable_memorization":
      return "stable_memorization";
  }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateIndependentPillarScores(
  snapshot: MasteryInputSnapshot
): PillarMasteryScores {
  // 1. Arabic Reading (independent of vocabulary or memorization)
  const moduleRatio =
    snapshot.totalReadingModules > 0
      ? snapshot.readingModulesCompleted / snapshot.totalReadingModules
      : 0;
  const placementComponent =
    snapshot.placementScorePercent !== null ? snapshot.placementScorePercent * 0.45 : 0;
  const arabicReading = clampPercent(moduleRatio * 55 + placementComponent);

  // 2. Pronunciation & Tajweed (tracks discrimination & recording practice honestly; never claims 100% without verified evaluation)
  const tajweedRatio =
    snapshot.totalTajweedLessons > 0
      ? snapshot.tajweedLessonsPracticed / snapshot.totalTajweedLessons
      : 0;
  const recordingBonus = Math.min(20, snapshot.recordedVersesCount * 4);
  const tajweed = clampPercent(tajweedRatio * 65 + recordingBonus);

  // 3. Vocabulary (word-level known + learning ratio weighted by accuracy)
  const knownCount = snapshot.wordProgress.filter((w) => w.status === "known").length;
  const learningCount = snapshot.wordProgress.filter((w) => w.status === "learning").length;
  const vocabBase =
    snapshot.totalVocabularyTarget > 0
      ? ((knownCount + learningCount * 0.4) / snapshot.totalVocabularyTarget) * 100
      : 0;
  const vocabulary = clampPercent(vocabBase);

  // 4. Verse Comprehension (average verified verse comprehension across target verses)
  const comprehensionSum = snapshot.verseProgress.reduce(
    (sum, v) => sum + v.comprehensionScore,
    0
  );
  const comprehension =
    snapshot.totalVersesTarget > 0
      ? clampPercent(comprehensionSum / snapshot.totalVersesTarget)
      : 0;

  // 5. Memorization (never counts "not_started" or merely reading a page)
  const stateWeight: Record<MemorizationState, number> = {
    not_started: 0,
    learning: 0.2,
    needs_revision: 0.35,
    practicing: 0.5,
    provisional_mastery: 0.8,
    stable_memorization: 1.0,
  };
  const memPoints = snapshot.verseProgress.reduce(
    (sum, v) => sum + stateWeight[v.memorizationState],
    0
  );
  const memorization =
    snapshot.totalVersesTarget > 0
      ? clampPercent((memPoints / snapshot.totalVersesTarget) * 100)
      : 0;

  return {
    arabicReading,
    tajweed,
    vocabulary,
    comprehension,
    memorization,
  };
}
