import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteProgressRepository } from "@/lib/db/sqlite-repository";

const tempDirs: string[] = [];

function createTempRepo(): { repo: SqliteProgressRepository; dbPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qj-test-"));
  tempDirs.push(dir);
  const dbPath = path.join(dir, "test.db");
  return { repo: new SqliteProgressRepository(dbPath), dbPath };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("SqliteProgressRepository Integration", () => {
  it("seeds Fatiha starter cards and persists FSRS reviews across restarts", async () => {
    const { repo, dbPath } = createTempRepo();
    const initial = await repo.getDashboardSnapshot();
    expect(initial.cards.length).toBeGreaterThanOrEqual(10);
    expect(initial.verseProgress).toHaveLength(7);
    expect(initial.verseProgress.every((v) => v.memorizationState === "not_started")).toBe(true);

    const firstCard = initial.cards[0]!;
    const reviewRes = await repo.submitCardReview({ cardId: firstCard.id, rating: 3 });
    expect(reviewRes.xpAwarded).toBeGreaterThan(0);
    expect(reviewRes.updatedCard.reps).toBe(1);
    repo.close();

    // Reopen from disk to confirm real relational persistence
    const reopened = new SqliteProgressRepository(dbPath);
    const after = await reopened.getDashboardSnapshot();
    const reloadedCard = after.cards.find((c) => c.id === firstCard.id);
    expect(reloadedCard?.reps).toBe(1);
    expect(after.totalXp).toBe(reviewRes.xpAwarded);
    expect(after.achievements.some((a) => a.badgeCode === "first_recall")).toBe(true);
    reopened.close();
  });

  it("persists memorization transitions, bookmarks, notes, and recording deletion", async () => {
    const { repo } = createTempRepo();

    const v1 = await repo.updateVerseMemorization({ verseKey: "1:1", outcome: "clean_recall" });
    expect(v1.memorizationState).toBe("learning");

    const bm = await repo.toggleBookmark({ verseKey: "1:1", pageNumber: 1, label: "Başlangıç" });
    expect(bm.bookmarked).toBe(true);

    const note = await repo.saveNote({
      verseKey: "1:7",
      pageNumber: 1,
      noteText: "Medd-i Lazım 6 hareke",
      isDifficult: true,
    });
    expect(note.isDifficult).toBe(true);

    const rec = await repo.saveRecordingMetadata({
      id: "rec-123",
      verseKey: "1:1",
      durationMs: 4200,
      consentGranted: false,
    });
    expect(rec.verseKey).toBe("1:1");
    expect((await repo.getDashboardSnapshot()).recordings).toHaveLength(1);

    await repo.deleteRecordingMetadata({ id: "rec-123" });
    expect((await repo.getDashboardSnapshot()).recordings).toHaveLength(0);
    repo.close();
  });

  it("supports bulk Surah vocabulary card creation and studied Mushaf page tracking", async () => {
    const { repo, dbPath } = createTempRepo();

    const firstBatch = await repo.ensureSurahVocabularyCards({
      surahId: 112,
      direction: "ar_to_tr",
    });
    expect(firstBatch.addedCount).toBeGreaterThan(5);
    expect(firstBatch.totalSurahCards).toBe(firstBatch.addedCount);

    // Calling again should be idempotent
    const secondBatch = await repo.ensureSurahVocabularyCards({
      surahId: 112,
      direction: "ar_to_tr",
    });
    expect(secondBatch.addedCount).toBe(0);
    expect(secondBatch.totalSurahCards).toBe(firstBatch.totalSurahCards);

    // Track studying Mushaf page 604
    await repo.markPageStudied({ pageNumber: 604 });
    repo.close();

    const reopened = new SqliteProgressRepository(dbPath);
    const snap = await reopened.getDashboardSnapshot();
    expect(snap.profile.currentPageNumber).toBe(604);
    const page604Prog = snap.pageProgress.find((p) => p.pageNumber === 604);
    expect(page604Prog).toBeDefined();
    expect(page604Prog?.status).toBe("in_progress");
    expect(snap.cards.some((c) => c.targetKey.startsWith("112:"))).toBe(true);
    reopened.close();
  });
});
