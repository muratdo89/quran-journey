import { getRepository } from "@/lib/db";
import { buildWarmup } from "@/lib/content/warmup";
import { WarmupClient } from "@/components/warmup/WarmupClient";

export const dynamic = "force-dynamic";

export default async function WarmupPage() {
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();
  const warmup =
    buildWarmup(snapshot.profile.currentPageNumber) ?? buildWarmup(1);

  return <WarmupClient warmup={warmup} />;
}
