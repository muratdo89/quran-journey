"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Flame, HeartHandshake, History, Play, Timer } from "lucide-react";
import type { DailyLearningPlan } from "@/lib/learning-engine";
import {
  isSessionFinished,
  startSession,
  useActiveSession,
  useLastStudy,
  type SessionStep,
} from "@/lib/study-session";
import { cn } from "@/lib/utils";

interface TodayFocusCardProps {
  displayName: string;
  plan: DailyLearningPlan;
  streakDays: number;
  activePage: number;
}

export function toSessionSteps(plan: DailyLearningPlan): SessionStep[] {
  return plan.steps.map((s) => ({
    id: s.id,
    titleTr: s.titleTr,
    href: s.href,
    estimatedMinutes: s.estimatedMinutes,
  }));
}

const WEEKDAY = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" });

/**
 * The first thing on the dashboard: one big button that starts (or resumes) today's
 * guided session, plus "continue where you left off" and a 2-minute fallback for
 * low-energy days. Everything else on the dashboard is secondary.
 */
export function TodayFocusCard({ displayName, plan, streakDays, activePage }: TodayFocusCardProps) {
  const router = useRouter();
  const session = useActiveSession();
  const lastStudy = useLastStudy();

  const steps = toSessionSteps(plan);
  const finished = isSessionFinished(session);
  const inProgress = !!session && !finished;
  const currentIndex = inProgress ? session.index : finished ? steps.length : -1;
  const shownSteps = session?.steps ?? steps;

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
      ? "Kaldığın yerden devam edelim."
      : `Bugün ~${plan.totalEstimatedMinutes} dakika. Hazırsan başlayalım.`;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#e5dec9] bg-white shadow-xs">
      {/* soft geometric backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,#f3ead6_0%,transparent_70%)]"
      />
      <div className="relative p-5 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-[#5a655e]">
          <span suppressHydrationWarning>
            Selam, {displayName} · {WEEKDAY.format(new Date())}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f7f1e3] px-2.5 py-1 font-semibold text-[#8d682c]">
            <Flame className="h-3.5 w-3.5" />
            {streakDays} gün seri
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-[2rem] sm:leading-tight font-bold tracking-tight text-[#1c241f]">
            {title}
          </h1>
          <p className="text-sm text-[#5a655e]">
            {finished
              ? "Tebrikler. İstersen kısa bir tur daha yapabilir ya da Mushaf'ta serbest okuyabilirsin."
              : inProgress
                ? `Adım ${session.index + 1}/${session.steps.length} · kalan ~${remainingMinutes} dk`
                : `${steps.length} adım, sırayla. Her adımın sonunda “Sıradaki” ile devam et, sayfalarda kaybolma.`}
          </p>
        </div>

        {/* Step track */}
        {shownSteps.length > 0 && (
          <ol className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x" aria-label="Bugünkü adımlar">
            {shownSteps.map((s, i) => {
              const done = i < currentIndex;
              const current = i === currentIndex;
              return (
                <li
                  key={s.id}
                  className={cn(
                    "snap-start shrink-0 w-44 rounded-2xl border px-3 py-2.5",
                    current
                      ? "border-[#1b4332] bg-[#edf5f0]"
                      : done
                        ? "border-[#e5dec9] bg-[#faf8f3] opacity-70"
                        : "border-[#e5dec9] bg-[#faf8f3]"
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#5a655e]">
                    <span>Adım {i + 1}</span>
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#2d6a4f]" />
                    ) : (
                      <span>{s.estimatedMinutes} dk</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-[#1c241f]">
                    {s.titleTr}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <button
            type="button"
            onClick={finished ? handleMini : handlePrimary}
            className="group inline-flex flex-1 items-center justify-center gap-3 rounded-2xl bg-[#1b4332] px-6 py-4 text-base font-semibold text-[#faf8f3] shadow-sm shadow-[#1b4332]/20 transition-colors hover:bg-[#143326] sm:flex-none sm:min-w-64"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#faf8f3]/15">
              <Play className="h-4 w-4 fill-current" />
            </span>
            <span>
              {finished ? "Bir tur daha (2 dk)" : inProgress ? "Devam et" : "Bugünkü çalışmayı başlat"}
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-1">
            <Link
              href={continueHref}
              className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#e5dec9] bg-[#faf8f3] px-3.5 py-3 text-left hover:bg-[#f3efe6] sm:flex-1"
            >
              <History className="h-4 w-4 shrink-0 text-[#1b4332]" />
              <span className="min-w-0">
                <span className="block text-[11px] font-medium text-[#5a655e]">Kaldığın yer</span>
                <span className="block truncate text-xs font-semibold text-[#1c241f]">{continueLabel}</span>
              </span>
            </Link>
            {!finished && (
              <button
                type="button"
                onClick={handleMini}
                className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#e5dec9] bg-[#faf8f3] px-3.5 py-3 text-left hover:bg-[#f3efe6] sm:flex-1"
              >
                <Timer className="h-4 w-4 shrink-0 text-[#b08d57]" />
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-[#5a655e]">Vaktin az mı?</span>
                  <span className="block truncate text-xs font-semibold text-[#1c241f]">Sadece 2 dakika</span>
                </span>
              </button>
            )}
          </div>
        </div>

        {plan.recoveryMessageTr && !inProgress && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#e3d2ae] bg-[#f7f1e3] p-4 text-sm text-[#4a3b1f]">
            <HeartHandshake className="h-5 w-5 text-[#9a7639] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm leading-relaxed">{plan.recoveryMessageTr}</p>
          </div>
        )}
      </div>
    </section>
  );
}
