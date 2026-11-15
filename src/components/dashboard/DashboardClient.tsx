"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BarChart3, Cloud } from "lucide-react";
import type { BackendConfigurationStatus, DashboardStateSnapshot } from "@/lib/db/types";
import type { DailyLearningPlan, SessionMode } from "@/lib/learning-engine";
import type { DailyVerse, JuzProgress } from "@/lib/content/daily-focus";
import { TodayFocusCard } from "@/components/dashboard/TodayFocusCard";

interface DashboardClientProps {
  dailyVerse: DailyVerse | null;
  juzProgress: JuzProgress;
  initialSnapshot: DashboardStateSnapshot;
  initialPlan: DailyLearningPlan;
  backendStatus: BackendConfigurationStatus;
}

/**
 * The dashboard does one job: get the learner studying. Progress details (pillars,
 * memorization grid, stats) live on the Statistics page, one tap away.
 */
export function DashboardClient({
  dailyVerse,
  juzProgress,
  initialSnapshot,
  initialPlan,
  backendStatus,
}: DashboardClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [plan, setPlan] = useState(initialPlan);
  const [updatingMode, setUpdatingMode] = useState(false);

  async function handleModeChange(mode: SessionMode) {
    setUpdatingMode(true);
    try {
      await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionMode: mode,
          dailyTargetMinutes: mode === "recovery" ? 5 : mode === "intensive" ? 35 : 20,
        }),
      });
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data.snapshot);
        setPlan(data.dailyPlan);
      }
    } finally {
      setUpdatingMode(false);
    }
  }

  const isEphemeral = backendStatus.activePersistence === "sqlite_ephemeral_tmp";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <TodayFocusCard
        displayName={snapshot.profile.displayName}
        plan={plan}
        streakDays={snapshot.currentStreakDays}
        activePage={snapshot.profile.currentPageNumber}
        dailyVerse={dailyVerse}
        juzProgress={juzProgress}
        mode={snapshot.goals.sessionMode}
        updatingMode={updatingMode}
        onModeChange={handleModeChange}
      />

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-muted">
        <Link href="/statistics" className="inline-flex items-center gap-1.5 hover:text-forest">
          <BarChart3 className="h-3.5 w-3.5" />
          İlerlemeni gör
        </Link>
        {isEphemeral && (
          <Link href="/settings" className="inline-flex items-center gap-1.5 text-gold-ink hover:text-forest">
            <Cloud className="h-3.5 w-3.5" />
            İlerlemen geçici, kalıcı kayıt için Ayarlar
          </Link>
        )}
      </div>
    </div>
  );
}
