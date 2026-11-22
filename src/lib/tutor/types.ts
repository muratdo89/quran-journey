export type TutorPhase =
  | "welcome"
  | "reading"
  | "tajweed"
  | "vocabulary"
  | "hifz_listen"
  | "hifz_recite"
  | "wrap_up";

export type TutorPace = "normal" | "short";

export interface TutorAudioCue {
  kind: "ayah" | "word" | "example";
  url: string;
  labelTr: string;
  autoPlay: boolean;
  playbackRate?: number;
  repeatCount?: number;
}

export interface TutorRecitationWordDiff {
  type: "match" | "missing" | "substitution" | "extra";
  expectedWord?: string;
  recognizedWord?: string;
}

export interface TutorRecitationCheck {
  verseKey: string;
  wordMatchRatio: number;
  matchedCount: number;
  expectedCount: number;
  missedWords: string[];
  diffs: TutorRecitationWordDiff[];
  requiresHumanReview: true;
  summaryTr: string;
}

export type TutorStageCard =
  | {
      kind: "brief";
      pageNumber: number;
      surahNameTr: string;
      dueCardsCount: number;
      remainingReadingModules: number;
      remainingTajweedLessons: number;
      estimatedMinutes: number;
    }
  | {
      kind: "reading_module";
      moduleId: string;
      titleTr: string;
      subtitleTr: string;
      explanationTr: string;
      commonMistakeTr: string;
      examples: Array<{
        arabic: string;
        labelTr: string;
        audioUrl?: string;
      }>;
    }
  | {
      kind: "tajweed_lesson";
      slug: string;
      nameTr: string;
      nameArabic: string;
      summaryTr: string;
      listenTipTr: string;
      exampleArabic?: string;
      exampleExplanationTr?: string;
      exampleAudioUrl?: string;
    }
  | {
      kind: "vocabulary_quiz";
      cardId: string | null;
      wordLocation: string;
      verseKey: string;
      surahNameTr: string;
      textUthmani: string;
      turkishReading: string | null;
      meaningTr: string;
      verseTranslationTr: string;
      rootArabic: string | null;
      audioUrl: string | null;
      revealed: boolean;
    }
  | {
      kind: "verse_study";
      verseKey: string;
      surahNameTr: string;
      pageNumber: number;
      textUthmani: string;
      translationTr: string;
      reciterNameTr: string;
      audioUrl: string | null;
      hideArabicText: boolean;
      mutashabihatCount: number;
      recitationCheck?: TutorRecitationCheck;
    }
  | {
      kind: "summary";
      completedCount: number;
      summaryPointsTr: string[];
      nextPageNumber: number;
    };

export interface TutorHistoryMessage {
  role: "user" | "assistant";
  text: string;
}

export interface TutorSessionState {
  phase: TutorPhase;
  pace: TutorPace;
  currentPageNumber: number;
  currentVerseKey: string | null;
  currentWordLocation: string | null;
  currentCardId: string | null;
  currentReadingModuleId: string | null;
  currentTajweedSlug: string | null;
  playbackRate: number;
  attemptCount: number;
  vocabDoneCount: number;
  versesDoneCount: number;
  warmupDone: boolean;
  askedWordLocations: string[];
  history: TutorHistoryMessage[];
}

export interface TutorTurnRequest {
  action?: "start" | "user_speech" | "recitation_result" | "next_step";
  userText?: string;
  recitationTranscript?: string;
  reciterId?: number;
  hifzActivePage?: number;
  hifzReviewPages?: number[];
  skipInlineTts?: boolean;
  sessionState: TutorSessionState;
}

export interface TutorTurnResponse {
  replyTr: string;
  phase: TutorPhase;
  expectingLanguage: "tr" | "ar";
  stageCard: TutorStageCard | null;
  audioCue: TutorAudioCue | null;
  teacherAudioDataUrl?: string | null;
  providerDiagnosticTr?: string | null;
  recitationCheck?: TutorRecitationCheck;
  suggestedVoiceCommandsTr: string[];
  providerMode: "gemini" | "local_guided";
  sessionState: TutorSessionState;
}

export function createInitialTutorSessionState(currentPageNumber = 1): TutorSessionState {
  return {
    phase: "welcome",
    pace: "normal",
    currentPageNumber: Math.max(1, Math.min(604, currentPageNumber)),
    currentVerseKey: null,
    currentWordLocation: null,
    currentCardId: null,
    currentReadingModuleId: null,
    currentTajweedSlug: null,
    playbackRate: 1,
    attemptCount: 0,
    vocabDoneCount: 0,
    versesDoneCount: 0,
    warmupDone: false,
    askedWordLocations: [],
    history: [],
  };
}
