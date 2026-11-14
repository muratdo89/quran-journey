import {
  getAvailablePages,
  getAvailableSurahs,
  getMushafPageData,
  getMutashabihatMapForVerses,
  getRootOccurrencesPreview,
  getSurahMeta,
  getVerseByKey,
} from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";
import { MushafStudyClient } from "@/components/mushaf/MushafStudyClient";

export const dynamic = "force-dynamic";

export default async function MushafPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; surah?: string; verse?: string }>;
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
  } else if (params.verse && /^\d+:\d+$/.test(params.verse)) {
    const v = getVerseByKey(params.verse);
    if (v && availablePages.includes(v.pageNumber)) {
      targetPage = v.pageNumber;
    }
  } else if (Number.isInteger(requestedSurah)) {
    const surahMeta = getSurahMeta(requestedSurah);
    if (surahMeta && availablePages.includes(surahMeta.pages[0])) {
      targetPage = surahMeta.pages[0];
    }
  }

  const pageData = getMushafPageData(targetPage);
  const verseKeys = pageData.sections.flatMap((s) => s.verses.map((v) => v.verseKey));
  const mutashabihatMap = getMutashabihatMapForVerses(verseKeys);

  // Precompute cross-Quran root occurrences only for roots appearing on this page
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
          rootOccurrencesMap[root] = getRootOccurrencesPreview(root, 12);
        }
      }
    }
  }

  return (
    <MushafStudyClient
      key={`${pageData.pageNumber}-${params.verse ?? ""}`}
      pageData={pageData}
      availableSurahs={availableSurahs}
      rootOccurrencesMap={rootOccurrencesMap}
      mutashabihatMap={mutashabihatMap}
      initialVerseKey={params.verse}
      initialPreferences={snapshot.preferences}
      initialBookmarks={snapshot.bookmarks}
      initialNotes={snapshot.notes}
      initialRecordings={snapshot.recordings}
      initialPageProgress={snapshot.pageProgress}
    />
  );
}
