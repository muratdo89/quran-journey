"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, Flame, HeartHandshake, History, Play, Timer } from "lucide-react";
import type { DailyLearningPlan, SessionMode } from "@/lib/learning-engine";
import {
  isSessionFinished,
  isStepDone,
  startSession,
  useActiveSession,
  useLastStudy,
  type SessionStep,
} from "@/lib/study-session";
import { cn } from "@/lib/utils";
import type { DailyVerse, JuzProgress } from "@/lib/content/daily-focus";

interface TodayFocusCardProps {
  dailyVerse: DailyVerse | null;
  juzProgress: JuzProgress;
  displayName: string;
  plan: DailyLearningPlan;
  streakDays: number;
  activePage: number;
  mode: SessionMode;
  updatingMode: boolean;
  onModeChange: (mode: SessionMode) => void;
}

export function toSessionSteps(plan: DailyLearningPlan): SessionStep[] {
  return plan.steps.map((s) => ({
    id: s.id,
    titleTr: s.titleTr,
    href: s.href,
    estimatedMinutes: s.estimatedMinutes,
  }));
}

const MODES: { id: SessionMode; label: string }[] = [
  { id: "recovery", label: "Kısa" },
  { id: "normal", label: "Normal" },
  { id: "intensive", label: "Yoğun" },
];

/**
 * The whole dashboard: one sentence, one button, today's short checklist.
 * Everything else (continue, 2-minute fallback, session length) is a quiet text link.
 */
export function TodayFocusCard({
  dailyVerse,
  displayName,
  plan,
  streakDays,
  activePage,
  mode,
  updatingMode,
  onModeChange,
}: TodayFocusCardProps) {
  const router = useRouter();
  const session = useActiveSession();
  const lastStudy = useLastStudy();

  const steps = toSessionSteps(plan);
  const finished = isSessionFinished(session);
  const inProgress = !!session && !finished;
  const currentIndex = inProgress ? session.index : finished ? steps.length : -1;
  // Always show today's current plan; done marks are matched by step id.
  const shownSteps = session && session.steps.length !== steps.length ? session.steps : steps;

  const remainingMinutes = inProgress
    ? session.steps.slice(session.index).reduce((sum, s) => sum + s.estimatedMinutes, 0)
    : plan.totalEstimatedMinutes;

  function handlePrimary() {
    if (inProgress) {
      router.push(session.steps[session.index].href);
      return;
    }
    if (steps.length === 0) {
      router.push(`/mushaf?page=${activePage}`);
      return;
    }
    router.push(startSession(steps));
  }

  function openStep(i: number) {
    router.push(startSession(shownSteps, i));
  }

  function handleMini() {
    const mini: SessionStep =
      plan.dueCardsCount > 0
        ? { id: "mini-review", titleTr: "2 dakikalık mini tekrar", href: "/review?mode=recovery", estimatedMinutes: 2 }
        : { id: "mini-listen", titleTr: `Sayfa ${activePage}'i dinle ve takip et`, href: `/mushaf?page=${activePage}`, estimatedMinutes: 2 };
    router.push(startSession([mini]));
  }

  const continueHref = lastStudy?.href ?? `/mushaf?page=${activePage}`;
  const continueLabel = lastStudy?.labelTr ?? `Mushaf · Sayfa ${activePage}`;

  const title = finished
    ? "Bugünkü çalışma tamam."
    : inProgress
      ? `Devam edelim, ~${remainingMinutes} dk kaldı.`
      : `Bugün ~${plan.totalEstimatedMinutes} dakika.`;

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-line bg-surface p-5 sm:p-8 shadow-[0_1px_0_rgba(31,42,35,0.04),0_12px_32px_-18px_rgba(27,67,50,0.18)]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
          <span>Selam, {displayName}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-gold-ink">
            <Flame className="h-3.5 w-3.5" />
            {streakDays} gün
          </span>
        </div>

        <h1 className="mt-3 font-display text-[1.75rem] sm:text-[2.25rem] font-semibold leading-[1.15] tracking-tight text-ink text-balance">
          {title}
        </h1>

        <button
          type="button"
          onClick={finished ? handleMini : handlePrimary}
          className="group mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-forest px-6 py-4 text-base font-semibold text-parchment shadow-sm shadow-forest/20 transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>{finished ? "Bir tur daha (2 dk)" : inProgress ? "Devam et" : "Başla"}</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        {shownSteps.length > 0 && (
          <ol className="mt-5 divide-y divide-line" aria-label="Bugünkü adımlar">
            {shownSteps.map((s, i) => {
              const done = isStepDone(session, s.id) || (finished && !session?.done);
              const current = !done && i === currentIndex;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => openStep(i)}
                    className="group flex w-full items-center gap-3 py-3 text-left"
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald" />
                    ) : (
                      <Circle className={cn("h-5 w-5 shrink-0", current ? "text-forest" : "text-line")} />
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        done ? "text-muted line-through decoration-line" : current ? "font-semibold text-ink" : "text-ink-soft"
                      )}
                    >
                      {s.titleTr}
                    </span>
                    <span className="shrink-0 text-xs text-muted group-hover:text-forest">
                      {done ? "" : `${s.estimatedMinutes} dk`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-4 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold">
            <Link href={continueHref} className="inline-flex items-center gap-1.5 text-forest hover:underline">
              <History className="h-3.5 w-3.5" />
              {continueLabel}
            </Link>
            {!finished && (
              <button type="button" onClick={handleMini} className="inline-flex items-center gap-1.5 text-muted hover:text-forest">
                <Timer className="h-3.5 w-3.5" />
                Sadece 2 dk
              </button>
            )}
          </div>
          <div
            role="radiogroup"
            aria-label="Çalışma süresi"
            className={cn("inline-flex rounded-full bg-parchment p-0.5", updatingMode && "opacity-60")}
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                disabled={updatingMode}
                onClick={() => onModeChange(m.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-semibold transition-colors",
                  mode === m.id ? "bg-surface text-forest shadow-xs" : "text-muted hover:text-ink"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {plan.recoveryMessageTr && !inProgress && (
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-gold-text">
            <HeartHandshake className="h-4 w-4 shrink-0 text-gold-ink" />
            {plan.recoveryMessageTr}
          </p>
        )}
      </section>

      {dailyVerse && <DailyVerseCard verse={dailyVerse} />}
    </div>
  );
}

function DailyVerseCard({ verse }: { verse: DailyVerse }) {
  return (
    <Link
      href={`/mushaf?page=${verse.pageNumber}`}
      className={cn(
        "group relative flex flex-col justify-center gap-1.5 rounded-3xl border border-line bg-parchment px-9 py-4 text-center transition-colors hover:border-gold-line"
      )}
    >
      <RubElHizb className="absolute left-3.5 top-3" />
      <RubElHizb className="absolute right-3.5 top-3" />
      <p
        lang="ar"
        dir="rtl"
        translate="no"
        className="font-arabic text-2xl text-forest leading-[2]"
      >
        {verse.textUthmani}
      </p>
      <p className="text-xs text-muted leading-relaxed line-clamp-2">
        {verse.translationTr}
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-ink">
        Bugünün ayeti · {verse.surahNameTr} {verse.verseKey.split(":")[1]}
      </p>
    </Link>
  );
}

/** Rub el-hizb star (two overlapping squares), the mushaf's own section marker. */
function RubElHizb({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden className={cn("text-gold", className)}>
      <rect x="4" y="4" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <rect
        x="4"
        y="4"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        transform="rotate(45 10 10)"
      />
    </svg>
  );
}
