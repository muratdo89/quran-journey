import { getQuranMeta, getSurahMeta, getVerseByKey } from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";
import { buildHifzPageData } from "@/lib/hifz/page-data";
import { MushafReader, type MushafNavData } from "@/components/mushaf-reader/MushafReader";

export const dynamic = "force-dynamic";

function navData(): MushafNavData {
  const meta = getQuranMeta();
  const juzStarts: number[] = [];
  for (let p = 1; p <= meta.totalPages; p++) {
    const juz = meta.pageJuzHizb[String(p)]?.[0];
    if (juz && !juzStarts[juz - 1]) juzStarts[juz - 1] = p;
  }
  return {
    surahs: meta.surahs.map((s) => ({ id: s.id, name: s.nameTurkish, arabic: s.nameArabic, startPage: s.pages[0] })),
    juzStarts,
  };
}

export default async function MushafPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; surah?: string; verse?: string }>;
}) {
  const params = await searchParams;
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();

  let page = snapshot.profile.currentPageNumber;
  const requestedPage = Number(params.page);
  const requestedSurah = Number(params.surah);
  if (Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 604) {
    page = requestedPage;
  } else if (params.verse && /^\d+:\d+$/.test(params.verse)) {
    page = getVerseByKey(params.verse)?.pageNumber ?? page;
  } else if (Number.isInteger(requestedSurah)) {
    page = getSurahMeta(requestedSurah)?.pages[0] ?? page;
  }
  if (!Number.isInteger(page) || page < 1 || page > 604) page = 1;

  return (
    <MushafReader
      key={page}
      data={buildHifzPageData(page, snapshot.preferences.preferredReciterId)}
      nav={navData()}
      focusVerse={params.verse ?? null}
    />
  );
}
