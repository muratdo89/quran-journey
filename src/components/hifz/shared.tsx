"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Pause, Play } from "lucide-react";
import { playSharedClip, stopSharedAudio, AUDIO_BLOCKED_MESSAGE, type ClipHandle } from "@/lib/audio/shared-player";
import type { HifzPageData, HifzVerse } from "@/lib/hifz/page-data";
import type { HifzRating } from "@/lib/hifz/plan";
import { cn } from "@/lib/utils";

/* ---------- data ---------- */

const pageCache = new Map<number, Promise<HifzPageData>>();

export function loadHifzPage(page: number): Promise<HifzPageData> {
  let hit = pageCache.get(page);
  if (!hit) {
    hit = fetch(`/api/hifz/page?page=${page}`).then((r) => {
      if (!r.ok) throw new Error("load failed");
      return r.json() as Promise<HifzPageData>;
    });
    hit.catch(() => pageCache.delete(page));
    pageCache.set(page, hit);
  }
  return hit;
}

export function useHifzPage(page: number) {
  const [state, setState] = useState<{ page: number; attempt: number; data: HifzPageData | null; error: boolean }>({
    page: -1,
    attempt: 0,
    data: null,
    error: false,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    loadHifzPage(page).then(
      (data) => alive && setState({ page, attempt, data, error: false }),
      () => alive && setState({ page, attempt, data: null, error: true })
    );
    return () => {
      alive = false;
    };
  }, [page, attempt]);
  const fresh = state.page === page && state.attempt === attempt;
  return {
    data: fresh ? state.data : null,
    error: fresh && state.error,
    retry: () => setAttempt((a) => a + 1),
  };
}

/* ---------- audio ---------- */

/**
 * Plays verses one after another, `times` rounds, on the shared (tap-unlocked) audio element.
 * `activeKey` is the verse being recited, for highlighting.
 */
export function useVersePlayer() {
  const clipRef = useRef<ClipHandle | null>(null);
  const runRef = useRef(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [blocked, setBlocked] = useState(false);

  const stop = useCallback(() => {
    runRef.current += 1;
    clipRef.current?.stop();
    clipRef.current = null;
    setActiveKey(null);
    setRound(0);
  }, []);

  const play = useCallback(async (verses: HifzVerse[], times = 1, rate = 1) => {
    const run = (runRef.current += 1);
    setBlocked(false);
    for (let r = 1; r <= times; r++) {
      for (const v of verses) {
        if (runRef.current !== run) return;
        if (!v.audioUrl) continue;
        setRound(r);
        setActiveKey(v.key);
        const clip = playSharedClip(v.audioUrl, { rate });
        clipRef.current = clip;
        const result = await clip.done;
        if (runRef.current !== run) return;
        if (result.status === "blocked") {
          setBlocked(true);
          setActiveKey(null);
          return;
        }
        if (result.status !== "ended") break;
      }
    }
    if (runRef.current === run) {
      setActiveKey(null);
      setRound(0);
    }
  }, []);

  useEffect(
    () => () => {
      runRef.current += 1;
      stopSharedAudio();
    },
    []
  );

  return { play, stop, activeKey, round, playing: activeKey !== null, blocked };
}

/* ---------- pieces ---------- */

export function PlayToggle({
  playing,
  onPlay,
  onStop,
  label,
  className,
}: {
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={playing ? onStop : onPlay}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-forest hover:bg-sand",
        className
      )}
    >
      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
      {playing ? "Durdur" : label}
    </button>
  );
}

