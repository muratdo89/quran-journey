import {
  getAvailableSurahs,
  getQuranTotals,
  getTopRoots,
  getWordsPage,
} from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";
import { VocabularyClient } from "@/components/vocabulary/VocabularyClient";

export const dynamic = "force-dynamic";

export default async function VocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{
    surah?: string;
    root?: string;
    status?: string;
    q?: string;
    page?: string;
    tab?: string;
  }>;
}) {
  const params = await searchParams;
  const surahs = getAvailableSurahs();
  const totals = getQuranTotals();
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();

  const statusMap: Record<string, string> = {};
  for (const wp of snapshot.wordProgress) {
    statusMap[wp.wordLocation] = wp.status;
  }

  const surahNum = Number(params.surah);
  const surahFilter: number | "all" =
    params.surah && params.surah !== "all" && Number.isInteger(surahNum) && surahNum >= 1 && surahNum <= 114
      ? surahNum
      : "all";
  const rootFilter = params.root || "all";
  const statusFilter =
    params.status === "new" ||
    params.status === "learning" ||
    params.status === "known" ||
    params.status === "difficult"
      ? params.status
      : "all";
  const pageNum = Math.max(1, Number(params.page) || 1);
  const query = params.q ?? "";
  const initialTab = params.tab === "roots" ? "roots" : "words";

  const initialWordsResult = getWordsPage({
    surahId: surahFilter,
    rootArabic: rootFilter,
    query,
    statusFilter,
    statusMap,
    page: pageNum,
    pageSize: 24,
  });

  const initialRootsResult = getTopRoots({
    query: initialTab === "roots" ? query : "",
    page: 1,
    pageSize: 30,
  });

  return (
    <VocabularyClient
      initialTab={initialTab}
      initialWordsResult={initialWordsResult}
      initialRootsResult={initialRootsResult}
      surahs={surahs}
      totals={totals}
      initialProgress={snapshot.wordProgress}
      initialFilters={{
        surah: surahFilter === "all" ? "all" : String(surahFilter),
        root: rootFilter,
        status: statusFilter,
        query,
      }}
    />
  );
}
