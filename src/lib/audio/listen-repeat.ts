import type { CanonicalVerse } from "@/lib/content/types";

/**
 * "Dinle ve tekrar et" (listen and repeat): the qari's own word-by-word recording
 * plays one word (or a small group of words), then the app waits so the learner
 * can repeat it aloud, then moves on. Only real recorded audio is used — never TTS.
 */

export type ListenRepeatPauseId = "auto1" | "auto2" | "auto3" | "fixed3" | "fixed5";
export type ListenRepeatScope = "verse" | "page";

export interface ListenRepeatSettings {
  /** Playback rate for the word recordings (pitch is preserved by the browser). */
  speed: number;
  /** How long to wait for the learner after each listen. */
  pause: ListenRepeatPauseId;
  /** How many times each word/group is heard (each followed by a pause). */
  repeatCount: number;
  /** Words per step: 1 = word by word, 2–3 = short phrases. */
  groupSize: number;
  /** Stop at the end of the starting verse, or continue to the end of the page. */
  scope: ListenRepeatScope;
  /** After the last word of a verse, play the whole verse once with the chosen reciter. */
  playFullVerse: boolean;
}

export const LISTEN_REPEAT_SPEEDS = [0.5, 0.75, 1] as const;
export const LISTEN_REPEAT_REPEATS = [1, 2, 3] as const;
export const LISTEN_REPEAT_GROUP_SIZES = [1, 2, 3] as const;

export const LISTEN_REPEAT_PAUSES: readonly { id: ListenRepeatPauseId; labelTr: string }[] = [
  { id: "auto1", labelTr: "Kelime kadar" },
  { id: "auto2", labelTr: "2 katı" },
  { id: "auto3", labelTr: "3 katı" },
  { id: "fixed3", labelTr: "3 sn" },
  { id: "fixed5", labelTr: "5 sn" },
];

export const DEFAULT_LISTEN_REPEAT_SETTINGS: ListenRepeatSettings = {
  speed: 0.75,
  pause: "auto2",
  repeatCount: 1,
  groupSize: 1,
  scope: "page",
  playFullVerse: true,
};

/** Never give the learner less than this to start speaking. */
export const MIN_REPEAT_PAUSE_MS = 1500;
const MAX_REPEAT_PAUSE_MS = 15000;

