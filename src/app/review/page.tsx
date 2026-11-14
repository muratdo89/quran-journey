import { getWordByLocation } from "@/lib/content/canonical-loader";
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

  const wordsByLocation: Record<string, NonNullable<ReturnType<typeof getWordByLocation>>> = {};
  for (const card of snapshot.cards) {
    if (card.cardType !== "vocabulary" || wordsByLocation[card.targetKey]) continue;
    const word = getWordByLocation(card.targetKey);
    if (word) {
      wordsByLocation[card.targetKey] = word;
    }
  }

  return (
    <ReviewClient
      initialCards={snapshot.cards}
      wordsByLocation={wordsByLocation}
      isRecoveryMode={params.mode === "recovery"}
    />
  );
}
