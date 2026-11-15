"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Play, RotateCcw, Volume2, X } from "lucide-react";
import type { Warmup, WarmupRound, WarmupWord } from "@/lib/content/warmup";
import { advanceSession, useActiveSession } from "@/lib/study-session";
import { cn } from "@/lib/utils";

/* ---------- small audio helpers ---------- */

/** Soft UI feedback tones (not speech): a rising two-note chime or one low note. */
function playTone(kind: "correct" | "wrong") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = kind === "correct" ? [659.25, 880] : [220];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(kind === "correct" ? 0.12 : 0.08, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* no audio context: silent feedback is fine */
  }
}

function useRecitation() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const play = useCallback((url: string | null | undefined) => {
    if (!url) return;
    audioRef.current?.pause();
    const a = new Audio(url);
    audioRef.current = a;
    a.onended = () => setPlayingUrl(null);
    a.onerror = () => setPlayingUrl(null);
    setPlayingUrl(url);
    a.play().catch(() => setPlayingUrl(null));
  }, []);

  useEffect(() => () => audioRef.current?.pause(), []);
  return { play, playingUrl };
}

/* ---------- presentational pieces ---------- */

function PlayButton({
  playing,
  onClick,
  label,
  size = "lg",
}: {
  playing: boolean;
  onClick: () => void;
  label: string;
  size?: "lg" | "md";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full bg-forest text-parchment shadow-lg shadow-forest/25 transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest",
        size === "lg" ? "h-20 w-20" : "h-14 w-14"
      )}
    >
      {playing && (
        <>
          <span aria-hidden className="qj-ripple absolute inset-0 rounded-full border-2 border-forest" />
          <span aria-hidden className="qj-ripple qj-ripple-delay absolute inset-0 rounded-full border-2 border-forest" />
        </>
      )}
      {playing ? (
        <span aria-hidden className="flex h-7 items-end gap-[3px]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="qj-bar w-[4px] rounded-full bg-parchment" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </span>
      ) : (
        <Play className={cn("fill-current translate-x-0.5", size === "lg" ? "h-8 w-8" : "h-6 w-6")} />
      )}
    </button>
  );
}

function WordMedallion({ text, hidden = false }: { text: string; hidden?: boolean }) {
  return (
    <div className="relative mx-auto flex min-h-[9.5rem] w-full max-w-xs items-center justify-center rounded-[2rem] border border-line bg-parchment px-6">
      <span aria-hidden className="absolute inset-2 rounded-[1.6rem] border border-dashed border-gold-line" />
      {hidden ? (
        <Volume2 className="h-12 w-12 text-gold" aria-label="Gizli kelime" />
      ) : (
        <p lang="ar" dir="rtl" translate="no" className="font-arabic text-[3.5rem] sm:text-[4rem] leading-[1.7] text-forest">
          {text}
        </p>
      )}
    </div>
  );
}

/* ---------- main ---------- */

const PROMPTS: Record<WarmupRound["kind"], string> = {
  listen: "Dinle, sonra sesli tekrar et",
  which_heard: "Hangisini duydun?",
  meaning: "Bu kelimenin anlamı ne?",
};

