import {
  getAvailableSurahs,
  getMutashabihatMapForVerses,
  getSurahEntry,
} from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";
import { MemorizationClient } from "@/components/memorization/MemorizationClient";

export const dynamic = "force-dynamic";

export default async function MemorizationPage({
  searchParams,
}: {
  searchParams: Promise<{ surah?: string; verse?: string }>;
}) {
  const params = await searchParams;
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();

  let targetSurahId = 1;
  const requestedSurah = Number(params.surah);
  if (Number.isInteger(requestedSurah) && getSurahEntry(requestedSurah)) {
    targetSurahId = requestedSurah;
  } else if (params.verse && /^\d+:\d+$/.test(params.verse)) {
    const verseSurah = Number(params.verse.split(":")[0]);
    if (getSurahEntry(verseSurah)) {
      targetSurahId = verseSurah;
    }
  }

  const entry = getSurahEntry(targetSurahId) ?? getSurahEntry(1)!;
  const availableSurahs = getAvailableSurahs();
  const mutashabihatMap = getMutashabihatMapForVerses(
    entry.verses.map((v) => v.verseKey)
  );

  return (
    <MemorizationClient
      key={entry.surah.id}
      surah={entry.surah}
      verses={entry.verses}
      availableSurahs={availableSurahs}
      mutashabihatMap={mutashabihatMap}
      initialVerseProgress={snapshot.verseProgress}
      initialVerseKey={params.verse}
      initialReciterId={snapshot.preferences.preferredReciterId}
    />
  );
}
