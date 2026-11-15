"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CanonicalVerse } from "@/lib/content/types";
import { getReciterAyahAudioUrl } from "@/lib/audio/reciters";
import { playSharedClip, type ClipHandle } from "@/lib/audio/shared-player";
import {
  DEFAULT_LISTEN_REPEAT_SETTINGS,
  buildListenRepeatQueue,
  computeRepeatPauseMs,
  findNeighbourGroupStart,
  normalizeListenRepeatSettings,
  type ListenRepeatSettings,
  type ListenRepeatStep,
} from "@/lib/audio/listen-repeat";

const SETTINGS_STORAGE_KEY = "qj.listenRepeat.v1";

/** "listen": the qari is reading; "repeat": the learner's turn; "verse": whole verse playback. */
export type ListenRepeatPhase = "idle" | "listen" | "repeat" | "verse" | "paused";

interface UseListenRepeatOptions {
  allVersesOnPage: CanonicalVerse[];
  reciterId: number;
  /**
   * Called as the drill moves (word location is null for whole-verse playback), so the
   * page selection follows along and a restart picks up where the learner stopped.
   */
  onStepChange: (verseKey: string, wordLocation: string | null) => void;
}

// Settings live in this browser only (per-viewer convenience). The raw JSON string is
// the store snapshot, so React compares it by value; SSR always renders the defaults.
const settingsListeners = new Set<() => void>();
let settingsMemoryFallback = "";

function subscribeSettings(onChange: () => void) {
  settingsListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    settingsListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readSettingsSnapshot(): string {
  try {
    return window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? settingsMemoryFallback;
  } catch {
    return settingsMemoryFallback;
  }
}

function writeSettingsSnapshot(value: string) {
  settingsMemoryFallback = value;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, value);
  } catch {
    // Private mode / blocked storage: the in-memory copy keeps them for this visit.
  }
  settingsListeners.forEach((listener) => listener());
}

function parseSettings(raw: string): ListenRepeatSettings {
  if (!raw) return DEFAULT_LISTEN_REPEAT_SETTINGS;
  try {
    return normalizeListenRepeatSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_LISTEN_REPEAT_SETTINGS;
  }
}

/**
 * Listen-and-repeat drill: plays the word-by-word recording of each word (or small
 * group), waits for the learner to repeat it, then continues. Pausing cancels the
 * current step; resuming replays that step from its start.
 */