export function WarmupClient({ warmup }: { warmup: Warmup | null }) {
  const router = useRouter();
  const session = useActiveSession();
  const { play, playingUrl } = useRecitation();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const rounds = warmup?.rounds ?? [];
  const done = index >= rounds.length;
  const round = rounds[index];

  // Each round opens with the hoca's voice. Browsers allow it because the user just tapped "Başlat".
  useEffect(() => {
    if (round && round.kind !== "meaning") play(round.word.audioUrl);
  }, [round, play]);

  useEffect(() => {
    if (done && warmup?.verseAudioUrl) {
      const t = setTimeout(() => play(warmup.verseAudioUrl), 500);
      return () => clearTimeout(t);
    }
  }, [done, warmup, play]);

  if (!warmup) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-line bg-surface p-8 text-center space-y-4">
        <p className="text-sm text-muted">Bu sayfa için ısınma hazırlanamadı.</p>
        <Link href="/" className="inline-flex rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-parchment">
          Panele dön
        </Link>
      </div>
    );
  }

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  function choose(value: string, correctValue: string) {
    if (picked) return;
    setPicked(value);
    const ok = value === correctValue;
    playTone(ok ? "correct" : "wrong");
    if (ok) {
      setScore((s) => s + 1);
      setTimeout(next, 1100);
    }
  }

  function finish() {
    const sessionOnWarmup = session && session.steps[session.index]?.id === "step-warmup";
    const href = sessionOnWarmup ? advanceSession() : null;
    router.push(href ?? "/");
  }

  const isPlaying = (w: WarmupWord) => playingUrl === w.audioUrl;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* top bar */}
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Isınmayı kapat" className="rounded-full p-1.5 text-muted hover:bg-sand hover:text-ink">
          <X className="h-5 w-5" />
        </Link>
        <div className="flex flex-1 gap-1.5" aria-label={`Tur ${Math.min(index + 1, rounds.length)} / ${rounds.length}`}>
          {rounds.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 flex-1 rounded-full transition-colors duration-300",
                i < index ? "bg-emerald" : i === index ? "bg-gold" : "bg-track"
              )}
            />
          ))}
        </div>
        <span className="text-xs font-semibold text-muted">1 dk</span>
      </div>

      <section className="rounded-[28px] border border-line bg-surface px-5 py-7 sm:px-8 sm:py-9 shadow-[0_12px_32px_-18px_rgba(27,67,50,0.25)]">
        {!done && round ? (
          <div key={index} className="qj-rise space-y-6 text-center">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-ink">
                Isınma · {index + 1}/{rounds.length}
              </p>
              <h1 className="font-display text-2xl sm:text-[1.75rem] font-semibold text-ink">{PROMPTS[round.kind]}</h1>
            </div>

            {round.kind === "listen" && (
              <>
                <WordMedallion text={round.word.textUthmani} />
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-ink">{round.word.translationTr}</p>
                  {round.word.transliteration && (
                    <p className="text-sm italic text-muted">{round.word.transliteration}</p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-4">
                  <PlayButton
                    playing={isPlaying(round.word)}
                    onClick={() => play(round.word.audioUrl)}
                    label="Hocadan dinle"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScore((s) => s + 1);
                      playTone("correct");
                      next();
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-forest px-6 py-3.5 text-sm font-semibold text-parchment transition-colors hover:bg-forest-deep"
                  >
                    Tekrar ettim
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {round.kind === "which_heard" && (
              <>
                <div className="flex flex-col items-center gap-3">
                  <PlayButton playing={isPlaying(round.word)} onClick={() => play(round.word.audioUrl)} label="Tekrar dinle" />
                  <p className="text-xs text-muted">Tekrar dinlemek için dokun</p>
                </div>
                <div className="grid gap-2.5">
                  {round.options.map((o) => {
                    const correct = o.textUthmani === round.word.textUthmani;
                    const chosen = picked === o.textUthmani;
                    return (
                      <button
                        key={o.location}
                        type="button"
                        disabled={!!picked}
                        onClick={() => choose(o.textUthmani, round.word.textUthmani)}
                        className={cn(
                          "relative flex min-h-16 items-center justify-center rounded-2xl border-2 px-4 transition-colors",
                          !picked && "border-line bg-parchment hover:border-gold-line hover:bg-gold-soft",
                          picked && correct && "border-emerald bg-mint",
                          picked && chosen && !correct && "qj-shake border-red-300 bg-red-50",
                          picked && !chosen && !correct && "border-line bg-parchment opacity-50"
                        )}
                      >
                        <span lang="ar" dir="rtl" translate="no" className="font-arabic text-3xl leading-[1.8] text-ink">
                          {o.textUthmani}
                        </span>
                        {picked && correct && <Check className="absolute right-4 h-5 w-5 text-emerald" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {round.kind === "meaning" && (
              <>
                <WordMedallion text={round.word.textUthmani} />
                <div className="flex justify-center">
                  <PlayButton size="md" playing={isPlaying(round.word)} onClick={() => play(round.word.audioUrl)} label="Kelimeyi dinle" />
                </div>
                <div className="grid gap-2.5">
                  {round.options.map((o) => {
                    const correct = o === round.word.translationTr;
                    const chosen = picked === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        disabled={!!picked}
                        onClick={() => {
                          choose(o, round.word.translationTr);
                          play(round.word.audioUrl);
                        }}
                        className={cn(
                          "relative flex min-h-14 items-center justify-center rounded-2xl border-2 px-4 text-base font-semibold text-ink transition-colors",
                          !picked && "border-line bg-parchment hover:border-gold-line hover:bg-gold-soft",
                          picked && correct && "border-emerald bg-mint",
                          picked && chosen && !correct && "qj-shake border-red-300 bg-red-50",
                          picked && !chosen && !correct && "border-line bg-parchment opacity-50"
                        )}
                      >
                        {o}
                        {picked && correct && <Check className="absolute right-4 h-5 w-5 text-emerald" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {picked && round.kind !== "listen" && (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-2 rounded-2xl bg-forest px-6 py-3 text-sm font-semibold text-parchment hover:bg-forest-deep"
              >
                Devam
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="qj-rise space-y-6 text-center">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-ink">
                {score}/{rounds.length} doğru
              </p>
              <h1 className="font-display text-[1.9rem] font-semibold text-ink">Maşallah, ısındın.</h1>
              <p className="text-sm text-muted">Az önce çalıştığın kelimeler bu ayette geçiyor.</p>
            </div>

            <button
              type="button"
              onClick={() => play(warmup.verseAudioUrl)}
              className="group block w-full rounded-3xl border border-line bg-parchment px-5 py-5 text-center hover:border-gold-line"
            >
              <p lang="ar" dir="rtl" translate="no" className="font-arabic text-[1.9rem] leading-[2.1] text-ink">
                {warmup.verseWords.map((w, i) => (
                  <React.Fragment key={w.location}>
                    {i > 0 && " "}
                    <span
                      className={cn(
                        warmup.practisedLocations.includes(w.location) && "rounded-lg bg-gold-soft px-1 text-forest"
                      )}
                    >
                      {w.textUthmani}
                    </span>
                  </React.Fragment>
                ))}
              </p>
              <p className="mt-2 text-sm text-muted leading-relaxed">{warmup.verseTranslationTr}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-forest">
                <Volume2 className="h-3.5 w-3.5" />
                {warmup.surahNameTr} {warmup.verseKey.split(":")[1]} · {playingUrl === warmup.verseAudioUrl ? "dinleniyor" : "ayeti dinle"}
              </p>
            </button>

            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={finish}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-forest px-6 py-4 text-base font-semibold text-parchment shadow-sm shadow-forest/20 hover:bg-forest-deep sm:w-auto sm:min-w-72"
              >
                {session && session.steps[session.index]?.id === "step-warmup" ? "Sıradaki adım" : "Panele dön"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIndex(0);
                  setScore(0);
                  setPicked(null);
                              }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-forest"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Bir daha
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
