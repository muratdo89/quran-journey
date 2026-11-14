import { NextResponse } from "next/server";
import { getBackendConfigurationStatus, getRepository } from "@/lib/db";
import { buildDailyLearningPlan, prioritizeDueCards } from "@/lib/learning-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repo = await getRepository();
    const snapshot = await repo.getDashboardSnapshot();
    const dailyPlan = buildDailyLearningPlan({
      requestedMode: snapshot.goals.sessionMode,
      cards: snapshot.cards,
      verseStates: snapshot.verseProgress.map((v) => ({
        verseKey: v.verseKey,
        memorizationState: v.memorizationState,
      })),
      currentPageNumber: snapshot.profile.currentPageNumber,
      daysSinceLastStudy: snapshot.daysSinceLastStudy,
      placementCompleted: snapshot.profile.placementCompleted,
    });
    const dueCards = prioritizeDueCards(snapshot.cards);

    return NextResponse.json({
      snapshot,
      dailyPlan,
      dueCardsCount: dueCards.length,
      backendStatus: await getBackendConfigurationStatus(),
    });
  } catch (error) {
    console.error("GET /api/state failed:", error);
    return NextResponse.json(
      { error: "Öğrenme durumu yüklenemedi." },
      { status: 500 }
    );
  }
}
