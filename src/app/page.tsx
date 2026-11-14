import { ARABIC_READING_MODULES, TAJWEED_LESSONS } from "@/lib/content/arabic-curriculum";
import { getAvailablePages, getAvailableSurahs } from "@/lib/content/canonical-loader";
import { getBackendConfigurationStatus, getRepository } from "@/lib/db";
import { buildDailyLearningPlan } from "@/lib/learning-engine";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const repo = await getRepository();
  const [snapshot, backendStatus] = await Promise.all([
    repo.getDashboardSnapshot(),
    getBackendConfigurationStatus(),
  ]);

  const dailyPlan = buildDailyLearningPlan({
    requestedMode: snapshot.goals.sessionMode,
    cards: snapshot.cards,
    verseStates: snapshot.verseProgress.map((v) => ({
      verseKey: v.verseKey,
      memorizationState: v.memorizationState,
    })),
    currentPageNumber: snapshot.profile.currentPageNumber,
    daysSinceLastStudy: snapshot.daysSinceLastStudy,
    placementCompleted: snapshot.profile.placementCompleted,
  });

  return (
    <DashboardClient
      initialSnapshot={snapshot}
      initialPlan={dailyPlan}
      backendStatus={backendStatus}
      totalSurahs={getAvailableSurahs().length}
      totalPages={getAvailablePages().length}
      totalReadingModules={ARABIC_READING_MODULES.length}
      totalTajweedLessons={TAJWEED_LESSONS.length}
    />
  );
}
