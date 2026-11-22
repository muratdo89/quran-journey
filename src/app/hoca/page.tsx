import { getRepository } from "@/lib/db";
import { VoiceTutorClient } from "@/components/tutor/VoiceTutorClient";

export const dynamic = "force-dynamic";

export default async function HocaPage() {
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const groqConfigured = Boolean(process.env.GROQ_API_KEY?.trim());

  return (
    <VoiceTutorClient
      initialPageNumber={snapshot.profile.currentPageNumber}
      preferredReciterId={snapshot.preferences.preferredReciterId}
      initialCloudConsent={snapshot.preferences.cloudAiAudioConsent}
      geminiConfigured={geminiConfigured}
      groqConfigured={groqConfigured}
    />
  );
}
