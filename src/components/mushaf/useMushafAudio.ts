"use client";

import { useEffect, useRef, useState } from "react";
import type { CanonicalVerse, MushafPageData } from "@/lib/content/types";
import { getReciterAyahAudioUrl } from "@/lib/audio/reciters";
import { buildRangePlaybackQueue, type RangePlaybackStep } from "@/lib/audio/range-loop-player";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    return () => {
      pageLoopCancelRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  function stopAudio() {
    pageLoopCancelRef.current = true;
    setIsPageLooping(false);
    setPageLoopStep(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
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

      const finished = await new Promise<boolean>((resolve) => {
        if (pageLoopCancelRef.current) {
          resolve(false);
          return;
        }
        const audio = new Audio(url);
        audio.playbackRate = playbackSpeed;
        audioRef.current = audio;
        audio.onended = () => resolve(true);
        audio.onerror = () => {
          setAudioError("Döngü oynatma sırasında ses dosyası yüklenemedi.");
          resolve(false);
        };
        audio.play().catch(() => {
          setAudioError("Tarayıcı ses oynatmayı engelledi; lütfen tekrar tıklayın.");
          resolve(false);
        });
      });

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
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;
    setPlayingMode(mode);
    setActiveChapterSurahId(surahId);
    setActiveAudioVerseKey(verseKey);

    if (mode === "chapter") {
      audio.ontimeupdate = () => {
        const ms = audio.currentTime * 1000;
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
      };
    }

    audio.onended = () => {
      setPlayingMode("idle");
      setActiveChapterSurahId(null);
      setActiveAudioVerseKey(null);
      setActiveAudioWordPos(null);
    };

    audio.onerror = () => {
      setAudioError("Ses dosyası yüklenemedi. İnternet bağlantınızı kontrol edin.");
      setPlayingMode("idle");
      setActiveChapterSurahId(null);
    };

    audio.play().catch(() => {
      setAudioError("Tarayıcı ses oynatmayı engelledi; lütfen tekrar tıklayın.");
      setPlayingMode("idle");
      setActiveChapterSurahId(null);
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
