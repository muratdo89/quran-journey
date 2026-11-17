import { describe, expect, it } from "vitest";
import { getWordsPage } from "@/lib/content/canonical-loader";

describe("vocabulary word list", () => {
  it("lists only the words on one Mushaf page", () => {
    const res = getWordsPage({ mushafPage: 604, pageSize: 48 });
    expect(res.total).toBeGreaterThan(0);
    expect(res.items.every((w) => w.pageNumber === 604)).toBe(true);
  });

  it("collapses repeated words with a count", () => {
    const all = getWordsPage({ surahId: 112, pageSize: 48 });
    const unique = getWordsPage({ surahId: 112, unique: true, pageSize: 48 });
    expect(unique.total).toBeLessThan(all.total);
    const sum = unique.items.reduce((n, w) => n + (w.count ?? 1), 0);
    expect(sum).toBe(all.total);
  });
});
