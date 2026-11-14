import { getContentManifest } from "@/lib/content/canonical-loader";
import { getBackendConfigurationStatus, getRepository } from "@/lib/db";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const repo = await getRepository();
  const [snapshot, backendStatus] = await Promise.all([
    repo.getDashboardSnapshot(),
    getBackendConfigurationStatus(),
  ]);
  const manifest = getContentManifest();

  return (
    <SettingsClient
      profile={snapshot.profile}
      preferences={snapshot.preferences}
      goals={snapshot.goals}
      backendStatus={backendStatus}
      manifest={manifest}
    />
  );
}
