"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronLeft, Gauge } from "lucide-react";
import type { HifzPageData, HifzVerse } from "@/lib/hifz/page-data";
import { splitIntoChunks, splitIntoParts, type HifzRating, type NewLessonPlan } from "@/lib/hifz/plan";
import { cn } from "@/lib/utils";
import {
  AudioBlockedNote,
  HiddenVerse,
  MealToggle,
  PlayToggle,
  PrimaryButton,
  RatingButtons,
  RevealAllToggle,
  SurahTitle,
  VisibleVerse,
  useVersePlayer,
} from "./shared";

type Step = "anla" | "dinle" | "bakarak" | "bakmadan" | "bagla" | "sayfa";

const STEP_LABELS: Record<Exclude<Step, "sayfa">, string> = {
  anla: "Anla",
  dinle: "Dinle",
  bakarak: "Bakarak",
  bakmadan: "Bakmadan",
  bagla: "Bağla",
};

const READ_TIMES = 3;
const LISTEN_TIMES = 3;

/**
 * One new part of a page, chunk by chunk: understand → listen → read looking → read from memory
 * → connect with what came before. The last part of a page ends with the whole page from memory.
 */
export function NewLesson({
  lesson,
  data,
  onPartDone,
  onPageRated,
}: {
  lesson: NewLessonPlan;
  data: HifzPageData;
  onPartDone: () => void;
  onPageRated: (rating: HifzRating) => void;
}) {
  const lengths = useMemo(() => data.verses.map((v) => v.letters), [data]);
  const parts = useMemo(() => splitIntoParts(lengths, lesson.partCount), [lengths, lesson.partCount]);
  const partIdx = Math.min(lesson.partIndex, parts.length - 1);
  const isLastPart = partIdx >= parts.length - 1;
  const surahStarts = useMemo(
    () => new Set(data.verses.flatMap((v, i) => (v.startsSurah ? [i] : []))),
    [data]
  );
  const chunks = useMemo(
    () => splitIntoChunks(parts[partIdx] ?? [], lengths, surahStarts),
    [parts, partIdx, lengths, surahStarts]
  );

  const [chunkIdx, setChunkIdx] = useState(0);
  const [step, setStep] = useState<Step>("anla");
  const [count, setCount] = useState(0);
  const [slow, setSlow] = useState(false);
  const [revealAll, setRevealAll] = useState(false);
  const [showMeal, setShowMeal] = useState(false);
  const player = useVersePlayer();

  const chunk = chunks[chunkIdx] ?? [];
  const chunkVerses = chunk.map((i) => data.verses[i]!);
  const firstIdx = chunk[0] ?? 0;
  const lastIdx = chunk[chunk.length - 1] ?? 0;
  const connectVerses = data.verses.slice(0, lastIdx + 1);
  const steps: Exclude<Step, "sayfa">[] = firstIdx > 0 ? ["anla", "dinle", "bakarak", "bakmadan", "bagla"] : ["anla", "dinle", "bakarak", "bakmadan"];

  function goTo(next: Step) {
    player.stop();
    setCount(0);
    setRevealAll(false);
    setShowMeal(next === "bakmadan");
    setStep(next);
    // Started from the tap itself, so mobile browsers allow the audio.
    if (next === "dinle") void player.play(chunkVerses, LISTEN_TIMES, slow ? 0.75 : 1);
  }

  function advance() {
    if (step === "sayfa") return;
    const i = steps.indexOf(step);
    if (i < steps.length - 1) return goTo(steps[i + 1]!);
    // Chunk finished.
    if (chunkIdx < chunks.length - 1) {
      player.stop();
      setChunkIdx(chunkIdx + 1);
      setCount(0);
      setRevealAll(false);
      setShowMeal(false);
      setStep("anla");
      return;
    }
    if (isLastPart) return goTo("sayfa");
    player.stop();
    onPartDone();
  }

  function back() {
    const i = steps.indexOf(step as Exclude<Step, "sayfa">);
    if (step === "sayfa") return goTo(steps[steps.length - 1]!);
    if (i > 0) goTo(steps[i - 1]!);
  }

  function countRead() {
    const next = count + 1;
    if (next >= READ_TIMES) return advance();
    setCount(next);
    setRevealAll(false);
  }

  const verseRange =
    chunkVerses.length > 0
      ? `${chunkVerses[0]!.surahNameTr} ${chunkVerses[0]!.verseNumber}${chunkVerses.length > 1 ? `–${chunkVerses[chunkVerses.length - 1]!.verseNumber}` : ""}`
      : "";

  if (step === "sayfa") {
    return (
      <div className="space-y-4">
        <StepHeader title="Tüm sayfa, bakmadan" subtitle={`Sayfa ${data.page} bitti. Şimdi baştan sona bir kez ezberden oku.`} />
        <div className="flex justify-end gap-1">
          <MealToggle on={showMeal} onToggle={() => setShowMeal((m) => !m)} />
          <RevealAllToggle on={revealAll} onToggle={() => setRevealAll((r) => !r)} />
        </div>
        <div className="rounded-[28px] border border-line bg-surface p-3 sm:p-5">
          {data.verses.map((v) => (
            <React.Fragment key={`${v.key}-${revealAll}`}>
              <SurahTitle verse={v} />
              <HiddenVerse verse={v} revealAll={revealAll} showMeal={showMeal} />
            </React.Fragment>
          ))}
        </div>
        <p className="text-center text-sm font-semibold text-ink">Nasıl gitti?</p>
        <RatingButtons onRate={onPageRated} />
        <BackLink onClick={back} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Stepper steps={steps} current={step} chunkIdx={chunkIdx} chunkCount={chunks.length} />

      {step === "anla" && (
        <>
          <StepHeader title="Önce anla" subtitle={`${verseRange} · Ne dediğini bilerek ezberlemek daha kalıcıdır.`} />
          <div className="space-y-3">
            {chunkVerses.map((v) => (
              <MeaningCard key={v.key} verse={v} />
            ))}
          </div>
          <PrimaryButton onClick={advance}>Anladım, dinleyelim</PrimaryButton>
        </>
      )}

      {step === "dinle" && (
        <>
          <StepHeader
            title="Hocayı dinle"
            subtitle={player.playing ? `${player.round}. dinleyiş / ${LISTEN_TIMES}` : `Takip ederek ${LISTEN_TIMES} kez dinle.`}
          />
          <VerseList verses={chunkVerses} activeKey={player.activeKey} showReading />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <PlayToggle
              playing={player.playing}
              onPlay={() => void player.play(chunkVerses, LISTEN_TIMES, slow ? 0.75 : 1)}
              onStop={player.stop}
              label={`Dinle (${LISTEN_TIMES} kez)`}
            />
            <button
              type="button"
              onClick={() => setSlow((s) => !s)}
              aria-pressed={slow}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold",
                slow ? "border-forest bg-mint text-forest" : "border-line text-muted"
              )}
            >
              <Gauge className="h-3.5 w-3.5" />
              Yavaş
            </button>
          </div>
          <AudioBlockedNote show={player.blocked} />
          <PrimaryButton onClick={advance}>Dinledim</PrimaryButton>
        </>
      )}

      {step === "bakarak" && (
        <>
          <StepHeader title="Bakarak oku" subtitle="Sesli ve tane tane oku. Her okuyuşta düğmeye bas." />
          <VerseList verses={chunkVerses} activeKey={player.activeKey} showReading />
          <div className="flex justify-center">
            <PlayToggle playing={player.playing} onPlay={() => void player.play(chunkVerses, 1)} onStop={player.stop} label="Bir kez dinle" />
          </div>
          <AudioBlockedNote show={player.blocked} />
          <CountButton count={count} onClick={countRead} />
        </>
      )}

      {step === "bakmadan" && (
        <>
          <StepHeader title="Bakmadan oku" subtitle="Meal ipucu olarak duruyor. Takılırsan kelimeye dokun." />
          <div className="flex justify-end gap-1">
            <MealToggle on={showMeal} onToggle={() => setShowMeal((m) => !m)} />
            <RevealAllToggle on={revealAll} onToggle={() => setRevealAll((r) => !r)} />
          </div>
          <div className="rounded-[28px] border border-line bg-surface p-3 sm:p-5">
            {chunkVerses.map((v) => (
              <HiddenVerse key={`${v.key}-${count}-${revealAll}`} verse={v} revealAll={revealAll} showMeal={showMeal} />
            ))}
          </div>
          <CountButton count={count} onClick={countRead} />
        </>
      )}

      {step === "bagla" && (
        <>
          <StepHeader title="Bağla" subtitle="Sayfanın başından buraya kadar bakmadan oku." />
          <div className="flex justify-end gap-1">
            <MealToggle on={showMeal} onToggle={() => setShowMeal((m) => !m)} />
            <RevealAllToggle on={revealAll} onToggle={() => setRevealAll((r) => !r)} />
          </div>
          <div className="rounded-[28px] border border-line bg-surface p-3 sm:p-5">
            {connectVerses.map((v) => (
              <React.Fragment key={`${v.key}-${revealAll}`}>
                <SurahTitle verse={v} />
                <HiddenVerse verse={v} revealAll={revealAll} showMeal={showMeal} />
              </React.Fragment>
            ))}
          </div>
          <PrimaryButton onClick={advance}>
            <Check className="h-4 w-4" />
            Baştan okudum
          </PrimaryButton>
        </>
      )}

      {steps.indexOf(step) > 0 && <BackLink onClick={back} />}
    </div>
  );
}

