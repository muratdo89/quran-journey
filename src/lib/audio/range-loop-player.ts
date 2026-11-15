import type { CanonicalVerse } from "@/lib/content/types";

export interface RangeLoopConfig {
  startVerseNumber: number;
  endVerseNumber: number;
  verseRepeatCount: number;
  rangeRepeatCount: number;
}

export interface RangePlaybackStep {
  verseKey: string;
  verseNumber: number;
  verseRepeatIndex: number;
  verseRepeatTotal: number;
  rangeRoundIndex: number;
  rangeRoundTotal: number;
  stepIndex: number;
  totalSteps: number;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function normalizeRangeLoopConfig(
  config: RangeLoopConfig,
  minVerse: number,
  maxVerse: number
): RangeLoopConfig {
  const low = Math.min(minVerse, maxVerse);
  const high = Math.max(minVerse, maxVerse);

  const clampedStart = clampInt(config.startVerseNumber, low, high);
  const clampedEnd = clampInt(config.endVerseNumber, low, high);

  return {
    startVerseNumber: Math.min(clampedStart, clampedEnd),
    endVerseNumber: Math.max(clampedStart, clampedEnd),
    verseRepeatCount: clampInt(config.verseRepeatCount, 1, 10),
    rangeRepeatCount: clampInt(config.rangeRepeatCount, 1, 10),
  };
}

export function buildRangePlaybackQueue(
  verses: Pick<CanonicalVerse, "verseKey" | "verseNumber">[],
  config: RangeLoopConfig
): RangePlaybackStep[] {
  if (verses.length === 0) return [];

  const sorted = [...verses].sort((a, b) => a.verseNumber - b.verseNumber);
  const minVerse = sorted[0]!.verseNumber;
  const maxVerse = sorted[sorted.length - 1]!.verseNumber;
  const normalized = normalizeRangeLoopConfig(config, minVerse, maxVerse);

  const targetVerses = sorted.filter(
    (v) =>
      v.verseNumber >= normalized.startVerseNumber &&
      v.verseNumber <= normalized.endVerseNumber
  );
  if (targetVerses.length === 0) return [];

  const totalSteps =
    targetVerses.length *
    normalized.verseRepeatCount *
    normalized.rangeRepeatCount;

  const queue: RangePlaybackStep[] = [];
  let stepIndex = 0;

  for (
    let rangeRoundIndex = 1;
    rangeRoundIndex <= normalized.rangeRepeatCount;
    rangeRoundIndex += 1
  ) {
    for (const verse of targetVerses) {
      for (
        let verseRepeatIndex = 1;
        verseRepeatIndex <= normalized.verseRepeatCount;
        verseRepeatIndex += 1
      ) {
        queue.push({
          verseKey: verse.verseKey,
          verseNumber: verse.verseNumber,
          verseRepeatIndex,
          verseRepeatTotal: normalized.verseRepeatCount,
          rangeRoundIndex,
          rangeRoundTotal: normalized.rangeRepeatCount,
          stepIndex,
          totalSteps,
        });
        stepIndex += 1;
      }
    }
  }

  return queue;
}
