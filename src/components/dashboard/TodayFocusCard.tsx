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
import type { DailyVerse, JuzProgress } from "@/lib/content/daily-focus";

interface TodayFocusCardProps {
  dailyVerse: DailyVerse | null;
  juzProgress: JuzProgress;
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
export function TodayFocusCard({ dailyVerse, juzProgress, displayName, plan, streakDays, activePage }: TodayFocusCardProps) {
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

  const currentStepTitle = inProgress
    ? session.steps[session.index].titleTr
    : finished
      ? "Bugünkü adımlar tamam"
      : steps[0]?.titleTr ?? `Mushaf · Sayfa ${activePage}`;
  const ringShare = juzProgress.pagesInJuz
    ? juzProgress.studiedPagesInJuz / juzProgress.pagesInJuz
    : 0;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_1px_0_rgba(31,42,35,0.04),0_12px_32px_-18px_rgba(27,67,50,0.18)]">
      <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
        {/* Left: the one job of this screen */}
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-muted">
            <span suppressHydrationWarning>
              Selam, {displayName} · {WEEKDAY.format(new Date())}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 font-semibold text-gold-ink">
              <Flame className="h-3.5 w-3.5" />
              {streakDays} gün seri
            </span>
          </div>

          {dailyVerse && (
            <DailyVerseCard verse={dailyVerse} className="lg:hidden" />
          )}

          <div className="space-y-2">
            <h1 className="font-display text-[1.75rem] sm:text-[2.25rem] font-semibold leading-[1.15] tracking-tight text-ink text-balance">
              {title}
            </h1>
            <p className="text-sm text-muted">
              {finished
                ? "Tebrikler. İstersen kısa bir tur daha yapabilir ya da Mushaf'ta serbest okuyabilirsin."
                : inProgress
                  ? `Adım ${session.index + 1}/${session.steps.length} · kalan ~${remainingMinutes} dk`
                  : `${steps.length} adım, sırayla. Her adımın sonunda “Sıradaki” ile devam et.`}
            </p>
          </div>

          <div className="flex items-center gap-3.5">
            <JuzRing share={ringShare} />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted">
                {juzProgress.juzNumber}. Cüz · {juzProgress.hizbNumber}. Hizb ·{" "}
                {juzProgress.studiedPagesInJuz}/{juzProgress.pagesInJuz} sayfa
              </p>
              <p className="truncate text-sm font-semibold text-ink">
                {inProgress || !finished ? `Sıradaki: ${currentStepTitle}` : currentStepTitle}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={finished ? handleMini : handlePrimary}
              className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-forest px-6 py-4 text-base font-semibold text-parchment shadow-sm shadow-forest/20 transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:self-start sm:min-w-80"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-parchment/15">
                <Play className="h-4 w-4 fill-current" />
              </span>
              <span>
                {finished ? "Bir tur daha (2 dk)" : inProgress ? "Devam et" : "Bugünkü çalışmayı başlat"}
              </span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
              <Link
                href={continueHref}
                className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-line bg-parchment px-3.5 py-3 text-left hover:bg-sand"
              >
                <History className="h-4 w-4 shrink-0 text-forest" />
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-muted">Kaldığın yer</span>
                  <span className="block truncate text-xs font-semibold text-ink">{continueLabel}</span>
                </span>
              </Link>
              {!finished && (
                <button
                  type="button"
                  onClick={handleMini}
                  className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-line bg-parchment px-3.5 py-3 text-left hover:bg-sand"
                >
                  <Timer className="h-4 w-4 shrink-0 text-gold" />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium text-muted">Vaktin az mı?</span>
                    <span className="block truncate text-xs font-semibold text-ink">Sadece 2 dakika</span>
                  </span>
                </button>
              )}
            </div>
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
                      "snap-start shrink-0 w-40 rounded-2xl border px-3 py-2.5",
                      current
                        ? "border-forest bg-mint"
                        : done
                          ? "border-line bg-parchment opacity-70"
                          : "border-line bg-parchment"
                    )}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
                      <span>Adım {i + 1}</span>
                      {done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
                      ) : (
                        <span>{s.estimatedMinutes} dk</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-ink">
                      {s.titleTr}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}

          {plan.recoveryMessageTr && !inProgress && (
            <div className="flex items-start gap-3 rounded-2xl border border-gold-line bg-gold-soft p-4 text-sm text-gold-text">
              <HeartHandshake className="h-5 w-5 text-gold-ink shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm leading-relaxed">{plan.recoveryMessageTr}</p>
            </div>
          )}
        </div>

        {/* Right (desktop): verse of the day */}
        {dailyVerse && (
          <DailyVerseCard verse={dailyVerse} className="hidden lg:flex" large />
        )}
      </div>
    </section>
  );
}

function DailyVerseCard({
  verse,
  className,
  large = false,
}: {
  verse: DailyVerse;
  className?: string;
  large?: boolean;
}) {
  return (
    <Link
      href={`/mushaf?page=${verse.pageNumber}`}
      className={cn(
        "group relative flex flex-col justify-center gap-2 rounded-3xl border border-line bg-parchment px-5 text-center transition-colors hover:border-gold-line",
        large ? "py-8" : "py-4",
        className
      )}
    >
      <RubElHizb className="absolute left-3.5 top-3" />
      <RubElHizb className="absolute right-3.5 top-3" />
      <p
        lang="ar"
        dir="rtl"
        translate="no"
        className={cn(
          "font-arabic text-forest leading-[2]",
          large ? "text-[1.85rem]" : "text-2xl"
        )}
      >
        {verse.textUthmani}
      </p>
      <p className={cn("text-muted leading-relaxed", large ? "text-sm" : "text-xs line-clamp-2")}>
        {verse.translationTr}
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-ink">
        Bugünün ayeti · {verse.surahNameTr} {verse.verseKey.split(":")[1]}
      </p>
    </Link>
  );
}

function JuzRing({ share }: { share: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0.02, Math.min(1, share)) * c;
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden className="shrink-0">
      <circle cx="23" cy="23" r={r} fill="none" stroke="var(--qj-track)" strokeWidth="5" />
      <circle
        cx="23"
        cy="23"
        r={r}
        fill="none"
        stroke="var(--qj-forest)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`}
        transform="rotate(-90 23 23)"
      />
    </svg>
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
