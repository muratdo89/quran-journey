"use client";

import React, { useState } from "react";
import { ChevronDown, Ear, Mic, Pause, Play, SkipBack, SkipForward, Square, Volume2 } from "lucide-react";
import type { CanonicalWord } from "@/lib/content/types";
import {
  LISTEN_REPEAT_GROUP_SIZES,
  LISTEN_REPEAT_PAUSES,
  LISTEN_REPEAT_REPEATS,
  LISTEN_REPEAT_SPEEDS,
} from "@/lib/audio/listen-repeat";
import { cn } from "@/lib/utils";
import type { ListenRepeat } from "./useListenRepeat";

interface ListenRepeatPanelProps {
  listenRepeat: ListenRepeat;
  /** Where the drill starts: the word the learner selected on the page. */
  startWord: CanonicalWord | null;
  startVerseKey: string;
  showTransliteration: boolean;
  onStart: () => void;
}

/** Settings and live view for the listen-and-repeat drill (desktop sidebar card). */
export function ListenRepeatPanel({
  listenRepeat,
  startWord,
  startVerseKey,
  showTransliteration,
  onStart,
}: ListenRepeatPanelProps) {
  const { settings, updateSettings, isActive, error } = listenRepeat;
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div
      id="dinle-tekrar-et"
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 scroll-mt-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Dinle ve Tekrar Et</h2>
          <p className="text-xs text-muted">
            Hoca kelimeyi yavaşça okur, sonra susar; sıra sende. Okuduğunu takip ederek tekrar et.
          </p>
        </div>
        <Ear className="h-4 w-4 shrink-0 text-forest" />
      </div>

      {isActive ? (
        <ListenRepeatNowPlaying listenRepeat={listenRepeat} showTransliteration={showTransliteration} />
      ) : (
        <>
          <div className="rounded-xl border border-[#ece4cf] bg-parchment px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div className="text-xs text-ink-soft">
              <span className="block text-[11px] text-muted">Başlangıç</span>
              <span className="font-semibold">
                {startWord ? `${startVerseKey} · ${startWord.position}. kelime` : startVerseKey}
              </span>
              <span className="block text-[11px] text-muted">
                Değiştirmek için sayfada bir kelimeye dokun.
              </span>
            </div>
            {startWord && (
              <span lang="ar" dir="rtl" translate="no" className="font-arabic text-3xl text-ink">
                {startWord.textUthmani}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-parchment px-3.5 py-2 text-left text-xs text-ink-soft hover:bg-sand"
          >
            <span className="min-w-0 truncate">
              <span className="font-semibold text-ink">Ayarlar: </span>
              {settings.speed === 1 ? "Normal hız" : `${settings.speed}×`} ·{" "}
              {LISTEN_REPEAT_PAUSES.find((p) => p.id === settings.pause)?.labelTr} ·{" "}
              {settings.repeatCount}× ·{" "}
              {settings.groupSize === 1 ? "tek kelime" : `${settings.groupSize} kelime`} ·{" "}
              {settings.scope === "verse" ? "bu ayet" : "sayfa sonuna kadar"}
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", showSettings && "rotate-180")} />
          </button>

          {showSettings && (
          <div className="space-y-3 text-xs">
            <OptionRow label="Hız">
              {LISTEN_REPEAT_SPEEDS.map((speed) => (
                <Chip
                  key={speed}
                  active={settings.speed === speed}
                  onClick={() => updateSettings({ speed })}
                >
                  {speed === 1 ? "Normal" : `${speed}×`}
                </Chip>
              ))}
            </OptionRow>
            <OptionRow label="Senin süren">
              {LISTEN_REPEAT_PAUSES.map((p) => (
                <Chip
                  key={p.id}
                  active={settings.pause === p.id}
                  onClick={() => updateSettings({ pause: p.id })}
                >
                  {p.labelTr}
                </Chip>
              ))}
            </OptionRow>
            <OptionRow label="Tekrar">
              {LISTEN_REPEAT_REPEATS.map((n) => (
                <Chip
                  key={n}
                  active={settings.repeatCount === n}
                  onClick={() => updateSettings({ repeatCount: n })}
                >
                  {n}×
                </Chip>
              ))}
            </OptionRow>
            <OptionRow label="Parça">
              {LISTEN_REPEAT_GROUP_SIZES.map((n) => (
                <Chip
                  key={n}
                  active={settings.groupSize === n}
                  onClick={() => updateSettings({ groupSize: n })}
                >
                  {n === 1 ? "Tek kelime" : `${n} kelime`}
                </Chip>
              ))}
            </OptionRow>
            <OptionRow label="Kapsam">
              <Chip
                active={settings.scope === "verse"}
                onClick={() => updateSettings({ scope: "verse" })}
              >
                Bu ayet
              </Chip>
              <Chip
                active={settings.scope === "page"}
                onClick={() => updateSettings({ scope: "page" })}
              >
                Sayfa sonuna kadar
              </Chip>
            </OptionRow>
            <label className="flex items-center gap-2 text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                checked={settings.playFullVerse}
                onChange={(e) => updateSettings({ playFullVerse: e.target.checked })}
                className="h-4 w-4 accent-forest"
              />
              <span>Ayet bitince tamamını seçili kâriden bir kez dinle</span>
            </label>
          </div>
          )}

          <button
            type="button"
            onClick={onStart}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest-deep"
          >
            <Play className="h-4 w-4" />
            <span>Başlat</span>
          </button>

          {showSettings && (
            <p className="text-[11px] leading-relaxed text-muted">
              Kelime sesleri Quran.com&apos;un kelime kelime kaydından gelir; gerçek insan sesidir,
              yapay ses kullanılmaz. Kelime kaydı seçili kâriden bağımsızdır.
            </p>
          )}
        </>
      )}

      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          {error}
        </div>
      )}
    </div>
  );
}

