import { getRepository } from "@/lib/db";
import { allPageLabels, legacyMemorizedPages } from "@/lib/hifz/page-data";
import { HifzHome } from "@/components/hifz/HifzHome";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();
  return (
    <HifzHome
      pageLabels={allPageLabels()}
      currentPageNumber={snapshot.profile.currentPageNumber}
      legacyPages={legacyMemorizedPages(snapshot.verseProgress)}
    />
  );
}
