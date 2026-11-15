import { describe, expect, it } from "vitest";
import {
  DEFAULT_LISTEN_REPEAT_SETTINGS,
  MIN_REPEAT_PAUSE_MS,
  buildListenRepeatQueue,
  computeRepeatPauseMs,
  findNeighbourGroupStart,
  normalizeListenRepeatSettings,
  type ListenRepeatStep,
} from "../src/lib/audio/listen-repeat";
import { getVerseByKey } from "../src/lib/content/canonical-loader";

const fatiha = ["1:1", "1:2", "1:3"].map((k) => getVerseByKey(k)!);

function wordSteps(queue: ListenRepeatStep[]) {
  return queue.filter((s): s is Extract<ListenRepeatStep, { kind: "words" }> => s.kind === "words");
}

describe("listen and repeat queue", () => {
  it("plays every recorded word of the page from the start word, then the full verse", () => {
    const queue = buildListenRepeatQueue(fatiha, "1:1:1", {
      ...DEFAULT_LISTEN_REPEAT_SETTINGS,
      repeatCount: 1,
      groupSize: 1,
      scope: "page",
      playFullVerse: true,
    });
    const totalWords = fatiha.reduce((n, v) => n + v.words.length, 0);
    expect(wordSteps(queue)).toHaveLength(totalWords);
    expect(queue.filter((s) => s.kind === "verse").map((s) => s.verseKey)).toEqual([
      "1:1",
      "1:2",
      "1:3",
    ]);
    // Whole verse comes right after its last word.
    const firstVerseStep = queue.findIndex((s) => s.kind === "verse");
    expect(firstVerseStep).toBe(fatiha[0]!.words.length);
    // Real recorded word audio only (Quran.com word-by-word CDN).
    for (const step of wordSteps(queue)) {
      expect(step.words[0]!.audioUrl).toMatch(/^https:\/\/audio\.qurancdn\.com\/wbw\//);
    }
  });

  it("starts mid-verse, repeats each word and stays in the verse for the verse scope", () => {
    const queue = buildListenRepeatQueue(fatiha, "1:2:3", {
      repeatCount: 2,
      groupSize: 1,
      scope: "verse",
      playFullVerse: true,
    });
    const steps = wordSteps(queue);
    const remaining = fatiha[1]!.words.length - 2;
    expect(steps).toHaveLength(remaining * 2);
    expect(steps[0]!.words[0]!.location).toBe("1:2:3");
    expect(steps.map((s) => `${s.groupNumber}.${s.repeatIndex}`).slice(0, 4)).toEqual([
      "1.1",
      "1.2",
      "2.1",
      "2.2",
    ]);
    expect(steps.every((s) => s.verseKey === "1:2")).toBe(true);
    // The verse was started mid-way, but the full verse is still offered at its end.
    expect(queue[queue.length - 1]).toEqual({ kind: "verse", verseKey: "1:2" });
  });

  it("groups words into short phrases without crossing verse boundaries", () => {
    const queue = buildListenRepeatQueue(fatiha, null, {
      repeatCount: 1,
      groupSize: 3,
      scope: "page",
      playFullVerse: false,
    });
    const steps = wordSteps(queue);
    for (const step of steps) {
      expect(step.words.length).toBeGreaterThanOrEqual(1);
      expect(step.words.length).toBeLessThanOrEqual(3);
      expect(step.words.every((w) => w.location.startsWith(`${step.verseKey}:`))).toBe(true);
    }
    expect(steps[steps.length - 1]!.groupTotal).toBe(steps.length);
  });

  it("skips words that have no recording", () => {
    const verse = {
      verseKey: "9:9",
      words: [
        { ...fatiha[0]!.words[0]!, location: "9:9:1", position: 1 },
        { ...fatiha[0]!.words[1]!, location: "9:9:2", position: 2, audioUrl: null },
      ],
    };
    const queue = buildListenRepeatQueue([verse], null, {
      repeatCount: 1,
      groupSize: 1,
      scope: "page",
      playFullVerse: false,
    });
    expect(wordSteps(queue).map((s) => s.words[0]!.location)).toEqual(["9:9:1"]);
  });

  it("moves to neighbour word groups, skipping repeats of the same group", () => {
    const queue = buildListenRepeatQueue([fatiha[0]!], null, {
      repeatCount: 3,
      groupSize: 1,
      scope: "page",
      playFullVerse: true,
    });
    // Steps: g1 r1-3 (0..2), g2 r1-3 (3..5) ...
    expect(findNeighbourGroupStart(queue, 1, 1)).toBe(3);
    expect(findNeighbourGroupStart(queue, 4, -1)).toBe(0);
    expect(findNeighbourGroupStart(queue, 1, -1)).toBe(0);
    const last = queue.length - 1; // the whole-verse step
    expect(findNeighbourGroupStart(queue, last, 1)).toBe(queue.length);
  });
});

describe("listen and repeat timing and settings", () => {
  it("gives the learner time proportional to what they heard, within bounds", () => {
    expect(computeRepeatPauseMs(1200, "auto2")).toBe(2400);
    expect(computeRepeatPauseMs(1200, "auto3")).toBe(3600);
    expect(computeRepeatPauseMs(300, "auto1")).toBe(MIN_REPEAT_PAUSE_MS);
    expect(computeRepeatPauseMs(60000, "auto3")).toBe(15000);
    expect(computeRepeatPauseMs(Number.NaN, "auto2")).toBe(MIN_REPEAT_PAUSE_MS);
    expect(computeRepeatPauseMs(200, "fixed5")).toBe(5000);
  });

  it("normalizes stored settings field by field", () => {
    expect(normalizeListenRepeatSettings(null)).toEqual(DEFAULT_LISTEN_REPEAT_SETTINGS);
    expect(
      normalizeListenRepeatSettings({
        speed: 0.5,
        pause: "nope",
        repeatCount: 7,
        groupSize: 2,
        scope: "verse",
        playFullVerse: false,
      })
    ).toEqual({
      speed: 0.5,
      pause: DEFAULT_LISTEN_REPEAT_SETTINGS.pause,
      repeatCount: 1,
      groupSize: 2,
      scope: "verse",
      playFullVerse: false,
    });
  });
});
