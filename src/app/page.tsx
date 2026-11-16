import { getBackendConfigurationStatus, getRepository } from "@/lib/db";
import { allPageLabels, hifzMeta, legacyMemorizedPages } from "@/lib/hifz/page-data";
import { HifzHome } from "@/components/hifz/HifzHome";
import { AccountMenu } from "@/components/layout/AccountMenu";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const repo = await getRepository();
  const [snapshot, backendStatus] = await Promise.all([
    repo.getDashboardSnapshot(),
    getBackendConfigurationStatus(),
  ]);
  return (
    <>
      {/* Phone: sits inside the sticky top bar, right side. Desktop: top-right of the page. */}
      <div className="fixed right-4 top-3 z-40 lg:static lg:-mt-4 lg:mb-3 lg:flex lg:justify-end">
        <AccountMenu
          email={backendStatus.supabaseAuthenticatedUserEmail}
          configured={backendStatus.supabaseConfigured}
        />
      </div>
      <HifzHome
        pageLabels={allPageLabels()}
        currentPageNumber={snapshot.profile.currentPageNumber}
        meta={hifzMeta()}
        legacyPages={legacyMemorizedPages(snapshot.verseProgress)}
      />
    </>
  );
}
