import { getWordsPage } from "@/lib/content/canonical-loader";
import { VocabularyClient, type VocabWord } from "@/components/vocabulary/VocabularyClient";

export const dynamic = "force-dynamic";

export default async function VocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; root?: string; q?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.page);
  const explicit = Number.isInteger(requested) && requested >= 1 && requested <= 604;
  // Without ?page= the client switches to the page being memorized; page 1 (Fâtiha) until then.
  const page = explicit ? requested : 1;

  const { items } = getWordsPage({ mushafPage: page, unique: true, pageSize: 200 });

  return (
    <VocabularyClient
      initialPage={page}
      initialWords={items as VocabWord[]}
      initialRoot={params.root?.trim() || null}
      initialQuery={params.q ?? ""}
      explicit={explicit}
    />
  );
}
