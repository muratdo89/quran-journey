import crypto from "node:crypto";

/**
 * Deterministic vocabulary card id. On serverless hosts each instance may hold its own
 * temporary SQLite file; stable ids let a review posted to another instance still find
 * (or recreate) the same card instead of failing with "card not found".
 */
export function vocabularyCardId(userId: string, wordLocation: string, direction: string): string {
  return `vocab:${userId}:${direction}:${wordLocation}`;
}

function parseVocabularyCardId(
  cardId: string
): { userId: string; wordLocation: string; direction: "ar_to_tr" | "tr_to_ar" } | null {
  const m = /^vocab:(.+):(ar_to_tr|tr_to_ar):(\d+:\d+:\d+)$/.exec(cardId);
  return m ? { userId: m[1]!, direction: m[2] as "ar_to_tr" | "tr_to_ar", wordLocation: m[3]! } : null;
}
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  getAllFatihaWords,
  getAvailablePages,
  getFatihaDataset,
  getMushafPageData,
  getSurahEnrichedWords,
  getSurahEntry,
} from "@/lib/content/canonical-loader";
import { ARABIC_READING_MODULES, TAJWEED_LESSONS } from "@/lib/content/arabic-curriculum";
import {
  calculateIndependentPillarScores,
  createInitialCardRecord,
  scheduleCardReview,
  transitionMemorizationState,
  type CardDirection,
  type CardType,
  type MemorizationState,
  type ReviewRating,
  type SessionMode,
  type StoredLearningCard,
} from "@/lib/learning-engine";
import type {
  AchievementRecord,
  BookmarkRecord,
  DailyActivityRecord,
  DashboardStateSnapshot,
  LearningGoalRecord,
  PageProgressRecord,
  ProgressRepository,
  RecordingMetadataRecord,
  UserNoteRecord,
  UserPreferencesRecord,
  UserProfileRecord,
  VerseProgressRecord,
  WordProgressRecord,
} from "./types";

const DEFAULT_USER_ID = "local-personal-learner";

function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function resolveWritableDbPath(requestedPath?: string): {
  resolvedPath: string;
  isEphemeralTmp: boolean;
} {
  if (requestedPath) {
    fs.mkdirSync(path.dirname(requestedPath), { recursive: true });
    return { resolvedPath: requestedPath, isEphemeralTmp: false };
  }

  const projectDataDir = path.join(process.cwd(), ".data");
  try {
    fs.mkdirSync(projectDataDir, { recursive: true });
    fs.accessSync(projectDataDir, fs.constants.W_OK);
    return {
      resolvedPath: path.join(projectDataDir, "quran-journey.db"),
      isEphemeralTmp: false,
    };
  } catch {
    const tmpDir = path.join(os.tmpdir(), "quran-journey-data");
    fs.mkdirSync(tmpDir, { recursive: true });
    return {
      resolvedPath: path.join(tmpDir, "quran-journey.db"),
      isEphemeralTmp: true,
    };
  }
}

export class SqliteProgressRepository implements ProgressRepository {
  private db: DatabaseSync;
  public readonly dbPath: string;
  public readonly isEphemeralTmp: boolean;

  constructor(dbPath?: string) {
    const { resolvedPath, isEphemeralTmp } = resolveWritableDbPath(dbPath);
    this.dbPath = resolvedPath;
    this.isEphemeralTmp = isEphemeralTmp;
    this.db = new DatabaseSync(resolvedPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.initSchema();
    this.seedDefaultsIfNeeded(DEFAULT_USER_ID);
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL DEFAULT 'Kur''an Öğrencisi',
        native_language TEXT NOT NULL DEFAULT 'tr',
        placement_completed INTEGER NOT NULL DEFAULT 0,
        placement_level TEXT,
        placement_score_percent INTEGER,
        current_page_number INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        arabic_font_size INTEGER NOT NULL DEFAULT 34,
        arabic_line_height REAL NOT NULL DEFAULT 2.15,
        theme_mode TEXT NOT NULL DEFAULT 'light',
        show_translation_default INTEGER NOT NULL DEFAULT 1,
        show_transliteration INTEGER NOT NULL DEFAULT 0,
        preferred_reciter_id INTEGER NOT NULL DEFAULT 7,
        preferred_translation_id INTEGER NOT NULL DEFAULT 77,
        playback_speed REAL NOT NULL DEFAULT 1.0,
        cloud_ai_audio_consent INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS learning_goals (
        user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        daily_target_minutes INTEGER NOT NULL DEFAULT 20,
        session_mode TEXT NOT NULL DEFAULT 'normal',
        new_words_per_day INTEGER NOT NULL DEFAULT 5,
        new_verses_per_day INTEGER NOT NULL DEFAULT 2
      );

      CREATE TABLE IF NOT EXISTS user_word_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        word_location TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        times_seen INTEGER NOT NULL DEFAULT 0,
        times_correct INTEGER NOT NULL DEFAULT 0,
        times_missed INTEGER NOT NULL DEFAULT 0,
        last_reviewed_at TEXT,
        UNIQUE (user_id, word_location)
      );

      CREATE TABLE IF NOT EXISTS user_verse_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        verse_key TEXT NOT NULL,
        memorization_state TEXT NOT NULL DEFAULT 'not_started',
        comprehension_score INTEGER NOT NULL DEFAULT 0,
        pronunciation_confidence INTEGER NOT NULL DEFAULT 0,
        last_practiced_at TEXT,
        UNIQUE (user_id, verse_key)
      );

