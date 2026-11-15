"use client";

import { useEffect, useRef, useState } from "react";
import type { CanonicalVerse, MushafPageData } from "@/lib/content/types";
import { getReciterAyahAudioUrl } from "@/lib/audio/reciters";
import { buildRangePlaybackQueue, type RangePlaybackStep } from "@/lib/audio/range-loop-player";
import {
  AUDIO_BLOCKED_MESSAGE,
  AUDIO_LOAD_ERROR_MESSAGE,
  playSharedClip,
  type ClipHandle,
} from "@/lib/audio/shared-player";

export type MushafPlayingMode = "idle" | "chapter" | "ayah" | "word";

interface UseMushafAudioOptions {
  pageData: MushafPageData;
  allVersesOnPage: CanonicalVerse[];
  reciterId: number;
  playbackSpeed: number;
  /** Called when playback moves to a verse (ayah play and page loop steps). */
  onSelectVerse: (verseKey: string) => void;
}

/** Chapter (word-synced), ayah, word and looped page playback for the Mushaf page. */
export function useMushafAudio({
  pageData,
  allVersesOnPage,
  reciterId,
  playbackSpeed,
  onSelectVerse,
}: UseMushafAudioOptions) {
  // Handle on the shared, tap-unlocked audio element (see shared-player.ts).
  const clipRef = useRef<ClipHandle | null>(null);
  const [playingMode, setPlayingMode] = useState<MushafPlayingMode>("idle");
  const [activeChapterSurahId, setActiveChapterSurahId] = useState<number | null>(null);
  const [activeAudioVerseKey, setActiveAudioVerseKey] = useState<string | null>(null);
  const [activeAudioWordPos, setActiveAudioWordPos] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Phase 7B: Page-level looped ayah playback
  const [pageLoopRepeatCount, setPageLoopRepeatCount] = useState<number>(2);
  const [isPageLooping, setIsPageLooping] = useState(false);
  const [pageLoopStep, setPageLoopStep] = useState<RangePlaybackStep | null>(null);
  const pageLoopCancelRef = useRef<boolean>(false);

  useEffect(() => {
    clipRef.current?.setRate(playbackSpeed);
  }, [playbackSpeed]);

  useEffect(() => {
    return () => {
      pageLoopCancelRef.current = true;
      clipRef.current?.stop();
    };
  }, []);

  function stopAudio() {
    pageLoopCancelRef.current = true;
    setIsPageLooping(false);
    setPageLoopStep(null);
    clipRef.current?.stop();
    clipRef.current = null;
    setPlayingMode("idle");
    setActiveChapterSurahId(null);
    setActiveAudioVerseKey(null);
    setActiveAudioWordPos(null);
  }

  async function startPageLoop() {
    if (isPageLooping) {
      stopAudio();
      return;
    }

    const queue: RangePlaybackStep[] = [];
    for (const section of pageData.sections) {
      if (section.verses.length === 0) continue;
      const sectionQueue = buildRangePlaybackQueue(section.verses, {
        startVerseNumber: section.verses[0]!.verseNumber,
        endVerseNumber: section.verses[section.verses.length - 1]!.verseNumber,
        verseRepeatCount: pageLoopRepeatCount,
        rangeRepeatCount: 1,
      });
      queue.push(...sectionQueue);
    }

    if (queue.length === 0) return;

    stopAudio();
    pageLoopCancelRef.current = false;
    setIsPageLooping(true);
    setAudioError(null);

    const verseByKey = new Map(allVersesOnPage.map((v) => [v.verseKey, v]));

    for (let idx = 0; idx < queue.length; idx += 1) {
      if (pageLoopCancelRef.current) break;
      const step = { ...queue[idx]!, stepIndex: idx, totalSteps: queue.length };
      const verse = verseByKey.get(step.verseKey);
      if (!verse) continue;
      const url = getReciterAyahAudioUrl(verse, reciterId);
      if (!url) continue;

      setPageLoopStep(step);
      setPlayingMode("ayah");
      setActiveAudioVerseKey(verse.verseKey);
      onSelectVerse(verse.verseKey);

      if (pageLoopCancelRef.current) break;
      // Next verse starts after an await, so it must reuse the unlocked shared element.
      const clip = playSharedClip(url, { rate: playbackSpeed });
      clipRef.current = clip;
      const result = await clip.done;
      if (result.status === "error") setAudioError("Döngü oynatma sırasında ses dosyası yüklenemedi.");
      if (result.status === "blocked") setAudioError(AUDIO_BLOCKED_MESSAGE);
      const finished = result.status === "ended";

      if (!finished || pageLoopCancelRef.current) break;
    }

    if (!pageLoopCancelRef.current) {
      setPlayingMode("idle");
      setActiveAudioVerseKey(null);
    }
    setIsPageLooping(false);
    setPageLoopStep(null);
  }

  function playUrl(
    url: string,
    mode: "chapter" | "ayah" | "word",
    verseKey: string | null = null,
    sectionVerses: CanonicalVerse[] = [],
    surahId: number | null = null
  ) {
    setAudioError(null);
    setPlayingMode(mode);
    setActiveChapterSurahId(surahId);
    setActiveAudioVerseKey(verseKey);

    const onTimeUpdate =
      mode === "chapter"
        ? (seconds: number) => {
            const ms = seconds * 1000;
            let matchedVerse: string | null = null;
            let matchedWord: number | null = null;
            for (const v of sectionVerses) {
              const seg = v.audio.alafasyChapterSegment;
              if (!seg) continue;
              if (ms >= seg.timestampFromMs && ms <= seg.timestampToMs) {
                matchedVerse = v.verseKey;
                for (const [wordPos, startMs, endMs] of seg.segments) {
                  if (ms >= startMs && ms <= endMs) {
                    matchedWord = wordPos;
                    break;
                  }
                }
                break;
              }
            }
            setActiveAudioVerseKey(matchedVerse);
            setActiveAudioWordPos(matchedWord);
          }
        : undefined;

    const clip = playSharedClip(url, { rate: playbackSpeed, onTimeUpdate });
    clipRef.current = clip;
    void clip.done.then((result) => {
      // Replaced by a newer clip from this page: that one owns the state now.
      if (clipRef.current !== clip) return;
      clipRef.current = null;
      if (result.status === "error") setAudioError(AUDIO_LOAD_ERROR_MESSAGE);
      if (result.status === "blocked") setAudioError(AUDIO_BLOCKED_MESSAGE);
      setPlayingMode("idle");
      setActiveChapterSurahId(null);
      setActiveAudioVerseKey(null);
      setActiveAudioWordPos(null);
    });
  }

  function playSectionChapter(section: MushafPageData["sections"][number]) {
    if (playingMode === "chapter" && activeChapterSurahId === section.surah.id) {
      stopAudio();
      return;
    }
    if (!section.chapterAudioUrl) return;
    playUrl(
      section.chapterAudioUrl,
      "chapter",
      section.verses[0]?.verseKey ?? null,
      section.verses,
      section.surah.id
    );
  }

  function playVerse(verse: CanonicalVerse) {
    const url = getReciterAyahAudioUrl(verse, reciterId);
    if (!url) return;
    if (playingMode === "ayah" && activeAudioVerseKey === verse.verseKey) {
      stopAudio();
      return;
    }
    onSelectVerse(verse.verseKey);
    playUrl(url, "ayah", verse.verseKey);
  }

  function playWord(url: string, verseKey: string) {
    playUrl(url, "word", verseKey);
  }

  return {
    playingMode,
    activeChapterSurahId,
    activeAudioVerseKey,
    activeAudioWordPos,
    audioError,
    pageLoopRepeatCount,
    setPageLoopRepeatCount,
    isPageLooping,
    pageLoopStep,
    startPageLoop,
    playSectionChapter,
    playVerse,
    playWord,
    stopAudio,
  };
}

export type MushafAudio = ReturnType<typeof useMushafAudio>;