/** Current word, whose turn it is, countdown and transport controls. Shared by the card and the mobile bar. */
export function ListenRepeatNowPlaying({
  listenRepeat,
  showTransliteration,
  compact = false,
}: {
  listenRepeat: ListenRepeat;
  showTransliteration: boolean;
  compact?: boolean;
}) {
  const { phase, currentStep, pauseMs, stepIndex } = listenRepeat;
  if (!currentStep) return null;

  const isPaused = phase === "paused";
  const wordsStep = currentStep.kind === "words" ? currentStep : null;
  const arabic = wordsStep
    ? wordsStep.words.map((w) => w.textUthmani).join(" ")
    : `Ayet ${currentStep.verseKey}`;
  const meaning = wordsStep
    ? wordsStep.words
        .map((w) => w.translationTr)
        .filter(Boolean)
        .join(" · ")
    : "";
  const transliteration = wordsStep
    ? wordsStep.words
        .map((w) => w.transliteration)
        .filter(Boolean)
        .join(" ")
    : "";

  const phaseLabel =
    phase === "listen"
      ? "Dinle"
      : phase === "repeat"
        ? "Şimdi sen oku"
        : phase === "verse"
          ? "Ayetin tamamı"
          : "Duraklatıldı";

  return (
    <div className={cn("space-y-3", compact && "space-y-2")} aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold",
            phase === "repeat"
              ? "bg-gold text-white"
              : isPaused
                ? "bg-sand text-muted"
                : "bg-forest text-white"
          )}
        >
          {phase === "repeat" ? (
            <Mic className="h-3.5 w-3.5" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
          {phaseLabel}
        </span>
        <span className="text-muted">
          {wordsStep
            ? `${currentStep.verseKey} · ${wordsStep.groupNumber}/${wordsStep.groupTotal}` +
              (wordsStep.repeatTotal > 1
                ? ` · tekrar ${wordsStep.repeatIndex}/${wordsStep.repeatTotal}`
                : "")
            : currentStep.verseKey}
        </span>
      </div>

      <div className={cn("text-center", compact ? "py-0" : "py-1")}>
        <p
          lang="ar"
          dir="rtl"
          translate="no"
          className={cn(
            "font-arabic text-ink",
            compact ? "text-3xl leading-[1.5]" : "text-5xl leading-[1.6]"
          )}
        >
          {arabic}
        </p>
        {meaning && <p className="mt-0.5 text-sm font-semibold text-forest">{meaning}</p>}
        {showTransliteration && transliteration && (
          <p className="mt-1 text-xs font-mono text-muted">{transliteration}</p>
        )}
      </div>

      <div className="h-1.5 rounded-full bg-sand overflow-hidden">
        {phase === "repeat" && (
          <div
            key={stepIndex}
            className="qj-turn-fill h-full w-full bg-gold"
            style={{ animationDuration: `${pauseMs}ms` }}
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <IconButton label="Önceki" onClick={listenRepeat.previous}>
          <SkipBack className="h-4 w-4" />
        </IconButton>
        <button
          type="button"
          onClick={isPaused ? listenRepeat.resume : listenRepeat.pause}
          className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-deep"
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          <span>{isPaused ? "Devam" : "Duraklat"}</span>
        </button>
        <IconButton label="Sonraki" onClick={listenRepeat.next}>
          <SkipForward className="h-4 w-4" />
        </IconButton>
        <IconButton label="Bitir" onClick={listenRepeat.stop}>
          <Square className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

/** Mobile: the sidebar sits below the page, so keep the drill controls docked above the bottom nav. */
export function ListenRepeatFloatingBar({
  listenRepeat,
  showTransliteration,
}: {
  listenRepeat: ListenRepeat;
  showTransliteration: boolean;
}) {
  if (!listenRepeat.isActive) return null;
  return (
    <div className="lg:hidden fixed inset-x-3 bottom-20 z-30 rounded-2xl border border-line bg-surface/95 backdrop-blur p-3 shadow-lg">
      <ListenRepeatNowPlaying
        listenRepeat={listenRepeat}
        showTransliteration={showTransliteration}
        compact
      />
    </div>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-24 shrink-0 font-medium text-ink-soft">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 font-medium transition-colors",
        active
          ? "border-forest bg-forest text-white"
          : "border-line bg-parchment text-ink hover:bg-sand"
      )}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-xl border border-line bg-parchment p-2.5 text-forest hover:bg-sand"
    >
      {children}
    </button>
  );
}
