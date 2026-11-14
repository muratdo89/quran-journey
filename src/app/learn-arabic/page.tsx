import { getRepository } from "@/lib/db";
import { LearnArabicClient } from "@/components/learn-arabic/LearnArabicClient";

export const dynamic = "force-dynamic";

export default async function LearnArabicPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();

  return (
    <LearnArabicClient
      initialPlacementCompleted={snapshot.profile.placementCompleted}
      initialPlacementLevel={snapshot.profile.placementLevel}
      initialPlacementScore={snapshot.profile.placementScorePercent}
      initialCompletedModuleIds={snapshot.completedReadingModuleIds}
      initialPracticedTajweedSlugs={snapshot.practicedTajweedSlugs}
      initialTab={params.tab}
    />
  );
}
