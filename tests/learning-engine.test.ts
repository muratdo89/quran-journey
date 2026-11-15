import { describe, expect, it } from "vitest";
import {
  buildDailyLearningPlan,
  calculateIndependentPillarScores,
  createInitialCardRecord,
  evaluatePlacementAssessment,
  prioritizeDueCards,
  scheduleCardReview,
  transitionMemorizationState,
} from "@/lib/learning-engine";
import { PLACEMENT_QUESTIONS } from "@/lib/content/arabic-curriculum";

describe("FSRS Scheduler & Prioritization", () => {
  it("schedules Good/Easy reviews forward and increments lapses when a graduated Review card fails", () => {
    const t0 = new Date("2026-11-14T10:00:00.000Z");
    const card = createInitialCardRecord("c1", "vocabulary", "1:1:1", "ar_to_tr", t0);

    // Graduate directly to Review state with Easy (4)
    const easyRes = scheduleCardReview(card, 4, t0);
    expect(easyRes.wasCorrect).toBe(true);
    expect(easyRes.updatedCard.reps).toBe(1);
    expect(new Date(easyRes.updatedCard.dueAt).getTime()).toBeGreaterThan(t0.getTime());

    // Failing a graduated Review card increments lapses
    const againRes = scheduleCardReview(
      easyRes.updatedCard,
      1,
      new Date("2026-11-18T12:00:00.000Z")
    );
    expect(againRes.wasCorrect).toBe(false);
    expect(againRes.updatedCard.lapses).toBe(1);
  });

  it("prioritizes lapsed overdue cards ahead of fresh cards", () => {
    const now = new Date("2026-11-14T12:00:00.000Z");
    const freshDue = createInitialCardRecord("fresh", "vocabulary", "1:1:1", "ar_to_tr", now);
    const lapsedDue = {
      ...createInitialCardRecord("lapsed", "vocabulary", "1:1:2", "ar_to_tr", now),
      lapses: 2,
    };
    const prioritized = prioritizeDueCards([freshDue, lapsedDue], now);
    expect(prioritized[0]?.id).toBe("lapsed");
  });
});

describe("5-Pillar Mastery Independence & Hifz State Machine", () => {
  it("keeps each learning dimension independent", () => {
    const scores = calculateIndependentPillarScores({
      readingModulesCompleted: 6,
      totalReadingModules: 6,
      placementScorePercent: 100,
      tajweedLessonsPracticed: 0,
      totalTajweedLessons: 4,
      recordedVersesCount: 0,
      wordProgress: [],
      totalVocabularyTarget: 29,
      verseProgress: [],
      totalVersesTarget: 7,
    });

    expect(scores.arabicReading).toBe(100);
    expect(scores.vocabulary).toBe(0);
    expect(scores.memorization).toBe(0);
    expect(scores.comprehension).toBe(0);
  });

  it("requires delayed clean recall to reach stable_memorization and marks failures as needs_revision", () => {
    let state = transitionMemorizationState("not_started", "clean_recall");
    expect(state).toBe("learning");
    state = transitionMemorizationState(state, "clean_recall");
    expect(state).toBe("practicing");
    state = transitionMemorizationState(state, "clean_recall");
    expect(state).toBe("provisional_mastery");
    // Immediate clean recall does not jump straight to stable_memorization
    state = transitionMemorizationState(state, "clean_recall");
    expect(state).toBe("provisional_mastery");
    // Delayed clean recall earns stable_memorization
    state = transitionMemorizationState(state, "delayed_clean_recall");
    expect(state).toBe("stable_memorization");
    // Failed recall moves to needs_revision
    state = transitionMemorizationState(state, "failed_recall");
    expect(state).toBe("needs_revision");
  });
});

describe("Adaptive Session Planner & Placement Evaluation", () => {
  it("opens with the one-minute warm-up and keeps the placement test last", () => {
    const now = new Date("2026-11-15T12:00:00.000Z");
    const plan = buildDailyLearningPlan({
      requestedMode: "normal",
      cards: [createInitialCardRecord("c1", "vocabulary", "1:1:1", "ar_to_tr", now)],
      verseStates: [{ verseKey: "1:1", memorizationState: "not_started" }],
      currentPageNumber: 1,
      daysSinceLastStudy: 0,
      placementCompleted: false,
      now,
    });

    expect(plan.steps[0]?.id).toBe("step-warmup");
    expect(plan.steps[0]?.href).toBe("/warmup");
    expect(plan.steps[0]?.estimatedMinutes).toBe(1);
    expect(plan.steps.at(-1)?.id).toBe("step-placement");
  });

  it("offers a calm 3-5 min recovery suggestion after missed days without guilt", () => {
    const now = new Date("2026-11-14T12:00:00.000Z");
    const cards = [createInitialCardRecord("c1", "vocabulary", "1:1:1", "ar_to_tr", now)];
    const plan = buildDailyLearningPlan({
      requestedMode: "recovery",
      cards,
      verseStates: [{ verseKey: "1:1", memorizationState: "needs_revision" }],
      currentPageNumber: 1,
      daysSinceLastStudy: 3,
      placementCompleted: true,
      now,
    });

    expect(plan.isRecoverySuggested).toBe(true);
    expect(plan.totalEstimatedMinutes).toBeLessThanOrEqual(5);
    expect(plan.reviewSharePercent).toBe(100);
    expect(plan.recoveryMessageTr).toContain("3 gündür");
  });

  it("skips mastered beginner reading modules when placement score is high", () => {
    const allCorrectAnswers: Record<string, string> = {};
    for (const q of PLACEMENT_QUESTIONS) {
      const correctOpt = q.options.find((o) => o.isCorrect);
      if (correctOpt) allCorrectAnswers[q.id] = correctOpt.id;
    }

    const evaluation = evaluatePlacementAssessment({ answers: allCorrectAnswers });
    expect(evaluation.scorePercent).toBe(100);
    expect(evaluation.weakCategories).toHaveLength(0);
    expect(evaluation.masteredCategories.length).toBeGreaterThanOrEqual(5);
  });
});
