import { getAllVerifiedWords } from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";
import { ReviewClient } from "@/components/review/ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();
  const words = getAllVerifiedWords();
  const wordsByLocation = Object.fromEntries(words.map((w) => [w.location, w]));

  return (
    <ReviewClient
      initialCards={snapshot.cards}
      wordsByLocation={wordsByLocation}
      isRecoveryMode={params.mode === "recovery"}
    />
  );
}
