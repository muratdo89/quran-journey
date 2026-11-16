"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronLeft, Gauge } from "lucide-react";
import type { HifzPageData, HifzVerse } from "@/lib/hifz/page-data";
import { splitIntoChunks, splitIntoParts, type HifzRating, type NewLessonPlan } from "@/lib/hifz/plan";
import { cn } from "@/lib/utils";
import {
  ActionBar,
  AudioBlockedNote,
  MealToggle,
  PlayToggle,
  PrimaryButton,
  RatingButtons,
  RevealAllToggle,
  StepTitle,
  SurahBanner,
  ToolChip,
  ToolRow,
  VerseBlock,
  VersePaper,
  useVersePlayer,
} from "./shared";

type Step = "anla" | "dinle" | "bakarak" | "bakmadan" | "bagla" | "sayfa";
type ChunkStep = Exclude<Step, "sayfa">;

const STEP_LABELS: Record<ChunkStep, string> = {
  anla: "Anla",
  dinle: "Dinle",
  bakarak: "Bakarak",
  bakmadan: "Bakmadan",
  bagla: "Bağla",
};

const READ_TIMES = 3;
const LISTEN_TIMES = 3;

function scrollTop() {
  window.scrollTo({ top: 0 });
}

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
  const steps: ChunkStep[] = firstIdx > 0 ? ["anla", "dinle", "bakarak", "bakmadan", "bagla"] : ["anla", "dinle", "bakarak", "bakmadan"];

  function goTo(next: Step) {
    player.stop();
    setCount(0);
    setRevealAll(false);
    setShowMeal(next === "bakmadan");
    setStep(next);
    scrollTop();
    // Started from the tap itself, so mobile browsers allow the audio.
    if (next === "dinle") void player.play(chunkVerses, LISTEN_TIMES, slow ? 0.75 : 1);
  }

  function advance() {
    if (step === "sayfa") return;
    const i = steps.indexOf(step);
    if (i < steps.length - 1) return goTo(steps[i + 1]!);
    if (chunkIdx < chunks.length - 1) {
      player.stop();
      setChunkIdx(chunkIdx + 1);
      setCount(0);
      setRevealAll(false);
      setShowMeal(false);
      setStep("anla");
      scrollTop();
      return;
    }
    if (isLastPart) return goTo("sayfa");
    player.stop();
    onPartDone();
  }

  function back() {
    if (step === "sayfa") return goTo(steps[steps.length - 1]!);
    const i = steps.indexOf(step);
    if (i > 0) goTo(steps[i - 1]!);
  }

  function countRead() {
    const next = count + 1;
    if (next >= READ_TIMES) return advance();
    setCount(next);
    setRevealAll(false);
  }

  const canGoBack = step === "sayfa" || steps.indexOf(step) > 0;

  if (step === "sayfa") {
    return (
      <div className="space-y-5">
        <StepTitle title="Tüm sayfa, bakmadan" hint={`Sayfa ${data.page} bitti. Baştan sona bir kez ezberden oku.`} />
        <ToolRow>
          <MealToggle on={showMeal} onToggle={() => setShowMeal((m) => !m)} />
          <RevealAllToggle on={revealAll} onToggle={() => setRevealAll((r) => !r)} />
        </ToolRow>
        <VersePaper>
          {data.verses.map((v) => (
            <div key={`${v.key}-${revealAll}`}>
              <SurahBanner verse={v} />
              <VerseBlock verse={v} hidden revealAll={revealAll} showMeal={showMeal} />
            </div>
          ))}
        </VersePaper>
        <BackLink onClick={back} />
        <ActionBar>
          <RatingButtons onRate={onPageRated} />
        </ActionBar>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Stepper steps={steps} current={step} chunkIdx={chunkIdx} chunkCount={chunks.length} />

      {step === "anla" && (
        <>
          <StepTitle title="Önce anla" hint="Mealini oku. Bilmediğin kelimeye dokun: anlamı, okunuşu ve sesi gelir." />
          <ChunkPaper verses={chunkVerses} showMeal />
          <ActionBar>
            <PrimaryButton onClick={advance}>Anladım, dinleyelim</PrimaryButton>
          </ActionBar>
        </>
      )}

      {step === "dinle" && (
        <>
          <StepTitle
            title="Hocayı dinle"
            hint={player.playing ? `${player.round}. dinleyiş / ${LISTEN_TIMES}` : `Takip ederek ${LISTEN_TIMES} kez dinle.`}
          />
          <ToolRow>
            <PlayToggle
              playing={player.playing}
              onPlay={() => void player.play(chunkVerses, LISTEN_TIMES, slow ? 0.75 : 1)}
              onStop={player.stop}
              label={`Dinle · ${LISTEN_TIMES} kez`}
            />
            <ToolChip on={slow} onClick={() => setSlow((s) => !s)}>
              <Gauge className="h-3.5 w-3.5" />
              Yavaş
            </ToolChip>
          </ToolRow>
          <AudioBlockedNote show={player.blocked} />
          <ChunkPaper verses={chunkVerses} activeKey={player.activeKey} showReading />
          <ActionBar>
            <PrimaryButton onClick={advance}>Dinledim</PrimaryButton>
          </ActionBar>
        </>
      )}

      {step === "bakarak" && (
        <>
          <StepTitle title="Bakarak oku" hint="Sesli ve tane tane oku. Her okuyuşta düğmeye bas." />
          <ToolRow>
            <PlayToggle playing={player.playing} onPlay={() => void player.play(chunkVerses, 1)} onStop={player.stop} label="Bir kez dinle" />
          </ToolRow>
          <AudioBlockedNote show={player.blocked} />
          <ChunkPaper verses={chunkVerses} activeKey={player.activeKey} showReading />
          <ActionBar>
            <CountButton count={count} onClick={countRead} />
          </ActionBar>
        </>
      )}

      {step === "bakmadan" && (
        <>
          <StepTitle title="Bakmadan oku" hint="Meal ipucu olarak duruyor. Takılırsan kelimeye dokun." />
          <ToolRow>
            <MealToggle on={showMeal} onToggle={() => setShowMeal((m) => !m)} />
            <RevealAllToggle on={revealAll} onToggle={() => setRevealAll((r) => !r)} />
          </ToolRow>
          <VersePaper>
            {chunkVerses.map((v) => (
              <div key={`${v.key}-${count}-${revealAll}`}>
                <SurahBanner verse={v} />
                <VerseBlock verse={v} hidden revealAll={revealAll} showMeal={showMeal} />
              </div>
            ))}
          </VersePaper>
          <ActionBar>
            <CountButton count={count} onClick={countRead} />
          </ActionBar>
        </>
      )}

      {step === "bagla" && (
        <>
          <StepTitle title="Bağla" hint="Sayfanın başından buraya kadar bakmadan oku." />
          <ToolRow>
            <MealToggle on={showMeal} onToggle={() => setShowMeal((m) => !m)} />
            <RevealAllToggle on={revealAll} onToggle={() => setRevealAll((r) => !r)} />
          </ToolRow>
          <VersePaper>
            {connectVerses.map((v) => (
              <div key={`${v.key}-${revealAll}`}>
                <SurahBanner verse={v} />
                <VerseBlock verse={v} hidden revealAll={revealAll} showMeal={showMeal} />
              </div>
            ))}
          </VersePaper>
          <ActionBar>
            <PrimaryButton onClick={advance}>
              <Check className="h-4 w-4" />
              Baştan okudum
            </PrimaryButton>
          </ActionBar>
        </>
      )}

      {canGoBack && <BackLink onClick={back} />}
    </div>
  );
}

