import { getAllVerifiedWords, getAvailableSurahs } from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";
import { VocabularyClient } from "@/components/vocabulary/VocabularyClient";

export const dynamic = "force-dynamic";

export default async function VocabularyPage() {
  const words = getAllVerifiedWords();
  const surahs = getAvailableSurahs();
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();

  return (
    <VocabularyClient
      words={words}
      surahs={surahs}
      initialProgress={snapshot.wordProgress}
    />
  );
}
