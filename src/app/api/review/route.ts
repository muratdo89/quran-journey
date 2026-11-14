import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/db";
import type { ReviewRating } from "@/lib/learning-engine";

const SubmitReviewSchema = z.object({
  action: z.literal("submit").optional().default("submit"),
  cardId: z.string().min(1),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  responseTimeMs: z.number().int().nonnegative().optional(),
});

const EnsureCardSchema = z.object({
  action: z.literal("ensure_vocab"),
  wordLocation: z.string().regex(/^\d+:\d+:\d+$/),
  direction: z.enum(["ar_to_tr", "tr_to_ar"]).optional().default("ar_to_tr"),
});

const EnsureSurahCardsSchema = z.object({
  action: z.literal("ensure_surah_vocab"),
  surahId: z.number().int().min(1).max(114),
  direction: z.enum(["ar_to_tr", "tr_to_ar"]).optional().default("ar_to_tr"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const repo = await getRepository();

    if (body?.action === "ensure_vocab") {
      const parsed = EnsureCardSchema.parse(body);
      const card = await repo.ensureVocabularyCard({
        wordLocation: parsed.wordLocation,
        direction: parsed.direction,
      });
      return NextResponse.json({ card });
    }

    if (body?.action === "ensure_surah_vocab") {
      const parsed = EnsureSurahCardsSchema.parse(body);
      const summary = await repo.ensureSurahVocabularyCards({
        surahId: parsed.surahId,
        direction: parsed.direction,
      });
      return NextResponse.json(summary);
    }

    const parsed = SubmitReviewSchema.parse(body);
    const result = await repo.submitCardReview({
      cardId: parsed.cardId,
      rating: parsed.rating as ReviewRating,
      responseTimeMs: parsed.responseTimeMs,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Geçersiz tekrar verisi.", details: error.issues },
        { status: 400 }
      );
    }
    console.error("POST /api/review failed:", error);
    return NextResponse.json({ error: "Tekrar kaydedilemedi." }, { status: 500 });
  }
}
