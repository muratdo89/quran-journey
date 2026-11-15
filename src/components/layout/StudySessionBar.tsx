"use client";

import React, { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import {
  advanceSession,
  endSession,
  isSessionFinished,
  recordStudyLocation,
  useActiveSession,
} from "@/lib/study-session";
import { cn } from "@/lib/utils";

function LastStudyTrackerInner() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    recordStudyLocation(pathname, search);
  }, [pathname, search]);
  return null;
}

/** Remembers the last study screen so the dashboard can offer "continue where you left off". */
export function LastStudyTracker() {
  return (
    <Suspense fallback={null}>
      <LastStudyTrackerInner />
    </Suspense>
  );
}

/**
 * Sticky "today's session" bar: shows step k/N and a single "next step" button on
 * every page, so the learner never has to go back to the dashboard to find what's next.
 */
export function StudySessionBar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useActiveSession();

  if (!session || pathname === "/") return null;

  const finished = isSessionFinished(session);
  const total = session.steps.length;
  const step = session.steps[Math.min(session.index, total - 1)];
  const isLast = session.index === total - 1;

  function handleNext() {
    const href = advanceSession();
    if (href) router.push(href);
  }

  return (
    <div
      role="region"
      aria-label="Bugünkü çalışma oturumu"
      className={cn(
        "fixed inset-x-0 z-30 px-3",
        "bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:bottom-4 lg:left-64"
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-forest/15 bg-forest px-3 py-2.5 text-parchment shadow-lg shadow-forest/20">
        {finished ? (
          <>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#d9c08f]" />
            <p className="min-w-0 flex-1 text-sm font-semibold">
              Bugünkü çalışma tamam. Allah kabul etsin.
            </p>
            <Link
              href="/"
              onClick={() => endSession()}
              className="shrink-0 rounded-xl bg-parchment px-3 py-1.5 text-xs font-bold text-forest"
            >
              Panele dön
            </Link>
          </>
        ) : (
          <>
            <div className="hidden sm:flex shrink-0 gap-1" aria-hidden>
              {session.steps.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    "h-1.5 w-4 rounded-full",
                    i < session.index ? "bg-[#d9c08f]" : i === session.index ? "bg-parchment" : "bg-parchment/25"
                  )}
                />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-parchment/70">
                Adım {session.index + 1}/{total} · ~{step.estimatedMinutes} dk
              </p>
              <p className="truncate text-sm font-semibold">{step.titleTr}</p>
            </div>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-parchment px-3 py-2 text-xs font-bold text-forest hover:bg-surface"
            >
              <span>{isLast ? "Bitir" : "Sıradaki"}</span>
              {isLast ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => endSession()}
          aria-label="Oturumu kapat"
          className="shrink-0 rounded-lg p-1 text-parchment/60 hover:text-parchment"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
