"use client";

import React, { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { markStepVisited, recordStudyLocation } from "@/lib/study-session";

function LastStudyTrackerInner() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    recordStudyLocation(pathname, search);
    markStepVisited(pathname);
  }, [pathname, search]);
  return null;
}

/**
 * Remembers the last study screen ("Kaldığın yer") and ticks off today's plan step for the
 * page the learner opened, so the dashboard boxes show what's done without a bottom bar.
 */
export function LastStudyTracker() {
  return (
    <Suspense fallback={null}>
      <LastStudyTrackerInner />
    </Suspense>
  );
}
