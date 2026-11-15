"use client";

import { useState } from "react";
import type { UserPreferencesRecord } from "@/lib/db/types";
import { persistPreferences } from "./shared";

/** Reader preferences for the Mushaf page; every change is saved to /api/preferences. */
export function useReaderPreferences(initial: UserPreferencesRecord) {
  const [fontSize, setFontSizeState] = useState(initial.arabicFontSize);
  const [lineHeight, setLineHeightState] = useState(initial.arabicLineHeight);
  const [darkReader, setDarkReaderState] = useState(initial.themeMode === "dark");
  const [showTranslation, setShowTranslationState] = useState(initial.showTranslationDefault);
  const [showTransliteration, setShowTransliterationState] = useState(
    initial.showTransliteration
  );
  const [translationId, setTranslationIdState] = useState(initial.preferredTranslationId);
  const [reciterId, setReciterIdState] = useState(initial.preferredReciterId);
  const [playbackSpeed, setPlaybackSpeedState] = useState(initial.playbackSpeed);
  const [cloudConsent, setCloudConsentState] = useState(initial.cloudAiAudioConsent);
  // Session-only (not persisted)
  const [showTajweedColors, setShowTajweedColors] = useState(true);

  return {
    fontSize,
    lineHeight,
    darkReader,
    showTranslation,
    showTransliteration,
    translationId,
    reciterId,
    playbackSpeed,
    cloudConsent,
    showTajweedColors,
    setFontSize(value: number) {
      setFontSizeState(value);
      persistPreferences({ arabicFontSize: value });
    },
    setLineHeight(value: number) {
      setLineHeightState(value);
      persistPreferences({ arabicLineHeight: value });
    },
    setDarkReader(value: boolean) {
      setDarkReaderState(value);
      persistPreferences({ themeMode: value ? "dark" : "light" });
    },
    setShowTranslation(value: boolean) {
      setShowTranslationState(value);
      persistPreferences({ showTranslationDefault: value });
    },
    setShowTransliteration(value: boolean) {
      setShowTransliterationState(value);
      persistPreferences({ showTransliteration: value });
    },
    setTranslationId(value: number) {
      setTranslationIdState(value);
      persistPreferences({ preferredTranslationId: value });
    },
    setReciterId(value: number) {
      setReciterIdState(value);
      persistPreferences({ preferredReciterId: value });
    },
    setPlaybackSpeed(value: number) {
      setPlaybackSpeedState(value);
      persistPreferences({ playbackSpeed: value });
    },
    setCloudConsent(value: boolean) {
      setCloudConsentState(value);
      persistPreferences({ cloudAiAudioConsent: value });
    },
    toggleTajweedColors() {
      setShowTajweedColors((v) => !v);
    },
  };
}

export type ReaderPreferences = ReturnType<typeof useReaderPreferences>;