function Stepper({
  steps,
  current,
  chunkIdx,
  chunkCount,
}: {
  steps: Exclude<Step, "sayfa">[];
  current: Step;
  chunkIdx: number;
  chunkCount: number;
}) {
  const ci = steps.indexOf(current as Exclude<Step, "sayfa">);
  return (
    <div className="space-y-2">
      {chunkCount > 1 && (
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-ink">
          Parça {chunkIdx + 1} / {chunkCount}
        </p>
      )}
      <ol className="flex items-center gap-1.5" aria-label="Adımlar">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-1.5 rounded-full", i <= ci ? "bg-forest" : "bg-track")} />
            <p className={cn("mt-1 text-center text-[11px] font-semibold", i === ci ? "text-forest" : "text-muted")}>
              {STEP_LABELS[s]}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

function VerseList({ verses, activeKey, showReading }: { verses: HifzVerse[]; activeKey: string | null; showReading?: boolean }) {
  return (
    <div className="rounded-[28px] border border-line bg-surface p-3 sm:p-5">
      {verses.map((v) => (
        <React.Fragment key={v.key}>
          <SurahTitle verse={v} />
          <VisibleVerse verse={v} active={activeKey === v.key} showReading={showReading} />
        </React.Fragment>
      ))}
    </div>
  );
}

function MeaningCard({ verse }: { verse: HifzVerse }) {
  const keyWords = verse.keyWords.map((i) => verse.words[i]!).filter(Boolean);
  return (
    <div className="rounded-[24px] border border-line bg-surface p-4">
      <SurahTitle verse={verse} />
      <p dir="rtl" lang="ar" className="font-arabic text-xl leading-[2.2] text-ink-soft">
        {verse.text}
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">
        <span className="mr-1 text-xs font-semibold text-gold-ink">{verse.verseNumber}.</span>
        {verse.meal}
      </p>
      {keyWords.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {keyWords.map((w, i) => (
            <div key={i} className="rounded-xl bg-parchment px-2 py-2 text-center">
              <p dir="rtl" lang="ar" className="font-arabic text-lg leading-snug text-ink">
                {w.text}
              </p>
              {w.reading && <p className="text-[11px] italic text-ink-soft">{w.reading}</p>}
              <p className="text-xs font-semibold text-forest">{w.gloss}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CountButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-2" aria-label={`${count} / ${READ_TIMES} okundu`}>
        {Array.from({ length: READ_TIMES }, (_, i) => (
          <span key={i} className={cn("h-2.5 w-2.5 rounded-full", i < count ? "bg-forest" : "bg-track")} />
        ))}
      </div>
      <PrimaryButton onClick={onClick}>
        <Check className="h-4 w-4" />
        Okudum ({count + 1}/{READ_TIMES})
      </PrimaryButton>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mx-auto flex items-center gap-1 text-xs font-semibold text-muted hover:text-forest">
      <ChevronLeft className="h-3.5 w-3.5" />
      Önceki adım
    </button>
  );
}
