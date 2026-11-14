import {
  getAvailablePages,
  getAvailableSurahs,
  getMushafPageData,
  getSurahEntry,
  getWordsByRoot,
} from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";
import { MushafStudyClient } from "@/components/mushaf/MushafStudyClient";

export const dynamic = "force-dynamic";

export default async function MushafPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; surah?: string }>;
}) {
  const params = await searchParams;
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();
  const availablePages = getAvailablePages();
  const availableSurahs = getAvailableSurahs();

  let targetPage = snapshot.profile.currentPageNumber;
  const requestedPage = Number(params.page);
  const requestedSurah = Number(params.surah);

  if (Number.isInteger(requestedPage) && availablePages.includes(requestedPage)) {
    targetPage = requestedPage;
  } else if (Number.isInteger(requestedSurah)) {
    const surahEntry = getSurahEntry(requestedSurah);
    if (surahEntry && availablePages.includes(surahEntry.surah.pages[0])) {
      targetPage = surahEntry.surah.pages[0];
    }
  }

  const pageData = getMushafPageData(targetPage);

  // Precompute cross-collection root occurrences only for roots appearing on this page
  const rootOccurrencesMap: Record<
    string,
    Array<{
      location: string;
      verseKey: string;
      textUthmani: string;
      translationTr: string;
      pageNumber: number;
    }>
  > = {};

  for (const section of pageData.sections) {
    for (const verse of section.verses) {
      for (const word of verse.words) {
        const root = word.morphology.rootArabic;
        if (root && !rootOccurrencesMap[root]) {
          rootOccurrencesMap[root] = getWordsByRoot(root)
            .slice(0, 12)
            .map((w) => ({
              location: w.location,
              verseKey: w.verseKey,
              textUthmani: w.textUthmani,
              translationTr: w.translationTr,
              pageNumber: w.pageNumber,
            }));
        }
      }
    }
  }

  return (
    <MushafStudyClient
      key={pageData.pageNumber}
      pageData={pageData}
      availableSurahs={availableSurahs}
      rootOccurrencesMap={rootOccurrencesMap}
      initialPreferences={snapshot.preferences}
      initialBookmarks={snapshot.bookmarks}
      initialNotes={snapshot.notes}
      initialRecordings={snapshot.recordings}
      initialPageProgress={snapshot.pageProgress}
    />
  );
}
