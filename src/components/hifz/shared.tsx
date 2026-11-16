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

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]!);

/** Mushaf-style verse end mark: ﴿٣﴾ in gold, inside the Arabic line. */
export function AyahMark({ n }: { n: number }) {
  return (
    <span aria-label={`${n}. ayet`} className="mx-1 whitespace-nowrap font-arabic text-[0.8em] text-gold">
      ﴿{toArabicDigits(n)}﴾
    </span>
  );
}

export function SurahBanner({ verse }: { verse: HifzVerse }) {
  if (!verse.startsSurah) return null;
  return (
    <div className="flex items-center gap-3 pt-4 pb-1" aria-label={`${verse.surahNameTr} Suresi`}>
      <span className="h-px flex-1 bg-gold-line" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-ink">{verse.surahNameTr} Suresi</span>
      <span className="h-px flex-1 bg-gold-line" />
    </div>
  );
}

/**
 * One verse, the same shape on every step: Arabic centred like a Mushaf line, then optional
 * Turkish reading, meal and key words. `hidden` blurs every word; a tap on a word shows it.
 * Parents change the `key` to hide the verse again.
 */
export function VerseBlock({
  verse,
  hidden = false,
  revealAll = false,
  active = false,
  showReading = false,
  showMeal = false,
  showKeyWords = false,
}: {
  verse: HifzVerse;
  hidden?: boolean;
  revealAll?: boolean;
  active?: boolean;
  showReading?: boolean;
  showMeal?: boolean;
  showKeyWords?: boolean;
}) {
  const [shown, setShown] = useState<Set<number>>(() => new Set());
  const keyWords = showKeyWords ? verse.keyWords.map((i) => verse.words[i]!).filter(Boolean) : [];

  return (
    <div className={cn("-mx-1 rounded-2xl px-1 py-4 transition-colors", active && "bg-mint")}>
      <p dir="rtl" lang="ar" className="text-center font-arabic text-[1.9rem] leading-[2.25] text-ink sm:text-[2.1rem]">
        {hidden
          ? verse.words.map((w, i) => {
              const visible = revealAll || shown.has(i);
              return (
                <React.Fragment key={i}>
                  <button
                    type="button"
                    onClick={() => setShown((s) => new Set(s).add(i))}
                    aria-label={visible ? w.text : "Gizli kelime, göstermek için dokun"}
                    className={cn(
                      "rounded-md transition-[filter,opacity] duration-200",
                      visible ? "" : "select-none opacity-40 blur-[7px]"
                    )}
                  >
                    {w.text}
                  </button>{" "}
                </React.Fragment>
              );
            })
          : verse.text}
        <AyahMark n={verse.verseNumber} />
      </p>
      {showReading && verse.reading && (
        <p className="mt-1 text-center text-[15px] italic leading-relaxed text-ink-soft">{verse.reading}</p>
      )}
      {showMeal && verse.meal && (
        <p className="mx-auto mt-2 max-w-prose text-center text-[15px] leading-relaxed text-muted">{verse.meal}</p>
      )}
      {keyWords.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {keyWords.map((w, i) => (
            <span key={i} className="inline-flex items-center gap-2 rounded-full border border-line bg-parchment py-1 pl-3 pr-1">
              <span className="text-xs">
                <span className="italic text-ink-soft">{w.reading}</span>
                <span className="text-muted"> · </span>
                <span className="font-semibold text-forest">{w.gloss}</span>
              </span>
              <span dir="rtl" lang="ar" className="rounded-full bg-surface px-2.5 font-arabic text-lg leading-8 text-ink">
                {w.text}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The paper the verses sit on, with thin rules between verses. */
export function VersePaper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-line bg-surface px-4 py-2 shadow-[0_1px_0_rgba(31,42,35,0.04),0_12px_32px_-22px_rgba(27,67,50,0.25)] sm:px-8 [&>*+*]:border-t [&>*+*]:border-line/60">
      {children}
    </div>
  );
}

export function PlayToggle({
  playing,
  onPlay,
  onStop,
  label,
}: {
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={playing ? onStop : onPlay}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-forest hover:bg-sand"
    >
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
      {playing ? "Durdur" : label}
    </button>
  );
}

export function ToolChip({ on, onClick, children }: { on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
        on ? "border-forest bg-mint text-forest" : "border-line bg-surface text-muted hover:text-forest"
      )}
    >
      {children}
    </button>
  );
}

export function MealToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <ToolChip on={on} onClick={onToggle}>
      {on ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      Meal
    </ToolChip>
  );
}

export function RevealAllToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <ToolChip on={on} onClick={onToggle}>
      {on ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      {on ? "Gizle" : "Hepsini aç"}
    </ToolChip>
  );
}

/** A centred row of small tools (listen, meal, reveal) above the verses. */
export function ToolRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>;
}

export function AudioBlockedNote({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="text-center text-xs font-semibold text-gold-ink">{AUDIO_BLOCKED_MESSAGE}</p>;
}

export function StepTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-[1.6rem] font-semibold leading-tight tracking-tight text-ink">{title}</h2>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm leading-snug text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Bottom action bar: always within thumb reach, above the safe area. HifzSession keeps
 * enough bottom padding so the last verse never hides behind it.
 */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 lg:pl-64">
      <div className="mx-auto max-w-2xl bg-gradient-to-t from-parchment from-60% to-transparent px-4 pt-8 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
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
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-forest px-6 py-4 text-base font-semibold text-parchment shadow-lg shadow-forest/25 transition hover:bg-forest-deep active:scale-[0.99] disabled:opacity-50"
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
    <div className="space-y-2">
      <p className="text-center text-xs font-semibold text-muted">Nasıl gitti?</p>
      <div className="grid grid-cols-3 gap-2">
        {RATINGS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onRate(r.id)}
            className={cn("flex flex-col items-center rounded-2xl border px-2 py-3 shadow-sm transition-colors", r.cls)}
          >
            <span className="text-sm font-semibold">{r.label}</span>
            <span className="text-[11px] opacity-80">{r.hint}</span>
          </button>
        ))}
      </div>
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
