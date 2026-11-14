import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export class SupabaseProgressRepository implements ProgressRepository {
  private client: SupabaseClient;
  private userId: string;

  constructor(accessToken: string, userId: string) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    this.userId = userId;
    this.client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }

  private async ensureSeeded(userId: string): Promise<void> {
    const { data: existing } = await this.client
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existing) return;

    const now = new Date();
    const nowIso = now.toISOString();

    await this.client.from("profiles").upsert(
      {
        id: userId,
        display_name: "Kur'an Öğrencisi",
        native_language: "tr",
        placement_completed: false,
        current_page_number: 1,
        updated_at: nowIso,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    await this.client
      .from("user_preferences")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    await this.client
      .from("learning_goals")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const fatiha = getFatihaDataset();
    await this.client.from("user_verse_progress").upsert(
      fatiha.verses.map((v) => ({
        user_id: userId,
        verse_key: v.verseKey,
        memorization_state: "not_started",
        comprehension_score: 0,
        pronunciation_confidence: 0,
      })),
      { onConflict: "user_id,verse_key", ignoreDuplicates: true }
    );

    const words = getAllFatihaWords();
    await this.client.from("user_word_progress").upsert(
      words.map((w) => ({
        user_id: userId,
        word_location: w.location,
        status: "new",
      })),
      { onConflict: "user_id,word_location", ignoreDuplicates: true }
    );

    const seenArabic = new Set<string>();
    const starterCards: Array<Record<string, unknown>> = [];
    for (const w of words) {
      if (seenArabic.has(w.textUthmani) || starterCards.length >= 10) continue;
      seenArabic.add(w.textUthmani);
      const card = createInitialCardRecord(
        crypto.randomUUID(),
        "vocabulary",
        w.location,
        "ar_to_tr",
        now
      );
      starterCards.push({
        id: card.id,
        user_id: userId,
        card_type: card.cardType,
        target_key: card.targetKey,
        direction: card.direction,
        fsrs_state: card.fsrsState,
        due_at: card.dueAt,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsedDays,
        scheduled_days: card.scheduledDays,
        reps: card.reps,
        lapses: card.lapses,
        learning_steps: card.learningSteps,
        last_review_at: card.lastReviewAt,
      });
    }

    if (starterCards.length > 0) {
      await this.client.from("learning_cards").upsert(starterCards, {
        onConflict: "user_id,card_type,target_key,direction",
        ignoreDuplicates: true,
      });
    }
  }

  private mapCardRow(r: Record<string, unknown>): StoredLearningCard {
    return {
      id: String(r.id),
      cardType: r.card_type as StoredLearningCard["cardType"],
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

  async getDashboardSnapshot(userId = this.userId): Promise<DashboardStateSnapshot> {
    await this.ensureSeeded(userId);

    const [
      { data: pRow, error: pErr },
      { data: prefRow, error: prefErr },
      { data: goalRow, error: goalErr },
      { data: cardRows },
      { data: wordRows },
      { data: verseRows },
      { data: pageRows },
      { data: bmRows },
      { data: noteRows },
      { data: recRows },
      { data: currRows },
      { data: achRows },
      { data: streakRows },
    ] = await Promise.all([
      this.client.from("profiles").select("*").eq("id", userId).maybeSingle(),
      this.client.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
      this.client.from("learning_goals").select("*").eq("user_id", userId).maybeSingle(),
      this.client.from("learning_cards").select("*").eq("user_id", userId).order("due_at").limit(10000),
      this.client.from("user_word_progress").select("*").eq("user_id", userId).limit(10000),
      this.client.from("user_verse_progress").select("*").eq("user_id", userId).order("verse_key").limit(7000),
      this.client.from("user_page_progress").select("*").eq("user_id", userId).order("page_number").limit(1000),
      this.client.from("bookmarks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      this.client.from("user_notes").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
      this.client.from("user_recordings").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      this.client.from("user_curriculum_progress").select("*").eq("user_id", userId),
      this.client.from("achievement_records").select("*").eq("user_id", userId).order("earned_at", { ascending: false }),
      this.client.from("streak_records").select("*").eq("user_id", userId).order("activity_date", { ascending: false }).limit(30),
    ]);

    if (pErr || prefErr || goalErr || !pRow || !prefRow || !goalRow) {
      throw new Error(
        "Supabase kullanıcı verileri okunamadı. 0001, 0002 ve 0003 SQL migrasyonlarının çalıştırıldığını doğrulayın."
      );
    }

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

    const cards = (cardRows ?? []).map((r) => this.mapCardRow(r));
    const wordProgress: WordProgressRecord[] = (wordRows ?? []).map((r) => ({
      wordLocation: String(r.word_location),
      status: r.status as WordProgressRecord["status"],
      timesSeen: Number(r.times_seen),
      timesCorrect: Number(r.times_correct),
      timesMissed: Number(r.times_missed),
      lastReviewedAt: r.last_reviewed_at ? String(r.last_reviewed_at) : null,
    }));

    const verseProgress: VerseProgressRecord[] = (verseRows ?? []).map((r) => ({
      verseKey: String(r.verse_key),
      memorizationState: r.memorization_state as MemorizationState,
      comprehensionScore: Number(r.comprehension_score),
      pronunciationConfidence: Number(r.pronunciation_confidence),
      lastPracticedAt: r.last_practiced_at ? String(r.last_practiced_at) : null,
    }));

    const pageProgress: PageProgressRecord[] = (pageRows ?? []).map((r) => ({
      pageNumber: Number(r.page_number),
      status: r.status as PageProgressRecord["status"],
      studiedVersesCount: Number(r.studied_verses_count),
      memorizedVersesCount: Number(r.memorized_verses_count),
      lastStudiedAt: r.last_studied_at ? String(r.last_studied_at) : null,
    }));

    const bookmarks: BookmarkRecord[] = (bmRows ?? []).map((r) => ({
      id: String(r.id),
      verseKey: String(r.verse_key),
      pageNumber: Number(r.page_number),
      label: r.label ? String(r.label) : null,
      createdAt: String(r.created_at),
    }));

    const notes: UserNoteRecord[] = (noteRows ?? []).map((r) => ({
      id: String(r.id),
      verseKey: String(r.verse_key),
      pageNumber: Number(r.page_number),
      noteText: String(r.note_text),
      isDifficult: Boolean(r.is_difficult),
      updatedAt: String(r.updated_at),
    }));

    const recordings: RecordingMetadataRecord[] = (recRows ?? []).map((r) => ({
      id: String(r.id),
      verseKey: String(r.verse_key),
      storageType: r.storage_type as RecordingMetadataRecord["storageType"],
      durationMs: Number(r.duration_ms),
      consentGranted: Boolean(r.consent_granted),
      createdAt: String(r.created_at),
    }));

    const completedReadingModuleIds = (currRows ?? [])
      .filter((r) => r.item_kind === "reading_module")
      .map((r) => String(r.item_key));
    const practicedTajweedSlugs = (currRows ?? [])
      .filter((r) => r.item_kind === "tajweed_rule")
      .map((r) => String(r.item_key));

    const achievements: AchievementRecord[] = (achRows ?? []).map((r) => ({
      badgeCode: String(r.badge_code),
      titleTr: String(r.title_turkish),
      earnedAt: String(r.earned_at),
    }));

    const activityHistory: DailyActivityRecord[] = (streakRows ?? []).map((r) => ({
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

    const pillarScores = calculateIndependentPillarScores({
      readingModulesCompleted: completedReadingModuleIds.length,
      totalReadingModules: ARABIC_READING_MODULES.length,
      placementScorePercent: profile.placementScorePercent,
      tajweedLessonsPracticed: practicedTajweedSlugs.length,
      totalTajweedLessons: TAJWEED_LESSONS.length,
      recordedVersesCount: new Set(recordings.map((r) => r.verseKey)).size,
      wordProgress,
      totalVocabularyTarget: Math.max(29, wordProgress.length),
      verseProgress,
      totalVersesTarget: Math.max(7, verseProgress.length),
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
    userId = this.userId,
  }: {
    cardId: string;
    rating: ReviewRating;
    responseTimeMs?: number;
    userId?: string;
  }) {
    const { data: row, error } = await this.client
      .from("learning_cards")
      .select("*")
      .eq("id", cardId)
      .eq("user_id", userId)
      .single();

    if (error || !row) throw new Error("Kart bulunamadı.");

    const now = new Date();
    const currentCard = this.mapCardRow(row);
    const result = scheduleCardReview(currentCard, rating, now);

    await this.client
      .from("learning_cards")
      .update({
        fsrs_state: result.updatedCard.fsrsState,
        due_at: result.updatedCard.dueAt,
        stability: result.updatedCard.stability,
        difficulty: result.updatedCard.difficulty,
        elapsed_days: result.updatedCard.elapsedDays,
        scheduled_days: result.updatedCard.scheduledDays,
        reps: result.updatedCard.reps,
        lapses: result.updatedCard.lapses,
        learning_steps: result.updatedCard.learningSteps,
        last_review_at: result.updatedCard.lastReviewAt,
      })
      .eq("id", cardId)
      .eq("user_id", userId);

    await this.client.from("review_history").insert({
      user_id: userId,
      card_id: cardId,
      rating,
      response_time_ms: responseTimeMs ?? null,
      was_correct: result.wasCorrect,
      previous_state: result.previousState,
      next_state: result.nextState,
      reviewed_at: now.toISOString(),
    });

    if (currentCard.cardType === "vocabulary") {
      const { data: existingWord } = await this.client
        .from("user_word_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("word_location", currentCard.targetKey)
        .maybeSingle();

      const timesSeen = (existingWord ? Number(existingWord.times_seen) : 0) + 1;
      const timesCorrect =
        (existingWord ? Number(existingWord.times_correct) : 0) +
        (result.wasCorrect ? 1 : 0);
      const timesMissed =
        (existingWord ? Number(existingWord.times_missed) : 0) +
        (result.wasCorrect ? 0 : 1);

      let nextStatus: WordProgressRecord["status"] = "learning";
      if (!result.wasCorrect) {
        nextStatus = timesMissed >= 2 ? "difficult" : "learning";
      } else if (result.updatedCard.reps >= 2 && result.updatedCard.scheduledDays >= 1) {
        nextStatus = "known";
      }

      await this.client.from("user_word_progress").upsert(
        {
          user_id: userId,
          word_location: currentCard.targetKey,
          status: nextStatus,
          times_seen: timesSeen,
          times_correct: timesCorrect,
          times_missed: timesMissed,
          last_reviewed_at: now.toISOString(),
        },
        { onConflict: "user_id,word_location" }
      );
    }

    const xpAwarded = result.wasCorrect ? (rating === 4 ? 12 : 10) : 4;
    await this.logStudyActivity({
      minutesStudied: 1,
      reviewsCompleted: 1,
      xpEarned: xpAwarded,
      userId,
    });
    await this.maybeGrantBadge(userId, "first_recall", "İlk Aktif Hatırlama");

    return {
      updatedCard: result.updatedCard,
      xpAwarded,
      intervalLabelTr: result.intervalLabelTr,
    };
  }

  async ensureVocabularyCard({
    wordLocation,
    direction = "ar_to_tr",
    userId = this.userId,
  }: {
    wordLocation: string;
    direction?: CardDirection;
    userId?: string;
  }): Promise<StoredLearningCard> {
    const { data: existing } = await this.client
      .from("learning_cards")
      .select("*")
      .eq("user_id", userId)
      .eq("card_type", "vocabulary")
      .eq("target_key", wordLocation)
      .eq("direction", direction)
      .maybeSingle();

    if (existing) return this.mapCardRow(existing);

    await this.client.from("user_word_progress").upsert(
      { user_id: userId, word_location: wordLocation, status: "new" },
      { onConflict: "user_id,word_location" }
    );

    const card = createInitialCardRecord(
      crypto.randomUUID(),
      "vocabulary",
      wordLocation,
      direction
    );

    await this.client.from("learning_cards").insert({
      id: card.id,
      user_id: userId,
      card_type: card.cardType,
      target_key: card.targetKey,
      direction: card.direction,
      fsrs_state: card.fsrsState,
      due_at: card.dueAt,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsedDays,
      scheduled_days: card.scheduledDays,
      reps: card.reps,
      lapses: card.lapses,
      learning_steps: card.learningSteps,
      last_review_at: card.lastReviewAt,
    });

    return card;
  }

  async ensureSurahVocabularyCards({
    surahId,
    direction = "ar_to_tr",
    userId = this.userId,
  }: {
    surahId: number;
    direction?: CardDirection;
    userId?: string;
  }): Promise<{ addedCount: number; totalSurahCards: number }> {
    const entry = getSurahEntry(surahId);
    if (!entry) throw new Error(`Sure ${surahId} bulunamadı.`);

    const words = getSurahEnrichedWords(surahId);
    const uniqueWords: typeof words = [];
    const seen = new Set<string>();
    for (const w of words) {
      if (seen.has(w.textUthmani)) continue;
      seen.add(w.textUthmani);
      uniqueWords.push(w);
    }

    const { data: existingRows } = await this.client
      .from("learning_cards")
      .select("target_key")
      .eq("user_id", userId)
      .eq("card_type", "vocabulary")
      .eq("direction", direction)
      .like("target_key", `${surahId}:%`)
      .limit(10000);

    const existingKeys = new Set((existingRows ?? []).map((r) => String(r.target_key)));
    const toInsert = uniqueWords.filter((w) => !existingKeys.has(w.location));

    const chunkSize = 500;
    const now = new Date();
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const slice = toInsert.slice(i, i + chunkSize);
      await this.client.from("user_word_progress").upsert(
        slice.map((w) => ({
          user_id: userId,
          word_location: w.location,
          status: "new",
        })),
        { onConflict: "user_id,word_location", ignoreDuplicates: true }
      );

      await this.client.from("learning_cards").upsert(
        slice.map((w) => {
          const card = createInitialCardRecord(
            crypto.randomUUID(),
            "vocabulary",
            w.location,
            direction,
            now
          );
          return {
            id: card.id,
            user_id: userId,
            card_type: card.cardType,
            target_key: card.targetKey,
            direction: card.direction,
            fsrs_state: card.fsrsState,
            due_at: card.dueAt,
            stability: card.stability,
            difficulty: card.difficulty,
            elapsed_days: card.elapsedDays,
            scheduled_days: card.scheduledDays,
            reps: card.reps,
            lapses: card.lapses,
            learning_steps: card.learningSteps,
            last_review_at: card.lastReviewAt,
          };
        }),
        { onConflict: "user_id,card_type,target_key,direction", ignoreDuplicates: true }
      );
    }

    return { addedCount: toInsert.length, totalSurahCards: uniqueWords.length };
  }

  async updateVerseMemorization({
    verseKey,
    outcome,
    comprehensionDelta = 0,
    userId = this.userId,
  }: {
    verseKey: string;
    outcome: "failed_recall" | "partial_recall" | "clean_recall" | "delayed_clean_recall";
    comprehensionDelta?: number;
    userId?: string;
  }): Promise<VerseProgressRecord> {
    const nowIso = new Date().toISOString();
    const { data: row } = await this.client
      .from("user_verse_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("verse_key", verseKey)
      .maybeSingle();

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

    await this.client.from("user_verse_progress").upsert(
      {
        user_id: userId,
        verse_key: verseKey,
        memorization_state: nextState,
        comprehension_score: nextComp,
        pronunciation_confidence: prevConf,
        last_practiced_at: nowIso,
      },
      { onConflict: "user_id,verse_key" }
    );

    await this.logStudyActivity({
      minutesStudied: 2,
      reviewsCompleted: 1,
      xpEarned: outcome === "failed_recall" ? 5 : 15,
      userId,
    });

    if (nextState === "provisional_mastery" || nextState === "stable_memorization") {
      await this.maybeGrantBadge(userId, "first_verse_memorized", "İlk Ayet Ezberi");
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
    userId = this.userId,
  }: {
    pageNumber: number;
    userId?: string;
  }): Promise<void> {
    if (!getAvailablePages().includes(pageNumber)) return;
    const pageData = getMushafPageData(pageNumber);
    const verseKeys = pageData.sections.flatMap((s) => s.verses.map((v) => v.verseKey));

    const { data: verseRows } = await this.client
      .from("user_verse_progress")
      .select("verse_key, memorization_state")
      .eq("user_id", userId)
      .in("verse_key", verseKeys);

    const stateMap = new Map(
      (verseRows ?? []).map((r) => [
        String(r.verse_key),
        r.memorization_state as MemorizationState,
      ])
    );

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
    await this.client.from("user_page_progress").upsert(
      {
        user_id: userId,
        edition_slug: "madinah-1405-uthmani",
        page_number: pageNumber,
        status,
        studied_verses_count: verseKeys.length,
        memorized_verses_count: memorizedCount,
        last_studied_at: nowIso,
      },
      { onConflict: "user_id,edition_slug,page_number" }
    );

    await this.client
      .from("profiles")
      .update({ current_page_number: pageNumber, updated_at: nowIso })
      .eq("id", userId);
  }

  async toggleBookmark({
    verseKey,
    pageNumber,
    label,
    userId = this.userId,
  }: {
    verseKey: string;
    pageNumber: number;
    label?: string;
    userId?: string;
  }): Promise<{ bookmarked: boolean }> {
    const { data: existing } = await this.client
      .from("bookmarks")
      .select("id")
      .eq("user_id", userId)
      .eq("verse_key", verseKey)
      .maybeSingle();

    if (existing) {
      await this.client.from("bookmarks").delete().eq("id", existing.id);
      return { bookmarked: false };
    }

    await this.client.from("bookmarks").insert({
      user_id: userId,
      verse_key: verseKey,
      page_number: pageNumber,
      label: label ?? null,
    });
    return { bookmarked: true };
  }

  async saveNote({
    verseKey,
    pageNumber,
    noteText,
    isDifficult,
    userId = this.userId,
  }: {
    verseKey: string;
    pageNumber: number;
    noteText: string;
    isDifficult: boolean;
    userId?: string;
  }): Promise<UserNoteRecord> {
    const nowIso = new Date().toISOString();
    const { data } = await this.client
      .from("user_notes")
      .upsert(
        {
          user_id: userId,
          verse_key: verseKey,
          page_number: pageNumber,
          note_text: noteText,
          is_difficult: isDifficult,
          updated_at: nowIso,
        },
        { onConflict: "user_id,verse_key" }
      )
      .select()
      .single();

    return {
      id: String(data.id),
      verseKey: String(data.verse_key),
      pageNumber: Number(data.page_number),
      noteText: String(data.note_text),
      isDifficult: Boolean(data.is_difficult),
      updatedAt: String(data.updated_at),
    };
  }

  async savePlacementResult({
    scorePercent,
    levelLabelTr,
    masteredModuleIds,
    userId = this.userId,
  }: {
    score: number;
    maxScore: number;
    scorePercent: number;
    levelLabelTr: string;
    masteredModuleIds: string[];
    userId?: string;
  }): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.client
      .from("profiles")
      .update({
        placement_completed: true,
        placement_level: levelLabelTr,
        placement_score_percent: scorePercent,
        updated_at: nowIso,
      })
      .eq("id", userId);

    if (masteredModuleIds.length > 0) {
      await this.client.from("user_curriculum_progress").upsert(
        masteredModuleIds.map((m) => ({
          user_id: userId,
          item_kind: "reading_module",
          item_key: m,
          completed_at: nowIso,
        })),
        { onConflict: "user_id,item_kind,item_key" }
      );
    }

    await this.logStudyActivity({
      minutesStudied: 3,
      reviewsCompleted: 1,
      xpEarned: 20,
      userId,
    });
    await this.maybeGrantBadge(userId, "placement_done", "Seviye Tespit Tamamlandı");
  }

  async completeReadingModule({
    moduleId,
    userId = this.userId,
  }: {
    moduleId: string;
    userId?: string;
  }): Promise<void> {
    await this.client.from("user_curriculum_progress").upsert(
      {
        user_id: userId,
        item_kind: "reading_module",
        item_key: moduleId,
      },
      { onConflict: "user_id,item_kind,item_key" }
    );
    await this.logStudyActivity({
      minutesStudied: 4,
      reviewsCompleted: 1,
      xpEarned: 15,
      userId,
    });
  }

  async markTajweedPracticed({
    slug,
    userId = this.userId,
  }: {
    slug: string;
    userId?: string;
  }): Promise<void> {
    await this.client.from("user_curriculum_progress").upsert(
      {
        user_id: userId,
        item_kind: "tajweed_rule",
        item_key: slug,
      },
      { onConflict: "user_id,item_kind,item_key" }
    );
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
    userId = this.userId,
    ...prefs
  }: Partial<UserPreferencesRecord> & {
    sessionMode?: SessionMode;
    dailyTargetMinutes?: number;
    displayName?: string;
    currentPageNumber?: number;
    userId?: string;
  }): Promise<void> {
    const nowIso = new Date().toISOString();
    if (displayName !== undefined || currentPageNumber !== undefined) {
      const updateObj: Record<string, unknown> = { updated_at: nowIso };
      if (displayName !== undefined) updateObj.display_name = displayName;
      if (currentPageNumber !== undefined) updateObj.current_page_number = currentPageNumber;
      await this.client.from("profiles").update(updateObj).eq("id", userId);
    }

    if (sessionMode !== undefined || dailyTargetMinutes !== undefined) {
      const updateGoal: Record<string, unknown> = { updated_at: nowIso };
      if (sessionMode !== undefined) updateGoal.session_mode = sessionMode;
      if (dailyTargetMinutes !== undefined)
        updateGoal.daily_target_minutes = dailyTargetMinutes;
      await this.client.from("learning_goals").update(updateGoal).eq("user_id", userId);
    }

    const prefUpdate: Record<string, unknown> = { updated_at: nowIso };
    if (prefs.arabicFontSize !== undefined)
      prefUpdate.arabic_font_size = prefs.arabicFontSize;
    if (prefs.arabicLineHeight !== undefined)
      prefUpdate.arabic_line_height = prefs.arabicLineHeight;
    if (prefs.themeMode !== undefined) prefUpdate.theme_mode = prefs.themeMode;
    if (prefs.showTranslationDefault !== undefined)
      prefUpdate.show_translation_default = prefs.showTranslationDefault;
    if (prefs.showTransliteration !== undefined)
      prefUpdate.show_transliteration = prefs.showTransliteration;
    if (prefs.preferredReciterId !== undefined)
      prefUpdate.preferred_reciter_id = prefs.preferredReciterId;
    if (prefs.preferredTranslationId !== undefined)
      prefUpdate.preferred_translation_id = prefs.preferredTranslationId;
    if (prefs.playbackSpeed !== undefined) prefUpdate.playback_speed = prefs.playbackSpeed;
    if (prefs.cloudAiAudioConsent !== undefined)
      prefUpdate.cloud_ai_audio_consent = prefs.cloudAiAudioConsent;

    if (Object.keys(prefUpdate).length > 1) {
      await this.client.from("user_preferences").update(prefUpdate).eq("user_id", userId);
    }
  }

  async saveRecordingMetadata({
    id,
    verseKey,
    durationMs,
    consentGranted,
    userId = this.userId,
  }: {
    id: string;
    verseKey: string;
    durationMs: number;
    consentGranted: boolean;
    userId?: string;
  }): Promise<RecordingMetadataRecord> {
    const createdAt = new Date().toISOString();
    await this.client.from("user_recordings").insert({
      id,
      user_id: userId,
      verse_key: verseKey,
      storage_type: "local_indexeddb",
      duration_ms: durationMs,
      consent_granted: consentGranted,
      created_at: createdAt,
    });

    await this.logStudyActivity({
      minutesStudied: 2,
      reviewsCompleted: 1,
      xpEarned: 12,
      userId,
    });
    await this.maybeGrantBadge(userId, "first_recording", "İlk Sesli Tilâvet Kaydı");

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
    userId = this.userId,
  }: {
    id: string;
    userId?: string;
  }): Promise<void> {
    await this.client
      .from("user_recordings")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
  }

  async logStudyActivity({
    minutesStudied,
    reviewsCompleted = 0,
    xpEarned = 0,
    userId = this.userId,
  }: {
    minutesStudied: number;
    reviewsCompleted?: number;
    xpEarned?: number;
    userId?: string;
  }): Promise<void> {
    const dateKey = todayIsoDate();
    const { data: existing } = await this.client
      .from("streak_records")
      .select("*")
      .eq("user_id", userId)
      .eq("activity_date", dateKey)
      .maybeSingle();

    await this.client.from("streak_records").upsert(
      {
        user_id: userId,
        activity_date: dateKey,
        minutes_studied: (existing ? Number(existing.minutes_studied) : 0) + minutesStudied,
        reviews_completed:
          (existing ? Number(existing.reviews_completed) : 0) + reviewsCompleted,
        xp_earned: (existing ? Number(existing.xp_earned) : 0) + xpEarned,
      },
      { onConflict: "user_id,activity_date" }
    );
  }

  private async maybeGrantBadge(
    userId: string,
    badgeCode: string,
    titleTr: string
  ): Promise<void> {
    await this.client.from("achievement_records").upsert(
      {
        user_id: userId,
        badge_code: badgeCode,
        title_turkish: titleTr,
      },
      { onConflict: "user_id,badge_code" }
    );
  }
}
