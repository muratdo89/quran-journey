import { describe, expect, it } from "vitest";
import {
  EMPTY_HIFZ_STORE,
  allowAnotherNewPart,
  buildQueue,
  buildTodayPlan,
  completeNewPart,
  importLegacyPages,
  manzilQuota,
  normalizeHifzStore,
  ratePage,
  saveSettings,
  splitIntoChunks,
  splitIntoParts,
  type HifzStore,
} from "@/lib/hifz/plan";

const amme = saveSettings(EMPTY_HIFZ_STORE, { startPage: 604, direction: "backward", dailyParts: 2 });

describe("splitting a page", () => {
  it("splits into balanced consecutive parts, never more parts than verses", () => {
    expect(splitIntoParts([10, 10, 10, 10], 2)).toEqual([[0, 1], [2, 3]]);
    expect(splitIntoParts([50, 10, 10, 10, 10], 2)).toEqual([[0], [1, 2, 3, 4]]);
    expect(splitIntoParts([10, 10], 4)).toEqual([[0], [1]]);
    expect(splitIntoParts([5, 5, 5, 5, 5, 5, 5, 5], 4)).toEqual([[0, 1], [2, 3], [4, 5], [6, 7]]);
  });

  it("makes chunks of at most 5 verses and keeps a long verse alone", () => {
    expect(splitIntoChunks([0, 1, 2, 3, 4, 5, 6], [20, 20, 20, 20, 20, 20, 20])).toEqual([[0, 1, 2, 3, 4], [5, 6]]);
    expect(splitIntoChunks([0, 1, 2], [40, 400, 40])).toEqual([[0], [1], [2]]);
    // A new surah starts a new chunk.
    expect(splitIntoChunks([0, 1, 2, 3], [10, 10, 10, 10], new Set([2]))).toEqual([[0, 1], [2, 3]]);
  });
});

describe("today's plan", () => {
  it("starts at page 604 going backward, half a page a day", () => {
    const plan = buildTodayPlan(amme, "2026-11-16");
    expect(plan.newLesson).toEqual({ page: 604, partIndex: 0, partCount: 2, isRelearn: false });
    expect(plan.recent).toEqual([]);
    expect(plan.manzil).toEqual([]);
  });

  it("does the second half the next day, then moves to the previous page", () => {
    let s = completeNewPart(amme, { page: 604, partIndex: 0, partCount: 2, isRelearn: false }, "2026-11-16");
    expect(buildTodayPlan(s, "2026-11-16").newLesson).toBeNull();
    expect(buildTodayPlan(s, "2026-11-17").newLesson).toMatchObject({ page: 604, partIndex: 1 });
    s = ratePage(s, 604, "akici", { fromNewLesson: true, partCount: 2 }, "2026-11-17");
    const next = buildTodayPlan(s, "2026-11-18");
    expect(next.newLesson).toMatchObject({ page: 603, partIndex: 0 });
    expect(next.recent).toEqual([604]);
  });

  it("blocks the new page while a recent page is weak, and puts it first", () => {
    let s = ratePage(amme, 604, "takildim", { fromNewLesson: true, partCount: 2 }, "2026-11-16");
    const plan = buildTodayPlan(s, "2026-11-17");
    expect(plan.blockedBy).toEqual([604]);
    expect(plan.newLesson).toBeNull();
    expect(buildQueue(plan)[0]).toEqual({ kind: "recent", page: 604 });
    s = ratePage(s, 604, "akici", {}, "2026-11-17");
    const after = buildTodayPlan(s, "2026-11-17");
    expect(after.newLesson).toMatchObject({ page: 603 });
    expect(after.recent).toEqual([]);
    expect(after.reviewedToday).toBe(1);
  });

  it("sends a forgotten page back to learning from the first part", () => {
    let s = ratePage(amme, 604, "akici", { fromNewLesson: true, partCount: 2 }, "2026-11-10");
    s = ratePage(s, 604, "unuttum", {}, "2026-11-12");
    expect(s.pages[604]).toMatchObject({ status: "learning", partsDone: 0 });
    expect(buildTodayPlan(s, "2026-11-13").newLesson).toMatchObject({ page: 604, partIndex: 0, isRelearn: true });
  });

  it("rotates older pages through manzil with a stable daily quota, weakest first", () => {
    const pages: HifzStore["pages"] = {};
    for (let p = 590; p <= 604; p++) {
      pages[p] = {
        status: "memorized",
        partsDone: 1,
        partCount: 1,
        memorizedOn: "2026-10-01",
        lastReviewedOn: `2026-11-${String(p - 589).padStart(2, "0")}`,
      };
    }
    pages[600] = { ...pages[600]!, weak: true };
    const s: HifzStore = { ...amme, pages };
    expect(manzilQuota(15)).toBe(3);
    const plan = buildTodayPlan(s, "2026-11-20");
    expect(plan.manzil).toEqual([600, 590, 591]);
    const after = ratePage(s, 600, "akici", {}, "2026-11-20");
    expect(buildTodayPlan(after, "2026-11-20").manzil).toEqual([590, 591]);
  });

  it("lets the learner take one more part on the same day", () => {
    const s = completeNewPart(amme, { page: 604, partIndex: 0, partCount: 2, isRelearn: false }, "2026-11-16");
    expect(buildTodayPlan(allowAnotherNewPart(s), "2026-11-16").newLesson).toMatchObject({ page: 604, partIndex: 1 });
  });

  it("brings over pages memorized on the old Ezber page once, into older review", () => {
    const s = ratePage(amme, 604, "akici", { fromNewLesson: true, partCount: 2 }, "2026-11-15");
    const imported = importLegacyPages(s, [604, 1, 2, 999], "2026-11-16");
    expect(imported.importedLegacy).toBe(true);
    expect(imported.pages[604]!.memorizedOn).toBe("2026-11-15");
    expect(imported.pages[1]).toMatchObject({ status: "memorized", memorizedOn: "2026-11-09" });
    expect(imported.pages[999]).toBeUndefined();
    const plan = buildTodayPlan(imported, "2026-11-16");
    expect(plan.recent).toEqual([604]);
    expect(plan.manzil).toEqual([1]);
    expect(importLegacyPages(imported, [3], "2026-11-16")).toBe(imported);
  });

  it("ignores broken stored data", () => {
    expect(normalizeHifzStore("x")).toEqual(EMPTY_HIFZ_STORE);
    const n = normalizeHifzStore({
      settings: { startPage: 999 },
      pages: { 0: {}, 5: { status: "memorized", partsDone: 1, partCount: 1 } },
    });
    expect(n.settings).toBeNull();
    expect(Object.keys(n.pages)).toEqual(["5"]);
  });
});
