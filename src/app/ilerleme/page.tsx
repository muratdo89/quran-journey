import { getQuranMeta } from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";
import { ProgressClient } from "@/components/progress/ProgressClient";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const meta = getQuranMeta();
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();
  // juz number per page, index 0 = page 1
  const pageJuz = Array.from({ length: meta.totalPages }, (_, i) => meta.pageJuzHizb[String(i + 1)]?.[0] ?? 1);
  return <ProgressClient pageJuz={pageJuz} currentPageNumber={snapshot.profile.currentPageNumber} />;
}
