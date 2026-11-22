import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/db";
import { orchestrateTutorTurn } from "@/lib/tutor/gemini-orchestrator";
import { createInitialTutorSessionState } from "@/lib/tutor/types";

export const dynamic = "force-dynamic";

const HistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
});

const SessionStateSchema = z.object({
  phase: z.enum([
    "welcome",
    "reading",
    "tajweed",
    "vocabulary",
    "hifz_listen",
    "hifz_recite",
    "wrap_up",
  ]),
  pace: z.enum(["normal", "short"]),
  currentPageNumber: z.number().int().min(1).max(604),
  currentVerseKey: z.string().nullable(),
  currentWordLocation: z.string().nullable(),
  currentCardId: z.string().nullable(),
  currentReadingModuleId: z.string().nullable(),
  currentTajweedSlug: z.string().nullable(),
  playbackRate: z.number().min(0.5).max(1.5).default(1),
  attemptCount: z.number().int().min(0).max(20),
  vocabDoneCount: z.number().int().min(0).max(200),
  versesDoneCount: z.number().int().min(0).max(200),
  warmupDone: z.boolean(),
  askedWordLocations: z.array(z.string()).max(100),
  history: z.array(HistoryItemSchema).max(20),
});

const TurnRequestSchema = z.object({
  action: z.enum(["start", "user_speech", "recitation_result", "next_step"]).optional(),
  userText: z.string().max(1200).optional(),
  recitationTranscript: z.string().max(1200).optional(),
  reciterId: z.number().int().optional(),
  hifzActivePage: z.number().int().min(1).max(604).optional(),
  hifzReviewPages: z.array(z.number().int().min(1).max(604)).max(20).optional(),
  skipInlineTts: z.boolean().optional(),
  sessionState: SessionStateSchema.optional(),
});

export async function POST(req: Request) {
  try {
    const body = TurnRequestSchema.parse(await req.json());
    const repo = await getRepository();
    const snapshot = await repo.getDashboardSnapshot();

    const startPage = body.hifzActivePage ?? snapshot.profile.currentPageNumber;
    const sessionState =
      body.sessionState ?? createInitialTutorSessionState(startPage);

    const response = await orchestrateTutorTurn({
      request: {
        action: body.action,
        userText: body.userText,
        recitationTranscript: body.recitationTranscript,
        reciterId: body.reciterId,
        hifzActivePage: body.hifzActivePage,
        hifzReviewPages: body.hifzReviewPages,
        skipInlineTts: body.skipInlineTts,
        sessionState,
      },
      snapshot,
      repo,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz ders oturumu isteği." }, { status: 400 });
    }
    console.error("POST /api/tutor/turn failed:", error);
    return NextResponse.json(
      { error: "Sesli hoca yanıtı şu an oluşturulamadı." },
      { status: 500 }
    );
  }
}