export function AudioBlockedNote({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="text-center text-xs font-semibold text-gold-ink">{AUDIO_BLOCKED_MESSAGE}</p>;
}

export function VerseNumber({ n }: { n: number }) {
  return (
    <span className="mx-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gold-line px-1 align-middle font-sans text-[11px] font-semibold text-gold-ink">
      {n}
    </span>
  );
}

export function SurahTitle({ verse }: { verse: HifzVerse }) {
  if (!verse.startsSurah) return null;
  return (
    <p className="pt-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-gold-ink">
      {verse.surahNameTr} Suresi
    </p>
  );
}

/** A verse with every word hidden; tapping a word shows it. `revealAll` shows the whole verse. */
export function HiddenVerse({
  verse,
  revealAll,
  active,
  showMeal,
}: {
  verse: HifzVerse;
  revealAll: boolean;
  active?: boolean;
  showMeal?: boolean;
}) {
  // Parents remount this (new `key`) to hide the verse again.
  const [shown, setShown] = useState<Set<number>>(() => new Set());

  return (
    <div className={cn("rounded-2xl px-3 py-3 transition-colors", active && "bg-mint")}>
      <p dir="rtl" lang="ar" className="font-arabic text-[1.65rem] leading-[2.6] text-ink">
        {verse.words.map((w, i) => {
          const visible = revealAll || shown.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setShown((s) => new Set(s).add(i))}
              aria-label={visible ? w.text : "Gizli kelime, göstermek için dokun"}
              className={cn(
                "mx-[3px] inline-block rounded-lg px-1 align-middle leading-[1.7] transition-colors",
                visible ? "text-ink" : "bg-sand-strong text-transparent select-none"
              )}
            >
              {w.text}
            </button>
          );
        })}
        <VerseNumber n={verse.verseNumber} />
      </p>
      {showMeal && <p className="mt-1 text-sm leading-relaxed text-muted">{verse.meal}</p>}
    </div>
  );
}

export function VisibleVerse({ verse, active, showReading }: { verse: HifzVerse; active?: boolean; showReading?: boolean }) {
  return (
    <div className={cn("rounded-2xl px-3 py-3 transition-colors", active && "bg-mint")}>
      <p dir="rtl" lang="ar" className="font-arabic text-[1.65rem] leading-[2.4] text-ink">
        {verse.text}
        <VerseNumber n={verse.verseNumber} />
      </p>
      {showReading && verse.reading && <p className="mt-1 text-sm italic leading-relaxed text-ink-soft">{verse.reading}</p>}
    </div>
  );
}

export function MealToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:text-forest"
    >
      {on ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      {on ? "Meali gizle" : "İpucu: meal"}
    </button>
  );
}

export function RevealAllToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:text-forest"
    >
      {on ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      {on ? "Yeniden gizle" : "Hepsini göster"}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-forest px-6 py-4 text-base font-semibold text-parchment shadow-sm shadow-forest/20 transition-colors hover:bg-forest-deep disabled:opacity-50"
    >
      {children}
    </button>
  );
}

const RATINGS: { id: HifzRating; label: string; hint: string; cls: string }[] = [
  { id: "unuttum", label: "Unuttum", hint: "Yeniden öğren", cls: "border-line bg-surface text-ink hover:bg-sand" },
  { id: "takildim", label: "Takıldım", hint: "Yarın yine", cls: "border-gold-line bg-gold-soft text-gold-text hover:bg-gold-line/60" },
  { id: "akici", label: "Akıcı", hint: "Sağlam", cls: "border-forest bg-forest text-parchment hover:bg-forest-deep" },
];

export function RatingButtons({ onRate }: { onRate: (r: HifzRating) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {RATINGS.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onRate(r.id)}
          className={cn("flex flex-col items-center rounded-2xl border px-2 py-3 transition-colors", r.cls)}
        >
          <span className="text-sm font-semibold">{r.label}</span>
          <span className="text-[11px] opacity-80">{r.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function LoadingCard({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  return (
    <div className="rounded-[28px] border border-line bg-surface p-8 text-center text-sm text-muted">
      {error ? (
        <>
          Sayfa yüklenemedi.{" "}
          <button type="button" onClick={onRetry} className="font-semibold text-forest underline">
            Tekrar dene
          </button>
        </>
      ) : (
        "Sayfa hazırlanıyor…"
      )}
    </div>
  );
}
