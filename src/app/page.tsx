import { ARABIC_READING_MODULES, TAJWEED_LESSONS } from "@/lib/content/arabic-curriculum";
import { getAvailablePages, getAvailableSurahs } from "@/lib/content/canonical-loader";
import { getBackendConfigurationStatus, getRepository } from "@/lib/db";
import { buildDailyLearningPlan } from "@/lib/learning-engine";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getDailyVerse, getJuzProgress } from "@/lib/content/daily-focus";

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

  const currentPage = snapshot.profile.currentPageNumber;
  const dailyVerse = getDailyVerse(currentPage);
  const juzProgress = getJuzProgress(
    currentPage,
    snapshot.pageProgress.filter((p) => p.status !== "not_started").map((p) => p.pageNumber)
  );

  return (
    <DashboardClient
      dailyVerse={dailyVerse}
      juzProgress={juzProgress}
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