function pickAllowed<T extends number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "number" && (allowed as readonly number[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Turns stored/untrusted input into valid settings, falling back to defaults per field. */
export function normalizeListenRepeatSettings(raw: unknown): ListenRepeatSettings {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_LISTEN_REPEAT_SETTINGS;
  return {
    speed: pickAllowed(input.speed, LISTEN_REPEAT_SPEEDS, d.speed as 0.75),
    pause: LISTEN_REPEAT_PAUSES.some((p) => p.id === input.pause)
      ? (input.pause as ListenRepeatPauseId)
      : d.pause,
    repeatCount: pickAllowed(input.repeatCount, LISTEN_REPEAT_REPEATS, 1),
    groupSize: pickAllowed(input.groupSize, LISTEN_REPEAT_GROUP_SIZES, 1),
    scope: input.scope === "verse" || input.scope === "page" ? input.scope : d.scope,
    playFullVerse: typeof input.playFullVerse === "boolean" ? input.playFullVerse : d.playFullVerse,
  };
}

/**
 * Silence after a listen. "auto" pauses scale with how long the learner actually
 * heard the qari (already slowed down by the playback speed), so long words get
 * more time than short ones.
 */
export function computeRepeatPauseMs(listenedMs: number, pause: ListenRepeatPauseId): number {
  let ms: number;
  switch (pause) {
    case "fixed3":
      return 3000;
    case "fixed5":
      return 5000;
    case "auto1":
      ms = listenedMs * 1;
      break;
    case "auto3":
      ms = listenedMs * 3;
      break;
    case "auto2":
    default:
      ms = listenedMs * 2;
      break;
  }
  const safe = Number.isFinite(ms) ? ms : 0;
  return Math.round(Math.min(MAX_REPEAT_PAUSE_MS, Math.max(MIN_REPEAT_PAUSE_MS, safe)));
}

export interface ListenRepeatWord {
  location: string;
  position: number;
  textUthmani: string;
  transliteration: string | null;
  audioUrl: string;
}

export type ListenRepeatStep =
  | {
      kind: "words";
      verseKey: string;
      words: ListenRepeatWord[];
      repeatIndex: number;
      repeatTotal: number;
      /** 1-based index of this word group among all groups in the queue. */
      groupNumber: number;
      groupTotal: number;
    }
  | {
      kind: "verse";
      verseKey: string;
    };

type QueueVerse = Pick<CanonicalVerse, "verseKey" | "words">;

/**
 * Builds the step list starting at `startLocation` (a word location like "2:5:3").
 * Words without a recording are skipped. When the start word is not found the
 * queue starts at the first verse.
 */
export function buildListenRepeatQueue(
  verses: QueueVerse[],
  startLocation: string | null,
  settings: Pick<ListenRepeatSettings, "repeatCount" | "groupSize" | "scope" | "playFullVerse">
): ListenRepeatStep[] {
  if (verses.length === 0) return [];

  let startVerseIndex = 0;
  let startWordIndex = 0;
  if (startLocation) {
    for (let vi = 0; vi < verses.length; vi += 1) {
      const wi = verses[vi]!.words.findIndex((w) => w.location === startLocation);
      if (wi >= 0) {
        startVerseIndex = vi;
        startWordIndex = wi;
        break;
      }
    }
  }

  const lastVerseIndex = settings.scope === "verse" ? startVerseIndex : verses.length - 1;
  const repeatTotal = Math.max(1, Math.round(settings.repeatCount));
  const groupSize = Math.max(1, Math.round(settings.groupSize));

  const perVerse: { verseKey: string; groups: ListenRepeatWord[][]; complete: boolean }[] = [];
  for (let vi = startVerseIndex; vi <= lastVerseIndex; vi += 1) {
    const verse = verses[vi]!;
    const fromIndex = vi === startVerseIndex ? startWordIndex : 0;
    const playable: ListenRepeatWord[] = verse.words
      .slice(fromIndex)
      .filter((w) => Boolean(w.audioUrl))
      .map((w) => ({
        location: w.location,
        position: w.position,
        textUthmani: w.textUthmani,
        transliteration: w.transliteration,
        audioUrl: w.audioUrl!,
      }));
    const groups: ListenRepeatWord[][] = [];
    for (let i = 0; i < playable.length; i += groupSize) {
      groups.push(playable.slice(i, i + groupSize));
    }
    perVerse.push({ verseKey: verse.verseKey, groups, complete: fromIndex === 0 });
  }

  const groupTotal = perVerse.reduce((sum, v) => sum + v.groups.length, 0);
  const queue: ListenRepeatStep[] = [];
  let groupNumber = 0;
  for (const verse of perVerse) {
    for (const words of verse.groups) {
      groupNumber += 1;
      for (let r = 1; r <= repeatTotal; r += 1) {
        queue.push({
          kind: "words",
          verseKey: verse.verseKey,
          words,
          repeatIndex: r,
          repeatTotal,
          groupNumber,
          groupTotal,
        });
      }
    }
    if (settings.playFullVerse && verse.groups.length > 0) {
      queue.push({ kind: "verse", verseKey: verse.verseKey });
    }
  }
  return queue;
}

/**
 * Index of the first step of the previous/next word group (repeats of one group are
 * skipped together). Moving forward from the last step returns queue.length.
 */
export function findNeighbourGroupStart(
  queue: ListenRepeatStep[],
  currentIndex: number,
  direction: -1 | 1
): number {
  if (queue.length === 0) return 0;
  const clamp = (i: number) => Math.max(0, Math.min(queue.length - 1, i));
  const startOf = (i: number) => {
    let j = clamp(i);
    const step = queue[j]!;
    if (step.kind !== "words") return j;
    while (j > 0) {
      const prev = queue[j - 1]!;
      if (prev.kind !== "words" || prev.groupNumber !== step.groupNumber) break;
      j -= 1;
    }
    return j;
  };

  const currentStart = startOf(currentIndex);
  if (direction === -1) {
    return currentStart === 0 ? 0 : startOf(currentStart - 1);
  }
  let j = currentStart + 1;
  const current = queue[currentStart]!;
  while (
    j < queue.length &&
    current.kind === "words" &&
    queue[j]!.kind === "words" &&
    (queue[j] as Extract<ListenRepeatStep, { kind: "words" }>).groupNumber === current.groupNumber
  ) {
    j += 1;
  }
  // May equal queue.length, meaning "past the end".
  return Math.min(j, queue.length);
}