export function useListenRepeat({ allVersesOnPage, reciterId, onStepChange }: UseListenRepeatOptions) {
  const rawSettings = useSyncExternalStore(subscribeSettings, readSettingsSnapshot, () => "");
  const settings = useMemo(() => parseSettings(rawSettings), [rawSettings]);
  const [queue, setQueue] = useState<ListenRepeatStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<ListenRepeatPhase>("idle");
  /** Length of the current "your turn" pause, for the progress bar. */
  const [pauseMs, setPauseMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const clipRef = useRef<ClipHandle | null>(null);
  const cancelWaitRef = useRef<(() => void) | null>(null);
  // The running drill reads the latest settings/callback, so changes apply from the next step.
  const settingsRef = useRef(settings);
  const onStepChangeRef = useRef(onStepChange);
  useEffect(() => {
    settingsRef.current = settings;
    onStepChangeRef.current = onStepChange;
  }, [settings, onStepChange]);

  const cancelCurrent = useCallback(() => {
    runIdRef.current += 1;
    cancelWaitRef.current?.();
    cancelWaitRef.current = null;
    clipRef.current?.stop();
    clipRef.current = null;
  }, []);

  useEffect(() => cancelCurrent, [cancelCurrent]);

  function updateSettings(patch: Partial<ListenRepeatSettings>) {
    const next = normalizeListenRepeatSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = next;
    writeSettingsSnapshot(JSON.stringify(next));
  }

  /**
   * Resolves with how long the learner heard the clip (ms, after the speed change),
   * or null when it was cancelled or failed.
   */
  async function playClip(url: string, rate: number, runId: number): Promise<number | null> {
    if (runId !== runIdRef.current) return null;
    // Always the same (tap-unlocked) audio element: a new Audio() created after the
    // "your turn" pause is blocked by mobile Safari's autoplay rules.
    const clip = playSharedClip(url, { rate });
    clipRef.current = clip;
    const result = await clip.done;
    if (clipRef.current === clip) clipRef.current = null;
    if (runId !== runIdRef.current) return null;
    if (result.status === "ended") return result.heardMs;
    if (result.status === "blocked") setError("Tarayıcı sesi engelledi; Devam'a bir kez dokunun.");
    if (result.status === "error") setError("Kelime sesi yüklenemedi. İnternet bağlantınızı kontrol edin.");
    return null;
  }

  function wait(ms: number, runId: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (runId !== runIdRef.current) {
        resolve(false);
        return;
      }
      const timer = window.setTimeout(() => resolve(runId === runIdRef.current), ms);
      cancelWaitRef.current = () => {
        window.clearTimeout(timer);
        resolve(false);
      };
    });
  }

  async function runFrom(steps: ListenRepeatStep[], fromIndex: number) {
    cancelCurrent();
    const runId = runIdRef.current;
    setError(null);
    const verseByKey = new Map(allVersesOnPage.map((v) => [v.verseKey, v]));

    for (let i = fromIndex; i < steps.length; i += 1) {
      if (runId !== runIdRef.current) return;
      const step = steps[i]!;
      const { speed, pause } = settingsRef.current;
      setStepIndex(i);
      onStepChangeRef.current(
        step.verseKey,
        step.kind === "words" ? (step.words[0]?.location ?? null) : null
      );

      if (step.kind === "verse") {
        const verse = verseByKey.get(step.verseKey);
        const url = verse ? getReciterAyahAudioUrl(verse, reciterId) : null;
        if (!url) continue;
        setPhase("verse");
        if ((await playClip(url, speed, runId)) === null) return stopIfFailed(runId);
        if (!(await wait(800, runId))) return;
        continue;
      }

      setPhase("listen");
      let listenedMs = 0;
      for (const word of step.words) {
        const played = await playClip(word.audioUrl, speed, runId);
        if (played === null) return stopIfFailed(runId);
        listenedMs += played;
      }
      const ms = computeRepeatPauseMs(listenedMs, pause);
      setPauseMs(ms);
      setPhase("repeat");
      if (!(await wait(ms, runId))) return;
    }

    if (runId === runIdRef.current) {
      setPhase("idle");
      setQueue([]);
      setStepIndex(0);
    }
  }

  /** A failed clip (not a user cancel) leaves the drill paused on that step so it can be retried. */
  function stopIfFailed(runId: number) {
    if (runId === runIdRef.current) {
      setPhase("paused");
    }
  }

  /** Starts the drill at a word location (e.g. the selected word). */
  function start(startLocation: string | null) {
    const steps = buildListenRepeatQueue(allVersesOnPage, startLocation, settingsRef.current);
    if (steps.length === 0) {
      setError("Bu bölümde kelime kelime ses kaydı bulunamadı.");
      return;
    }
    setQueue(steps);
    void runFrom(steps, 0);
  }

  const stop = useCallback(() => {
    cancelCurrent();
    setPhase("idle");
    setQueue([]);
    setStepIndex(0);
  }, [cancelCurrent]);

  function pause() {
    if (phase === "idle" || phase === "paused") return;
    cancelCurrent();
    setPhase("paused");
  }

  function resume() {
    if (phase !== "paused" || queue.length === 0) return;
    void runFrom(queue, stepIndex);
  }

  function goTo(direction: -1 | 1) {
    if (queue.length === 0) return;
    const target = findNeighbourGroupStart(queue, stepIndex, direction);
    if (target >= queue.length) {
      stop();
      return;
    }
    void runFrom(queue, target);
  }

  const isActive = phase !== "idle";
  const currentStep = isActive ? (queue[stepIndex] ?? null) : null;

  return {
    settings,
    updateSettings,
    phase,
    isActive,
    currentStep,
    stepIndex,
    pauseMs,
    error,
    start,
    stop,
    pause,
    resume,
    previous: () => goTo(-1),
    next: () => goTo(1),
  };
}

export type ListenRepeat = ReturnType<typeof useListenRepeat>;
