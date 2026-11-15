import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type Grade,
  Rating,
  State,
} from "ts-fsrs";

export type CardType = "vocabulary" | "verse" | "reading_concept" | "tajweed";
export type CardDirection = "ar_to_tr" | "tr_to_ar" | "recall" | "recognition";
export type ReviewRating = 1 | 2 | 3 | 4;

/**
 * Learner-chosen next review time. Each choice still feeds FSRS a grade (so stability and
 * difficulty keep learning), but the due date is exactly what the learner picked.
 * "learned" retires the card: it is pushed ~10 years out and no longer shows in reviews.
 */
export type ReviewChoice = "1h" | "1d" | "1w" | "1m" | "learned";

export const REVIEW_CHOICES: Record<
  ReviewChoice,
  { rating: ReviewRating; minutes: number; labelTr: string }
> = {
  "1h": { rating: 1, minutes: 60, labelTr: "1 saat sonra" },
  "1d": { rating: 2, minutes: 60 * 24, labelTr: "Yarın" },
  "1w": { rating: 3, minutes: 60 * 24 * 7, labelTr: "1 hafta sonra" },
  "1m": { rating: 4, minutes: 60 * 24 * 30, labelTr: "1 ay sonra" },
  learned: { rating: 4, minutes: 60 * 24 * 3650, labelTr: "Öğrenildi, artık sorulmayacak" },
};

export const RETIRED_AFTER_DAYS = 3000;

export function isRetiredCard(card: Pick<StoredLearningCard, "scheduledDays">): boolean {
  return card.scheduledDays >= RETIRED_AFTER_DAYS;
}

export interface StoredLearningCard {
  id: string;
  cardType: CardType;
  targetKey: string;
  direction: CardDirection;
  fsrsState: number;
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  learningSteps: number;
  lastReviewAt: string | null;
}

export interface ReviewScheduleResult {
  updatedCard: StoredLearningCard;
  wasCorrect: boolean;
  previousState: number;
  nextState: number;
  intervalLabelTr: string;
}

const schedulerParams = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: false,
  enable_short_term: true,
});

const fsrsEngine = fsrs(schedulerParams);

export function createInitialCardRecord(
  id: string,
  cardType: CardType,
  targetKey: string,
  direction: CardDirection,
  now: Date = new Date()
): StoredLearningCard {
  const empty = createEmptyCard(now);
  return {
    id,
    cardType,
    targetKey,
    direction,
    fsrsState: empty.state,
    dueAt: empty.due.toISOString(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsedDays: 0,
    scheduledDays: empty.scheduled_days,
    reps: empty.reps,
    lapses: empty.lapses,
    learningSteps: empty.learning_steps,
    lastReviewAt: empty.last_review ? empty.last_review.toISOString() : null,
  };
}

export function toFsrsCard(stored: StoredLearningCard): Card {
  return {
    due: new Date(stored.dueAt),
    stability: stored.stability,
    difficulty: stored.difficulty,
    scheduled_days: stored.scheduledDays,
    reps: stored.reps,
    lapses: stored.lapses,
    learning_steps: stored.learningSteps,
    state: stored.fsrsState as State,
    last_review: stored.lastReviewAt ? new Date(stored.lastReviewAt) : undefined,
  };
}

export function formatIntervalTurkish(dueAt: Date, now: Date): string {
  const diffMs = Math.max(0, dueAt.getTime() - now.getTime());
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)} dk`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} sa`;
  }
  const days = Math.round(hours / 24);
  if (days < 30) {
    return `${days} gün`;
  }
  const months = Math.round(days / 30);
  return `${months} ay`;
}

export function ratingToGrade(rating: ReviewRating): Grade {
  switch (rating) {
    case 1:
      return Rating.Again;
    case 2:
      return Rating.Hard;
    case 3:
      return Rating.Good;
    case 4:
      return Rating.Easy;
  }
}

export function previewIntervals(
  stored: StoredLearningCard,
  now: Date = new Date()
): Record<ReviewRating, string> {
  const card = toFsrsCard(stored);
  const outcomes = fsrsEngine.repeat(card, now);
  return {
    1: formatIntervalTurkish(outcomes[Rating.Again].card.due, now),
    2: formatIntervalTurkish(outcomes[Rating.Hard].card.due, now),
    3: formatIntervalTurkish(outcomes[Rating.Good].card.due, now),
    4: formatIntervalTurkish(outcomes[Rating.Easy].card.due, now),
  };
}

export function scheduleCardReview(
  stored: StoredLearningCard,
  rating: ReviewRating,
  now: Date = new Date(),
  choice?: ReviewChoice
): ReviewScheduleResult {
  const card = toFsrsCard(stored);
  const grade = ratingToGrade(rating);
  const nextOutcome = fsrsEngine.next(card, now, grade);
  const nextCard = nextOutcome.card;
  if (choice) {
    const picked = REVIEW_CHOICES[choice];
    nextCard.due = new Date(now.getTime() + picked.minutes * 60000);
    nextCard.scheduled_days = Math.floor(picked.minutes / (60 * 24));
  }

  const updatedCard: StoredLearningCard = {
    ...stored,
    fsrsState: nextCard.state,
    dueAt: nextCard.due.toISOString(),
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    elapsedDays: Math.max(
      0,
      stored.lastReviewAt
        ? Math.floor((now.getTime() - new Date(stored.lastReviewAt).getTime()) / 86400000)
        : 0
    ),
    scheduledDays: nextCard.scheduled_days,
    reps: nextCard.reps,
    lapses: nextCard.lapses,
    learningSteps: nextCard.learning_steps,
    lastReviewAt: now.toISOString(),
  };

  return {
    updatedCard,
    wasCorrect: rating >= 2,
    previousState: stored.fsrsState,
    nextState: nextCard.state,
    intervalLabelTr: choice ? REVIEW_CHOICES[choice].labelTr : formatIntervalTurkish(nextCard.due, now),
  };
}

export function isCardDue(card: StoredLearningCard, now: Date = new Date()): boolean {
  return new Date(card.dueAt).getTime() <= now.getTime();
}

export function prioritizeDueCards(
  cards: StoredLearningCard[],
  now: Date = new Date()
): StoredLearningCard[] {
  return cards
    .filter((c) => isCardDue(c, now))
    .sort((a, b) => {
      // Overdue & lapsed cards come first so forgotten material is rescued before new items.
      const aLapseWeight = a.lapses * 86400000;
      const bLapseWeight = b.lapses * 86400000;
      const aScore = new Date(a.dueAt).getTime() - aLapseWeight;
      const bScore = new Date(b.dueAt).getTime() - bLapseWeight;
      return aScore - bScore;
    });
}