      CREATE TABLE IF NOT EXISTS user_page_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        page_number INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_started',
        studied_verses_count INTEGER NOT NULL DEFAULT 0,
        memorized_verses_count INTEGER NOT NULL DEFAULT 0,
        last_studied_at TEXT,
        UNIQUE (user_id, page_number)
      );

      CREATE TABLE IF NOT EXISTS learning_cards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        card_type TEXT NOT NULL,
        target_key TEXT NOT NULL,
        direction TEXT NOT NULL,
        fsrs_state INTEGER NOT NULL DEFAULT 0,
        due_at TEXT NOT NULL,
        stability REAL NOT NULL DEFAULT 0,
        difficulty REAL NOT NULL DEFAULT 0,
        elapsed_days INTEGER NOT NULL DEFAULT 0,
        scheduled_days INTEGER NOT NULL DEFAULT 0,
        reps INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0,
        learning_steps INTEGER NOT NULL DEFAULT 0,
        last_review_at TEXT,
        UNIQUE (user_id, card_type, target_key, direction)
      );

      CREATE TABLE IF NOT EXISTS review_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        card_id TEXT NOT NULL REFERENCES learning_cards(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        response_time_ms INTEGER,
        was_correct INTEGER NOT NULL,
        previous_state INTEGER NOT NULL,
        next_state INTEGER NOT NULL,
        reviewed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        verse_key TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        label TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, verse_key)
      );

      CREATE TABLE IF NOT EXISTS user_notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        verse_key TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        note_text TEXT NOT NULL,
        is_difficult INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, verse_key)
      );

      CREATE TABLE IF NOT EXISTS user_recordings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        verse_key TEXT NOT NULL,
        storage_type TEXT NOT NULL DEFAULT 'local_indexeddb',
        duration_ms INTEGER NOT NULL,
        consent_granted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS completed_modules (
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        module_id TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        PRIMARY KEY (user_id, module_id)
      );

      CREATE TABLE IF NOT EXISTS practiced_tajweed (
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        practiced_at TEXT NOT NULL,
        PRIMARY KEY (user_id, slug)
      );

      CREATE TABLE IF NOT EXISTS achievement_records (
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        badge_code TEXT NOT NULL,
        title_tr TEXT NOT NULL,
        earned_at TEXT NOT NULL,
        PRIMARY KEY (user_id, badge_code)
      );

      CREATE TABLE IF NOT EXISTS streak_records (
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        activity_date TEXT NOT NULL,
        minutes_studied INTEGER NOT NULL DEFAULT 0,
        reviews_completed INTEGER NOT NULL DEFAULT 0,
        xp_earned INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, activity_date)
      );
    `);

    // Safe migration for existing Phase 1 local SQLite DB files
    const cols = this.db
      .prepare("PRAGMA table_info(profiles)")
      .all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "current_page_number")) {
      this.db.exec(
        "ALTER TABLE profiles ADD COLUMN current_page_number INTEGER NOT NULL DEFAULT 1;"
      );
    }
  }

  private seedDefaultsIfNeeded(userId: string): void {
    const now = new Date();
    const nowIso = now.toISOString();

    const existing = this.db
      .prepare("SELECT id FROM profiles WHERE id = ?")
      .get(userId) as { id: string } | undefined;

    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO profiles (id, display_name, native_language, placement_completed, current_page_number, updated_at)
           VALUES (?, ?, 'tr', 0, 1, ?)`
        )
        .run(userId, "Kur'an Öğrencisi", nowIso);

      this.db
        .prepare("INSERT INTO user_preferences (user_id) VALUES (?)")
        .run(userId);

      this.db
        .prepare("INSERT INTO learning_goals (user_id) VALUES (?)")
        .run(userId);

      const fatiha = getFatihaDataset();
      const insertVerse = this.db.prepare(
        `INSERT OR IGNORE INTO user_verse_progress (id, user_id, verse_key, memorization_state, comprehension_score, pronunciation_confidence)
         VALUES (?, ?, ?, 'not_started', 0, 0)`
      );
      for (const verse of fatiha.verses) {
        insertVerse.run(crypto.randomUUID(), userId, verse.verseKey);
      }

      const words = getAllFatihaWords();
      const seenArabic = new Set<string>();
      const insertWordProg = this.db.prepare(
        `INSERT OR IGNORE INTO user_word_progress (id, user_id, word_location, status)
         VALUES (?, ?, ?, 'new')`
      );
      const insertCard = this.db.prepare(
        `INSERT OR IGNORE INTO learning_cards
         (id, user_id, card_type, target_key, direction, fsrs_state, due_at, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, learning_steps, last_review_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      let starterCount = 0;
      for (const w of words) {
        insertWordProg.run(crypto.randomUUID(), userId, w.location);
        if (!seenArabic.has(w.textUthmani) && starterCount < 10) {
          seenArabic.add(w.textUthmani);
          starterCount += 1;
          const card = createInitialCardRecord(
            vocabularyCardId(userId, w.location, "ar_to_tr"),
            "vocabulary",
            w.location,
            "ar_to_tr",
            now
          );
          insertCard.run(
            card.id,
            userId,
            card.cardType,
            card.targetKey,
            card.direction,
            card.fsrsState,
            card.dueAt,
            card.stability,
            card.difficulty,
            card.elapsedDays,
            card.scheduledDays,
            card.reps,
            card.lapses,
            card.learningSteps,
            card.lastReviewAt
          );
        }
      }
    }
  }

  private mapCardRow(r: Record<string, unknown>): StoredLearningCard {
    return {
      id: String(r.id),
      cardType: r.card_type as CardType,
      targetKey: String(r.target_key),
      direction: r.direction as CardDirection,
      fsrsState: Number(r.fsrs_state),
      dueAt: String(r.due_at),
      stability: Number(r.stability),
      difficulty: Number(r.difficulty),
      elapsedDays: Number(r.elapsed_days),
      scheduledDays: Number(r.scheduled_days),
      reps: Number(r.reps),
      lapses: Number(r.lapses),
      learningSteps: Number(r.learning_steps),
      lastReviewAt: r.last_review_at ? String(r.last_review_at) : null,
    };
  }

  async getDashboardSnapshot(
    userId: string = DEFAULT_USER_ID
  ): Promise<DashboardStateSnapshot> {
    this.seedDefaultsIfNeeded(userId);

    const pRow = this.db
      .prepare("SELECT * FROM profiles WHERE id = ?")
      .get(userId) as Record<string, unknown>;
    const prefRow = this.db
      .prepare("SELECT * FROM user_preferences WHERE user_id = ?")
      .get(userId) as Record<string, unknown>;
    const goalRow = this.db
      .prepare("SELECT * FROM learning_goals WHERE user_id = ?")
      .get(userId) as Record<string, unknown>;

    const profile: UserProfileRecord = {
      id: String(pRow.id),
      displayName: String(pRow.display_name),
      nativeLanguage: String(pRow.native_language),
      placementCompleted: Boolean(pRow.placement_completed),
      placementLevel: pRow.placement_level ? String(pRow.placement_level) : null,
      placementScorePercent:
        pRow.placement_score_percent !== null && pRow.placement_score_percent !== undefined
          ? Number(pRow.placement_score_percent)
          : null,
      currentPageNumber: Number(pRow.current_page_number ?? 1),
    };

    const preferences: UserPreferencesRecord = {
      arabicFontSize: Number(prefRow.arabic_font_size),
      arabicLineHeight: Number(prefRow.arabic_line_height),
      themeMode: prefRow.theme_mode === "dark" ? "dark" : "light",
      showTranslationDefault: Boolean(prefRow.show_translation_default),
      showTransliteration: Boolean(prefRow.show_transliteration),
      preferredReciterId: Number(prefRow.preferred_reciter_id),
      preferredTranslationId: Number(prefRow.preferred_translation_id),
      playbackSpeed: Number(prefRow.playback_speed),
      cloudAiAudioConsent: Boolean(prefRow.cloud_ai_audio_consent),
    };

    const goals: LearningGoalRecord = {
      dailyTargetMinutes: Number(goalRow.daily_target_minutes),
      sessionMode: (goalRow.session_mode as SessionMode) ?? "normal",
      newWordsPerDay: Number(goalRow.new_words_per_day),
      newVersesPerDay: Number(goalRow.new_verses_per_day),
    };

    const cards = (
      this.db
        .prepare("SELECT * FROM learning_cards WHERE user_id = ? ORDER BY due_at ASC")
        .all(userId) as Record<string, unknown>[]
    ).map((r) => this.mapCardRow(r));

    const wordProgress: WordProgressRecord[] = (
      this.db
        .prepare("SELECT * FROM user_word_progress WHERE user_id = ?")
        .all(userId) as Record<string, unknown>[]
    ).map((r) => ({
      wordLocation: String(r.word_location),
      status: r.status as WordProgressRecord["status"],
      timesSeen: Number(r.times_seen),
      timesCorrect: Number(r.times_correct),
      timesMissed: Number(r.times_missed),
      lastReviewedAt: r.last_reviewed_at ? String(r.last_reviewed_at) : null,
    }));

    const verseProgress: VerseProgressRecord[] = (
      this.db
        .prepare("SELECT * FROM user_verse_progress WHERE user_id = ? ORDER BY verse_key ASC")
        .all(userId) as Record<string, unknown>[]
    ).map((r) => ({
      verseKey: String(r.verse_key),
      memorizationState: r.memorization_state as MemorizationState,
      comprehensionScore: Number(r.comprehension_score),
      pronunciationConfidence: Number(r.pronunciation_confidence),
      lastPracticedAt: r.last_practiced_at ? String(r.last_practiced_at) : null,
    }));

    const pageProgress: PageProgressRecord[] = (
      this.db
        .prepare("SELECT * FROM user_page_progress WHERE user_id = ? ORDER BY page_number ASC")
        .all(userId) as Record<string, unknown>[]
    ).map((r) => ({
      pageNumber: Number(r.page_number),
      status: r.status as PageProgressRecord["status"],
      studiedVersesCount: Number(r.studied_verses_count),
      memorizedVersesCount: Number(r.memorized_verses_count),
      lastStudiedAt: r.last_studied_at ? String(r.last_studied_at) : null,
    }));

    const bookmarks: BookmarkRecord[] = (
      this.db
        .prepare("SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC")
        .all(userId) as Record<string, unknown>[]
    ).map((r) => ({
      id: String(r.id),
      verseKey: String(r.verse_key),
      pageNumber: Number(r.page_number),
      label: r.label ? String(r.label) : null,
      createdAt: String(r.created_at),
    }));

    const notes: UserNoteRecord[] = (
      this.db
        .prepare("SELECT * FROM user_notes WHERE user_id = ? ORDER BY updated_at DESC")
        .all(userId) as Record<string, unknown>[]
    ).map((r) => ({
      id: String(r.id),
      verseKey: String(r.verse_key),
      pageNumber: Number(r.page_number),
      noteText: String(r.note_text),
      isDifficult: Boolean(r.is_difficult),
      updatedAt: String(r.updated_at),
    }));

    const recordings: RecordingMetadataRecord[] = (
      this.db
        .prepare("SELECT * FROM user_recordings WHERE user_id = ? ORDER BY created_at DESC")
        .all(userId) as Record<string, unknown>[]
    ).map((r) => ({
      id: String(r.id),
      verseKey: String(r.verse_key),
      storageType: r.storage_type as RecordingMetadataRecord["storageType"],
      durationMs: Number(r.duration_ms),
      consentGranted: Boolean(r.consent_granted),
      createdAt: String(r.created_at),
    }));

    const completedReadingModuleIds = (
      this.db
        .prepare("SELECT module_id FROM completed_modules WHERE user_id = ?")
        .all(userId) as Array<{ module_id: string }>
    ).map((r) => r.module_id);

    const practicedTajweedSlugs = (
      this.db
        .prepare("SELECT slug FROM practiced_tajweed WHERE user_id = ?")
        .all(userId) as Array<{ slug: string }>
    ).map((r) => r.slug);

    const achievements: AchievementRecord[] = (
      this.db
        .prepare("SELECT * FROM achievement_records WHERE user_id = ? ORDER BY earned_at DESC")
        .all(userId) as Record<string, unknown>[]
    ).map((r) => ({
      badgeCode: String(r.badge_code),
      titleTr: String(r.title_tr),
      earnedAt: String(r.earned_at),
    }));

    const activityHistory: DailyActivityRecord[] = (
      this.db
        .prepare("SELECT * FROM streak_records WHERE user_id = ? ORDER BY activity_date DESC LIMIT 30")
        .all(userId) as Record<string, unknown>[]
    ).map((r) => ({
      activityDate: String(r.activity_date),
      minutesStudied: Number(r.minutes_studied),
      reviewsCompleted: Number(r.reviews_completed),
      xpEarned: Number(r.xp_earned),
    }));

    const totalXp = activityHistory.reduce((sum, a) => sum + a.xpEarned, 0);

    const dateSet = new Set(activityHistory.map((a) => a.activityDate));
    let currentStreakDays = 0;
    const today = new Date();
    for (let offset = 0; offset < 365; offset += 1) {
      const probe = new Date(today);
      probe.setUTCDate(today.getUTCDate() - offset);
      const iso = probe.toISOString().slice(0, 10);
      if (dateSet.has(iso)) {
        currentStreakDays += 1;
      } else if (offset === 0) {
        continue;
      } else {
        break;
      }
    }

    let daysSinceLastStudy = 0;
    const latestActivity = activityHistory[0];
    if (latestActivity) {
      const diffMs =
        new Date(todayIsoDate(today)).getTime() -
        new Date(latestActivity.activityDate).getTime();
      daysSinceLastStudy = Math.max(0, Math.floor(diffMs / 86400000));
    }

    const activeVocabTarget = Math.max(29, wordProgress.length);
    const activeVerseTarget = Math.max(7, verseProgress.length);
    const uniqueRecordedVerses = new Set(recordings.map((r) => r.verseKey)).size;

    const pillarScores = calculateIndependentPillarScores({
      readingModulesCompleted: completedReadingModuleIds.length,
      totalReadingModules: ARABIC_READING_MODULES.length,
      placementScorePercent: profile.placementScorePercent,
      tajweedLessonsPracticed: practicedTajweedSlugs.length,
      totalTajweedLessons: TAJWEED_LESSONS.length,
      recordedVersesCount: uniqueRecordedVerses,
      wordProgress,
      totalVocabularyTarget: activeVocabTarget,
      verseProgress,
      totalVersesTarget: activeVerseTarget,
    });

    return {
      profile,
      preferences,
      goals,
      pillarScores,
      cards,
      wordProgress,
      verseProgress,
      pageProgress,
      bookmarks,
      notes,
      recordings,
      achievements,
      activityHistory,
      completedReadingModuleIds,
      practicedTajweedSlugs,
      currentStreakDays,
      totalXp,
      daysSinceLastStudy,
    };
  }

  async submitCardReview({
    cardId,
    rating,
    responseTimeMs,
    userId = DEFAULT_USER_ID,
  }: {
    cardId: string;
    rating: ReviewRating;
    responseTimeMs?: number;
    userId?: string;
  }) {
    const selectCard = this.db.prepare("SELECT * FROM learning_cards WHERE id = ? AND user_id = ?");
    let row = selectCard.get(cardId, userId) as Record<string, unknown> | undefined;

    if (!row) {
      // Card created on another serverless instance: recreate it from its stable id.
      const parsed = parseVocabularyCardId(cardId);
      if (parsed && parsed.userId === userId) {
        const ensured = await this.ensureVocabularyCard({
          wordLocation: parsed.wordLocation,
          direction: parsed.direction,
          userId,
        });
        row = selectCard.get(ensured.id, userId) as Record<string, unknown> | undefined;
      }
    }

    if (!row) {
      throw new Error("Kart bulunamadı.");
    }

    const now = new Date();
    const currentCard = this.mapCardRow(row);
    const result = scheduleCardReview(currentCard, rating, now);

    this.db
      .prepare(
        `UPDATE learning_cards
         SET fsrs_state = ?, due_at = ?, stability = ?, difficulty = ?,
             elapsed_days = ?, scheduled_days = ?, reps = ?, lapses = ?,
             learning_steps = ?, last_review_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(
        result.updatedCard.fsrsState,
        result.updatedCard.dueAt,
        result.updatedCard.stability,
        result.updatedCard.difficulty,
        result.updatedCard.elapsedDays,
        result.updatedCard.scheduledDays,
        result.updatedCard.reps,
        result.updatedCard.lapses,
        result.updatedCard.learningSteps,
        result.updatedCard.lastReviewAt,
        cardId,
        userId
      );

    this.db
      .prepare(
        `INSERT INTO review_history (id, user_id, card_id, rating, response_time_ms, was_correct, previous_state, next_state, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        userId,
        cardId,
        rating,
        responseTimeMs ?? null,
        result.wasCorrect ? 1 : 0,
        result.previousState,
        result.nextState,
        now.toISOString()
      );

    if (currentCard.cardType === "vocabulary") {
      const existingWord = this.db
        .prepare("SELECT * FROM user_word_progress WHERE user_id = ? AND word_location = ?")
        .get(userId, currentCard.targetKey) as Record<string, unknown> | undefined;

      const timesSeen = (existingWord ? Number(existingWord.times_seen) : 0) + 1;
      const timesCorrect =
        (existingWord ? Number(existingWord.times_correct) : 0) + (result.wasCorrect ? 1 : 0);
      const timesMissed =
        (existingWord ? Number(existingWord.times_missed) : 0) + (result.wasCorrect ? 0 : 1);

      let nextStatus: WordProgressRecord["status"] = "learning";
      if (!result.wasCorrect) {
        nextStatus = timesMissed >= 2 ? "difficult" : "learning";
      } else if (result.updatedCard.reps >= 2 && result.updatedCard.scheduledDays >= 1) {
        nextStatus = "known";
      }

      this.db
        .prepare(
          `INSERT INTO user_word_progress (id, user_id, word_location, status, times_seen, times_correct, times_missed, last_reviewed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (user_id, word_location) DO UPDATE SET
             status = excluded.status,
             times_seen = excluded.times_seen,
             times_correct = excluded.times_correct,
             times_missed = excluded.times_missed,
             last_reviewed_at = excluded.last_reviewed_at`
        )
        .run(
          crypto.randomUUID(),
          userId,
          currentCard.targetKey,
          nextStatus,
          timesSeen,
          timesCorrect,
          timesMissed,
          now.toISOString()
        );
    }

    const xpAwarded = result.wasCorrect ? (rating === 4 ? 12 : 10) : 4;
    await this.logStudyActivity({
      minutesStudied: 1,
      reviewsCompleted: 1,
      xpEarned: xpAwarded,
      userId,
    });

    this.maybeGrantBadge(userId, "first_recall", "İlk Aktif Hatırlama");

    return {
      updatedCard: result.updatedCard,
      xpAwarded,
      intervalLabelTr: result.intervalLabelTr,
    };
  }

  async ensureVocabularyCard({
    wordLocation,
    direction = "ar_to_tr",
    userId = DEFAULT_USER_ID,
  }: {
    wordLocation: string;
    direction?: CardDirection;
    userId?: string;
  }): Promise<StoredLearningCard> {
    const existing = this.db
      .prepare(
        `SELECT * FROM learning_cards WHERE user_id = ? AND card_type = 'vocabulary' AND target_key = ? AND direction = ?`
      )
      .get(userId, wordLocation, direction) as Record<string, unknown> | undefined;

    if (existing) {
      return this.mapCardRow(existing);
    }

    this.db
      .prepare(
        `INSERT OR IGNORE INTO user_word_progress (id, user_id, word_location, status)
         VALUES (?, ?, ?, 'new')`
      )
      .run(crypto.randomUUID(), userId, wordLocation);

    const card = createInitialCardRecord(
      vocabularyCardId(userId, wordLocation, direction),
      "vocabulary",
      wordLocation,
      direction
    );

    this.db
      .prepare(
        `INSERT INTO learning_cards
         (id, user_id, card_type, target_key, direction, fsrs_state, due_at, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, learning_steps, last_review_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        card.id,
        userId,
        card.cardType,
        card.targetKey,
        card.direction,
        card.fsrsState,
        card.dueAt,
        card.stability,
        card.difficulty,
        card.elapsedDays,
        card.scheduledDays,
        card.reps,
        card.lapses,
        card.learningSteps,
        card.lastReviewAt
      );

    return card;
  }

  async ensureSurahVocabularyCards({
    surahId,
    direction = "ar_to_tr",
    userId = DEFAULT_USER_ID,
  }: {
    surahId: number;
    direction?: CardDirection;
    userId?: string;
  }): Promise<{ addedCount: number; totalSurahCards: number }> {
    const entry = getSurahEntry(surahId);
    if (!entry) {
      throw new Error(`Sure ${surahId} bulunamadı.`);
    }

    const words = getSurahEnrichedWords(surahId);
    const uniqueWords: typeof words = [];
    const seenText = new Set<string>();
    for (const w of words) {
      if (seenText.has(w.textUthmani)) continue;
      seenText.add(w.textUthmani);
      uniqueWords.push(w);
    }

    const existingRows = this.db
      .prepare(
        `SELECT target_key FROM learning_cards WHERE user_id = ? AND card_type = 'vocabulary' AND direction = ? AND target_key LIKE ?`
      )
      .all(userId, direction, `${surahId}:%`) as Array<{ target_key: string }>;
    const existingSet = new Set(existingRows.map((r) => r.target_key));

    const toInsert = uniqueWords.filter((w) => !existingSet.has(w.location));
    if (toInsert.length === 0) {
      return { addedCount: 0, totalSurahCards: seenText.size };
    }

    const insertWordProg = this.db.prepare(
      `INSERT OR IGNORE INTO user_word_progress (id, user_id, word_location, status)
       VALUES (?, ?, ?, 'new')`
    );
    const insertCard = this.db.prepare(
      `INSERT OR IGNORE INTO learning_cards
       (id, user_id, card_type, target_key, direction, fsrs_state, due_at, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, learning_steps, last_review_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const now = new Date();
    let addedCount = 0;
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      for (const w of toInsert) {
        insertWordProg.run(crypto.randomUUID(), userId, w.location);
        const card = createInitialCardRecord(
          vocabularyCardId(userId, w.location, direction),
          "vocabulary",
          w.location,
          direction,
          now
        );
        const res = insertCard.run(
          card.id,
          userId,
          card.cardType,
          card.targetKey,
          card.direction,
          card.fsrsState,
          card.dueAt,
          card.stability,
          card.difficulty,
          card.elapsedDays,
          card.scheduledDays,
          card.reps,
          card.lapses,
          card.learningSteps,
          card.lastReviewAt
        );
        if (Number(res.changes ?? 0) > 0) {
          addedCount += 1;
        }
      }
      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }

    return { addedCount, totalSurahCards: seenText.size };
  }

  async updateVerseMemorization({
    verseKey,
    outcome,
    comprehensionDelta = 0,
    userId = DEFAULT_USER_ID,
  }: {
    verseKey: string;
    outcome: "failed_recall" | "partial_recall" | "clean_recall" | "delayed_clean_recall";
    comprehensionDelta?: number;
    userId?: string;
  }): Promise<VerseProgressRecord> {
    const nowIso = new Date().toISOString();
    const row = this.db
      .prepare("SELECT * FROM user_verse_progress WHERE user_id = ? AND verse_key = ?")
      .get(userId, verseKey) as Record<string, unknown> | undefined;

    const currentState: MemorizationState =
      (row?.memorization_state as MemorizationState) ?? "not_started";
    const nextState = transitionMemorizationState(currentState, outcome);
    const prevComp = row ? Number(row.comprehension_score) : 0;
    const defaultDelta =
      outcome === "clean_recall" || outcome === "delayed_clean_recall" ? 25 : 10;
    const nextComp = Math.max(
      0,
      Math.min(100, prevComp + (comprehensionDelta || defaultDelta))
    );
    const prevConf = row ? Number(row.pronunciation_confidence) : 0;

    this.db
      .prepare(
        `INSERT INTO user_verse_progress (id, user_id, verse_key, memorization_state, comprehension_score, pronunciation_confidence, last_practiced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, verse_key) DO UPDATE SET
           memorization_state = excluded.memorization_state,
           comprehension_score = excluded.comprehension_score,
           last_practiced_at = excluded.last_practiced_at`
      )
      .run(
        crypto.randomUUID(),
        userId,
        verseKey,
        nextState,
        nextComp,
        prevConf,
        nowIso
      );

    await this.logStudyActivity({
      minutesStudied: 2,
      reviewsCompleted: 1,
      xpEarned: outcome === "failed_recall" ? 5 : 15,
      userId,
    });

    if (nextState === "provisional_mastery" || nextState === "stable_memorization") {
      this.maybeGrantBadge(userId, "first_verse_memorized", "İlk Ayet Ezberi");
    }

    return {
      verseKey,
      memorizationState: nextState,
      comprehensionScore: nextComp,
      pronunciationConfidence: prevConf,
      lastPracticedAt: nowIso,
    };
  }

  async markPageStudied({
    pageNumber,
    userId = DEFAULT_USER_ID,
  }: {
    pageNumber: number;
    userId?: string;
  }): Promise<void> {
    if (!getAvailablePages().includes(pageNumber)) return;
    const pageData = getMushafPageData(pageNumber);
    const verseKeys = pageData.sections.flatMap((s) => s.verses.map((v) => v.verseKey));

    const verseRows = this.db
      .prepare("SELECT verse_key, memorization_state FROM user_verse_progress WHERE user_id = ?")
      .all(userId) as Array<{ verse_key: string; memorization_state: MemorizationState }>;
    const stateMap = new Map(verseRows.map((r) => [r.verse_key, r.memorization_state]));

    let memorizedCount = 0;
    let needsRevision = false;
    for (const vk of verseKeys) {
      const st = stateMap.get(vk);
      if (st === "provisional_mastery" || st === "stable_memorization") memorizedCount += 1;
      if (st === "needs_revision") needsRevision = true;
    }

    const status: PageProgressRecord["status"] =
      memorizedCount === verseKeys.length && verseKeys.length > 0
        ? "completed"
        : needsRevision
          ? "needs_revision"
          : "in_progress";

    const nowIso = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO user_page_progress (id, user_id, page_number, status, studied_verses_count, memorized_verses_count, last_studied_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, page_number) DO UPDATE SET
           status = excluded.status,
           studied_verses_count = excluded.studied_verses_count,
           memorized_verses_count = excluded.memorized_verses_count,
           last_studied_at = excluded.last_studied_at`
      )
      .run(
        crypto.randomUUID(),
        userId,
        pageNumber,
        status,
        verseKeys.length,
        memorizedCount,
        nowIso
      );

    this.db
      .prepare("UPDATE profiles SET current_page_number = ?, updated_at = ? WHERE id = ?")
      .run(pageNumber, nowIso, userId);
  }

  async toggleBookmark({
    verseKey,
    pageNumber,
    label,
    userId = DEFAULT_USER_ID,
  }: {
    verseKey: string;
    pageNumber: number;
    label?: string;
    userId?: string;
  }): Promise<{ bookmarked: boolean }> {
    const existing = this.db
      .prepare("SELECT id FROM bookmarks WHERE user_id = ? AND verse_key = ?")
      .get(userId, verseKey) as { id: string } | undefined;

    if (existing) {
      this.db.prepare("DELETE FROM bookmarks WHERE id = ?").run(existing.id);
      return { bookmarked: false };
    }

    this.db
      .prepare(
        `INSERT INTO bookmarks (id, user_id, verse_key, page_number, label, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        userId,
        verseKey,
        pageNumber,
        label ?? null,
        new Date().toISOString()
      );
    return { bookmarked: true };
  }

  async saveNote({
    verseKey,
    pageNumber,
    noteText,
    isDifficult,
    userId = DEFAULT_USER_ID,
  }: {
    verseKey: string;
    pageNumber: number;
    noteText: string;
    isDifficult: boolean;
    userId?: string;
  }): Promise<UserNoteRecord> {
    const nowIso = new Date().toISOString();
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO user_notes (id, user_id, verse_key, page_number, note_text, is_difficult, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, verse_key) DO UPDATE SET
           note_text = excluded.note_text,
           is_difficult = excluded.is_difficult,
           updated_at = excluded.updated_at`
      )
      .run(id, userId, verseKey, pageNumber, noteText, isDifficult ? 1 : 0, nowIso);

    const row = this.db
      .prepare("SELECT * FROM user_notes WHERE user_id = ? AND verse_key = ?")
      .get(userId, verseKey) as Record<string, unknown>;

    return {
      id: String(row.id),
      verseKey: String(row.verse_key),
      pageNumber: Number(row.page_number),
      noteText: String(row.note_text),
      isDifficult: Boolean(row.is_difficult),
      updatedAt: String(row.updated_at),
    };
  }

  async savePlacementResult({
    scorePercent,
    levelLabelTr,
    masteredModuleIds,
    userId = DEFAULT_USER_ID,
  }: {
    score: number;
    maxScore: number;
    scorePercent: number;
    levelLabelTr: string;
    masteredModuleIds: string[];
    userId?: string;
  }): Promise<void> {
    const nowIso = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE profiles
         SET placement_completed = 1, placement_level = ?, placement_score_percent = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(levelLabelTr, scorePercent, nowIso, userId);

    const insertMod = this.db.prepare(
      `INSERT OR IGNORE INTO completed_modules (user_id, module_id, completed_at) VALUES (?, ?, ?)`
    );
    for (const modId of masteredModuleIds) {
      insertMod.run(userId, modId, nowIso);
    }

    await this.logStudyActivity({
      minutesStudied: 3,
      reviewsCompleted: 1,
      xpEarned: 20,
      userId,
    });
    this.maybeGrantBadge(userId, "placement_done", "Seviye Tespit Tamamlandı");
  }

  async completeReadingModule({
    moduleId,
    userId = DEFAULT_USER_ID,
  }: {
    moduleId: string;
    userId?: string;
  }): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO completed_modules (user_id, module_id, completed_at) VALUES (?, ?, ?)`
      )
      .run(userId, moduleId, new Date().toISOString());

    await this.logStudyActivity({
      minutesStudied: 4,
      reviewsCompleted: 1,
      xpEarned: 15,
      userId,
    });
  }

  async markTajweedPracticed({
    slug,
    userId = DEFAULT_USER_ID,
  }: {
    slug: string;
    userId?: string;
  }): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO practiced_tajweed (user_id, slug, practiced_at) VALUES (?, ?, ?)`
      )
      .run(userId, slug, new Date().toISOString());
    await this.logStudyActivity({
      minutesStudied: 3,
      reviewsCompleted: 1,
      xpEarned: 12,
      userId,
    });
  }

  async updatePreferences({
    sessionMode,
    dailyTargetMinutes,
    displayName,
    currentPageNumber,
    userId = DEFAULT_USER_ID,
    ...prefs
  }: Partial<UserPreferencesRecord> & {
    sessionMode?: SessionMode;
    dailyTargetMinutes?: number;
    displayName?: string;
    currentPageNumber?: number;
    userId?: string;
  }): Promise<void> {
    const nowIso = new Date().toISOString();
    if (displayName !== undefined) {
      this.db
        .prepare("UPDATE profiles SET display_name = ?, updated_at = ? WHERE id = ?")
        .run(displayName, nowIso, userId);
    }
    if (currentPageNumber !== undefined) {
      this.db
        .prepare("UPDATE profiles SET current_page_number = ?, updated_at = ? WHERE id = ?")
        .run(currentPageNumber, nowIso, userId);
    }
    if (sessionMode !== undefined || dailyTargetMinutes !== undefined) {
      const current = this.db
        .prepare("SELECT * FROM learning_goals WHERE user_id = ?")
        .get(userId) as Record<string, unknown>;
      this.db
        .prepare(
          `UPDATE learning_goals SET session_mode = ?, daily_target_minutes = ? WHERE user_id = ?`
        )
        .run(
          sessionMode ?? String(current.session_mode),
          dailyTargetMinutes ?? Number(current.daily_target_minutes),
          userId
        );
    }

    const currentPref = this.db
      .prepare("SELECT * FROM user_preferences WHERE user_id = ?")
      .get(userId) as Record<string, unknown>;

    this.db
      .prepare(
        `UPDATE user_preferences
         SET arabic_font_size = ?, arabic_line_height = ?, theme_mode = ?,
             show_translation_default = ?, show_transliteration = ?,
             preferred_reciter_id = ?, preferred_translation_id = ?,
             playback_speed = ?, cloud_ai_audio_consent = ?
         WHERE user_id = ?`
      )
      .run(
        prefs.arabicFontSize ?? Number(currentPref.arabic_font_size),
        prefs.arabicLineHeight ?? Number(currentPref.arabic_line_height),
        prefs.themeMode ?? String(currentPref.theme_mode),
        prefs.showTranslationDefault !== undefined
          ? prefs.showTranslationDefault
            ? 1
            : 0
          : Number(currentPref.show_translation_default),
        prefs.showTransliteration !== undefined
          ? prefs.showTransliteration
            ? 1
            : 0
          : Number(currentPref.show_transliteration),
        prefs.preferredReciterId ?? Number(currentPref.preferred_reciter_id),
        prefs.preferredTranslationId ?? Number(currentPref.preferred_translation_id),
        prefs.playbackSpeed ?? Number(currentPref.playback_speed),
        prefs.cloudAiAudioConsent !== undefined
          ? prefs.cloudAiAudioConsent
            ? 1
            : 0
          : Number(currentPref.cloud_ai_audio_consent),
        userId
      );
  }

  async saveRecordingMetadata({
    id,
    verseKey,
    durationMs,
    consentGranted,
    userId = DEFAULT_USER_ID,
  }: {
    id: string;
    verseKey: string;
    durationMs: number;
    consentGranted: boolean;
    userId?: string;
  }): Promise<RecordingMetadataRecord> {
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO user_recordings (id, user_id, verse_key, storage_type, duration_ms, consent_granted, created_at)
         VALUES (?, ?, ?, 'local_indexeddb', ?, ?, ?)`
      )
      .run(id, userId, verseKey, durationMs, consentGranted ? 1 : 0, createdAt);

    await this.logStudyActivity({
      minutesStudied: 2,
      reviewsCompleted: 1,
      xpEarned: 12,
      userId,
    });
    this.maybeGrantBadge(userId, "first_recording", "İlk Sesli Tilâvet Kaydı");

    return {
      id,
      verseKey,
      storageType: "local_indexeddb",
      durationMs,
      consentGranted,
      createdAt,
    };
  }

  async deleteRecordingMetadata({
    id,
    userId = DEFAULT_USER_ID,
  }: {
    id: string;
    userId?: string;
  }): Promise<void> {
    this.db
      .prepare("DELETE FROM user_recordings WHERE id = ? AND user_id = ?")
      .run(id, userId);
  }

  async logStudyActivity({
    minutesStudied,
    reviewsCompleted = 0,
    xpEarned = 0,
    userId = DEFAULT_USER_ID,
  }: {
    minutesStudied: number;
    reviewsCompleted?: number;
    xpEarned?: number;
    userId?: string;
  }): Promise<void> {
    const dateKey = todayIsoDate();
    this.db
      .prepare(
        `INSERT INTO streak_records (user_id, activity_date, minutes_studied, reviews_completed, xp_earned)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, activity_date) DO UPDATE SET
           minutes_studied = minutes_studied + excluded.minutes_studied,
           reviews_completed = reviews_completed + excluded.reviews_completed,
           xp_earned = xp_earned + excluded.xp_earned`
      )
      .run(userId, dateKey, minutesStudied, reviewsCompleted, xpEarned);
  }

  private maybeGrantBadge(userId: string, badgeCode: string, titleTr: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO achievement_records (user_id, badge_code, title_tr, earned_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(userId, badgeCode, titleTr, new Date().toISOString());
  }

  close(): void {
    this.db.close();
  }
}
