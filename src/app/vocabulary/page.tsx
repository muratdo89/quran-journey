import { getAvailableSurahs, getWordsPage } from "@/lib/content/canonical-loader";
import { VocabularyClient, type VocabularyScope } from "@/components/vocabulary/VocabularyClient";

export const dynamic = "force-dynamic";

export default async function VocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{ surah?: string; page?: string; root?: string; q?: string }>;
}) {
  const params = await searchParams;
  const surahs = getAvailableSurahs();

  const surahNum = Number(params.surah);
  const mushafPage = Number(params.page);
  const root = params.root?.trim() || null;
  const query = params.q ?? "";

  // An explicit link (?surah=, ?page=, ?root=, ?q=) wins; otherwise the client may switch to the hifz page.
  let scope: VocabularyScope;
  if (Number.isInteger(mushafPage) && mushafPage >= 1 && mushafPage <= 604) scope = `page:${mushafPage}`;
  else if (Number.isInteger(surahNum) && surahNum >= 1 && surahNum <= 114) scope = `surah:${surahNum}`;
  else if (root || query) scope = "all";
  else scope = "surah:1";
  const explicit = Boolean(params.surah || params.page || root || query);

  const initial =
    scope === "all" && !root && !query.trim()
      ? { items: [], total: 0, page: 1, pageSize: 30, totalPages: 1 }
      : getWordsPage({
          surahId: scope.startsWith("surah:") ? Number(scope.slice(6)) : "all",
          mushafPage: scope.startsWith("page:") ? Number(scope.slice(5)) : undefined,
          rootArabic: root ?? "all",
          query,
          unique: true,
          page: 1,
          pageSize: 30,
        });

  return (
    <VocabularyClient
      surahs={surahs.map((s) => ({ id: s.id, nameTurkish: s.nameTurkish }))}
      initial={initial}
      initialScope={scope}
      initialRoot={root}
      initialQuery={query}
      explicit={explicit}
    />
  );
}
