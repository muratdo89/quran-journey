import { getRepository } from "@/lib/db";
import { allPageLabels, hifzMeta } from "@/lib/hifz/page-data";
import { ProgressClient } from "@/components/progress/ProgressClient";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();
  return <ProgressClient meta={hifzMeta()} pageLabels={allPageLabels()} currentPageNumber={snapshot.profile.currentPageNumber} />;
}