function ChunkPaper({
  verses,
  activeKey = null,
  showReading,
  showMeal,
}: {
  verses: HifzVerse[];
  activeKey?: string | null;
  showReading?: boolean;
  showMeal?: boolean;
}) {
  return (
    <VersePaper>
      {verses.map((v) => (
        <div key={v.key}>
          <SurahBanner verse={v} />
          <VerseBlock verse={v} active={activeKey === v.key} showReading={showReading} showMeal={showMeal} />
        </div>
      ))}
    </VersePaper>
  );
}

function Stepper({
  steps,
  current,
  chunkIdx,
  chunkCount,
}: {
  steps: ChunkStep[];
  current: Step;
  chunkIdx: number;
  chunkCount: number;
}) {
  const ci = steps.indexOf(current as ChunkStep);
  return (
    <div>
      <ol className="flex items-start gap-1.5" aria-label="Adımlar">
        {steps.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === ci ? "step" : undefined}>
            <div className={cn("h-1 rounded-full transition-colors", i <= ci ? "bg-forest" : "bg-track")} />
            <p className={cn("mt-1.5 text-center text-[11px] font-semibold", i === ci ? "text-forest" : "text-muted/80")}>
              {STEP_LABELS[s]}
            </p>
          </li>
        ))}
      </ol>
      {chunkCount > 1 && (
        <p className="mt-1 text-center text-[11px] font-medium text-muted">
          Parça {chunkIdx + 1} / {chunkCount}
        </p>
      )}
    </div>
  );
}

function CountButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div className="space-y-2.5">
      <div className="flex justify-center gap-2" aria-label={`${count} / ${READ_TIMES} okundu`}>
        {Array.from({ length: READ_TIMES }, (_, i) => (
          <span key={i} className={cn("h-2 w-8 rounded-full transition-colors", i < count ? "bg-forest" : "bg-track")} />
        ))}
      </div>
      <PrimaryButton onClick={onClick}>
        <Check className="h-4 w-4" />
        Okudum · {count + 1}/{READ_TIMES}
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
