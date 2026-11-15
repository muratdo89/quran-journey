import { describe, expect, it } from "vitest";
import { buildWarmup, looksEnglishGloss } from "@/lib/content/warmup";

describe("one-minute warm-up", () => {
  it("builds listen / which-heard / meaning rounds from real word audio on the page", () => {
    const w = buildWarmup(1, new Date("2026-11-15T10:00:00Z"));
    expect(w).not.toBeNull();
    expect(w!.rounds.map((r) => r.kind)).toEqual(["listen", "which_heard", "meaning"]);
    for (const r of w!.rounds) expect(r.word.audioUrl).toMatch(/^https:\/\/audio\.qurancdn\.com\/wbw\//);

    const heard = w!.rounds[1]!;
    if (heard.kind !== "which_heard") throw new Error("round 2");
    expect(heard.options).toHaveLength(3);
    expect(heard.options.map((o) => o.textUthmani)).toContain(heard.word.textUthmani);

    const meaning = w!.rounds[2]!;
    if (meaning.kind !== "meaning") throw new Error("round 3");
    expect(new Set(meaning.options).size).toBe(3);
    expect(meaning.options).toContain(meaning.word.translationTr);
    expect(w!.practisedLocations).toHaveLength(3);
  });

  it("is stable within a day so a reload does not reshuffle", () => {
    const a = buildWarmup(50, new Date("2026-11-15T08:00:00Z"));
    const b = buildWarmup(50, new Date("2026-11-15T09:00:00Z"));
    expect(a).toEqual(b);
  });

  it("flags English fallback glosses but keeps Turkish ones", () => {
    expect(looksEnglishGloss("their hearts")).toBe(true);
    expect(looksEnglishGloss("müttakiler için")).toBe(false);
    expect(looksEnglishGloss("Rahman")).toBe(false);
  });
});
