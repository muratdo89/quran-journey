"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Pause, Play, Volume2, X } from "lucide-react";
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
  onWordTap,
  onWordClose,
  activeWord = null,
  onPlayVerse,
  versePlaying = false,
}: {
  verse: HifzVerse;
  /** Shows a small play button after the verse mark: listen to the whole verse with one tap. */
  onPlayVerse?: () => void;
  versePlaying?: boolean;
  /** Visible mode: custom word tap. Without it the block opens its own word sheet and plays the word. */
  onWordTap?: (wordIndex: number) => void;
  activeWord?: number | null;
  onWordClose?: () => void;
  hidden?: boolean;
  revealAll?: boolean;
  active?: boolean;
  showReading?: boolean;
  showMeal?: boolean;
}) {
  const [shown, setShown] = useState<Set<number>>(() => new Set());
  const [ownWord, setOwnWord] = useState<number | null>(null);
  const tapWord =
    onWordTap ??
    ((i: number) => {
      const w = verse.words[i];
      if (w?.audioUrl) playSharedClip(w.audioUrl);
      setOwnWord(i);
    });
  const highlighted = onWordTap ? activeWord : ownWord;
  const closeWord = onWordClose ?? (() => setOwnWord(null));

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
          : verse.words.map((w, i) => (
                <React.Fragment key={i}>
                  <button
                    type="button"
                    onClick={() => tapWord(i)}
                    className={cn(
                      "rounded-md px-0.5 transition-colors hover:bg-sand",
                      highlighted === i && "bg-gold-soft text-gold-deep"
                    )}
                  >
                    {w.text}
                  </button>{" "}
                </React.Fragment>
              ))}
        <AyahMark n={verse.verseNumber} />
        {onPlayVerse && verse.audioUrl && (
          <VersePlayButton n={verse.verseNumber} playing={versePlaying} onClick={onPlayVerse} />
        )}
      </p>
      {!hidden && highlighted != null && <WordCard verse={verse} index={highlighted} onClose={closeWord} />}
      {showReading && verse.reading && (
        <p className="mt-1 text-center text-[15px] italic leading-relaxed text-ink-soft">{verse.reading}</p>
      )}
      {showMeal && verse.meal && (
        <p className="mx-auto mt-2 max-w-prose text-center text-[15px] leading-relaxed text-muted">{verse.meal}</p>
      )}
    </div>
  );
}

/** Small, quiet round button that sits beside the verse mark and plays the whole verse. */
function VersePlayButton({ n, playing, onClick }: { n: number; playing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? "Durdur" : `${n}. ayeti dinle`}
      aria-pressed={playing}
      className={cn(
        "ml-0.5 inline-grid h-8 w-8 place-items-center rounded-full border align-middle transition-colors",
        playing
          ? "border-forest bg-forest text-parchment"
          : "border-gold-line/80 bg-surface text-gold-ink hover:border-forest hover:text-forest"
      )}
    >
      {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />}
    </button>
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

/* ---------- word sheet ---------- */

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="-mr-2 rounded-full p-2 text-muted hover:bg-sand">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Compact word info shown right under the ayah: word, okunuş, meaning, listen again, close. */
export function WordCard({ verse, index, onClose }: { verse: HifzVerse; index: number; onClose: () => void }) {
  const w = verse.words[index];
  if (!w) return null;
  return (
    <div className="mx-auto mt-1 flex max-w-md items-center gap-3 rounded-2xl border border-gold/30 bg-gold-soft/40 py-2 pl-2 pr-3">
      <button
        type="button"
        disabled={!w.audioUrl}
        onClick={() => w.audioUrl && playSharedClip(w.audioUrl)}
        aria-label="Kelimeyi tekrar dinle"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest text-parchment hover:bg-forest-deep disabled:opacity-40"
      >
        <Volume2 className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm italic text-ink-soft">{w.reading}</p>
        <p className="text-base font-semibold leading-snug text-forest">{w.gloss ?? "Anlam bulunamadı"}</p>
      </div>
      <span dir="rtl" lang="ar" className="shrink-0 font-arabic text-2xl leading-10 text-ink">
        {w.text}
      </span>
      <button type="button" onClick={onClose} aria-label="Kapat" className="-mr-1 shrink-0 rounded-full p-1.5 text-muted hover:bg-sand">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
