import type { CanonicalVerse } from "@/lib/content/types";
import type { UserPreferencesRecord } from "@/lib/db/types";

export interface RootOccurrencePreview {
  location: string;
  verseKey: string;
  textUthmani: string;
  translationTr: string;
  pageNumber: number;
}

export interface SearchVerseItem {
  verseKey: string;
  surahId: number;
  surahNameTr: string;
  pageNumber: number;
  textUthmani: string;
  translationDiyanet: string;
  translationElmalili: string;
}

export interface LocalAudioBlobEntry {
  id: string;
  verseKey: string;
  objectUrl: string;
  durationMs: number;
  createdAt: string;
}

export const POS_LABELS_TR: Record<string, string> = {
  N: "İsim",
  PN: "Özel İsim",
  V: "Fiil",
  P: "Edat / Harf",
  DET: "Belirlilik Takısı",
  ADJ: "Sıfat",
  PREF: "Ön Ek",
  PRON: "Zamir",
};

export const OFFLINE_CACHE_NAME = "quran-journey-offline-data-v1";

export function isEnglishFallbackGloss(text: string): boolean {
  return (
    /^[A-Za-z0-9\s().,;:'"-]+$/.test(text) &&
    /\b(the|of|and|to|in|is|not|for|he|they|you|my|your|from|with|by|all|what|when|who|upon|his|her|will|shall|have|be|as)\b/i.test(
      text
    )
  );
}

/** The verse translation matching the reader's chosen source, or the first available one. */
export function getActiveTranslation(verse: CanonicalVerse, translationId: number) {
  return verse.translations.find((t) => t.resourceId === translationId) ?? verse.translations[0];
}

export async function persistPreferences(
  patch: Partial<UserPreferencesRecord> & { currentPageNumber?: number }
) {
  await fetch("/api/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => {});
}
