import type {
  CardDirection,
  CardType,
  MemorizationState,
  PillarMasteryScores,
  ReviewChoice,
  ReviewRating,
  SessionMode,
  StoredLearningCard,
} from "@/lib/learning-engine";

export interface UserProfileRecord {
  id: string;
  displayName: string;
  nativeLanguage: string;
  placementCompleted: boolean;
  placementLevel: string | null;
  placementScorePercent: number | null;
  currentPageNumber: number;
}

export interface UserPreferencesRecord {
  arabicFontSize: number;
  arabicLineHeight: number;
  themeMode: "light" | "dark";
  showTranslationDefault: boolean;
  showTransliteration: boolean;
  preferredReciterId: number;
  preferredTranslationId: number;
  playbackSpeed: number;
  cloudAiAudioConsent: boolean;
}

export interface LearningGoalRecord {
  dailyTargetMinutes: number;
  sessionMode: SessionMode;
  newWordsPerDay: number;
  newVersesPerDay: number;
}

export interface WordProgressRecord {
  wordLocation: string;
  status: "new" | "learning" | "known" | "difficult";
  timesSeen: number;
  timesCorrect: number;
  timesMissed: number;
  lastReviewedAt: string | null;
}

export interface VerseProgressRecord {
  verseKey: string;
  memorizationState: MemorizationState;
  comprehensionScore: number;
  pronunciationConfidence: number;
  lastPracticedAt: string | null;
}

export interface PageProgressRecord {
  pageNumber: number;
  status: "not_started" | "in_progress" | "completed" | "needs_revision";
  studiedVersesCount: number;
  memorizedVersesCount: number;
  lastStudiedAt: string | null;
}

export interface BookmarkRecord {
  id: string;
  verseKey: string;
  pageNumber: number;
  label: string | null;
  createdAt: string;
}

export interface UserNoteRecord {
  id: string;
  verseKey: string;
  pageNumber: number;
  noteText: string;
  isDifficult: boolean;
  updatedAt: string;
}

export interface RecordingMetadataRecord {
  id: string;
  verseKey: string;
  storageType: "local_indexeddb" | "supabase_storage";
  durationMs: number;
  consentGranted: boolean;
  createdAt: string;
}

export interface AchievementRecord {
  badgeCode: string;
  titleTr: string;
  earnedAt: string;
}

export interface DailyActivityRecord {
  activityDate: string; // YYYY-MM-DD
  minutesStudied: number;
  reviewsCompleted: number;
  xpEarned: number;
}

export interface DashboardStateSnapshot {
  profile: UserProfileRecord;
  preferences: UserPreferencesRecord;
  goals: LearningGoalRecord;
  pillarScores: PillarMasteryScores;
  cards: StoredLearningCard[];
  wordProgress: WordProgressRecord[];
  verseProgress: VerseProgressRecord[];
  pageProgress: PageProgressRecord[];
  bookmarks: BookmarkRecord[];
  notes: UserNoteRecord[];
  recordings: RecordingMetadataRecord[];
  achievements: AchievementRecord[];
  activityHistory: DailyActivityRecord[];
  completedReadingModuleIds: string[];
  practicedTajweedSlugs: string[];
  currentStreakDays: number;
  totalXp: number;
  daysSinceLastStudy: number;
}

export interface BackendConfigurationStatus {
  activePersistence: "sqlite_local" | "sqlite_ephemeral_tmp" | "supabase_postgres";
  supabaseConfigured: boolean;
  supabaseAuthenticatedUserEmail: string | null;
  quranFoundationOAuthConfigured: boolean;
  asrProviderConfigured: boolean;
  sqlitePath: string | null;
}

export interface ProgressRepository {
  getDashboardSnapshot(userId?: string): Promise<DashboardStateSnapshot>;
  submitCardReview(params: {
    cardId: string;
    rating: ReviewRating;
    choice?: ReviewChoice;
    responseTimeMs?: number;
    userId?: string;
  }): Promise<{
    updatedCard: StoredLearningCard;
    xpAwarded: number;
    intervalLabelTr: string;
  }>;
  ensureVocabularyCard(params: {
    wordLocation: string;
    direction?: CardDirection;
    userId?: string;
  }): Promise<StoredLearningCard>;
  ensureSurahVocabularyCards(params: {
    surahId: number;
    direction?: CardDirection;
    userId?: string;
  }): Promise<{ addedCount: number; totalSurahCards: number }>;
  updateVerseMemorization(params: {
    verseKey: string;
    outcome: "failed_recall" | "partial_recall" | "clean_recall" | "delayed_clean_recall";
    comprehensionDelta?: number;
    userId?: string;
  }): Promise<VerseProgressRecord>;
  markPageStudied(params: {
    pageNumber: number;
    userId?: string;
  }): Promise<void>;
  toggleBookmark(params: {
    verseKey: string;
    pageNumber: number;
    label?: string;
    userId?: string;
  }): Promise<{ bookmarked: boolean }>;
  saveNote(params: {
    verseKey: string;
    pageNumber: number;
    noteText: string;
    isDifficult: boolean;
    userId?: string;
  }): Promise<UserNoteRecord>;
  savePlacementResult(params: {
    score: number;
    maxScore: number;
    scorePercent: number;
    levelLabelTr: string;
    masteredModuleIds: string[];
    userId?: string;
  }): Promise<void>;
  completeReadingModule(params: { moduleId: string; userId?: string }): Promise<void>;
  markTajweedPracticed(params: { slug: string; userId?: string }): Promise<void>;
  updatePreferences(
    params: Partial<UserPreferencesRecord> & {
      sessionMode?: SessionMode;
      dailyTargetMinutes?: number;
      displayName?: string;
      currentPageNumber?: number;
      userId?: string;
    }
  ): Promise<void>;
  saveRecordingMetadata(params: {
    id: string;
    verseKey: string;
    durationMs: number;
    consentGranted: boolean;
    userId?: string;
  }): Promise<RecordingMetadataRecord>;
  deleteRecordingMetadata(params: { id: string; userId?: string }): Promise<void>;
  logStudyActivity(params: {
    minutesStudied: number;
    reviewsCompleted?: number;
    xpEarned?: number;
    userId?: string;
  }): Promise<void>;
  createCard?(params: {
    cardType: CardType;
    targetKey: string;
    direction: CardDirection;
    userId?: string;
  }): Promise<StoredLearningCard>;
}
