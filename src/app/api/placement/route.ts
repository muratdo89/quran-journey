import { NextResponse } from "next/server";
import { z } from "zod";
import { ARABIC_READING_MODULES } from "@/lib/content/arabic-curriculum";
import { getRepository } from "@/lib/db";
import { evaluatePlacementAssessment } from "@/lib/learning-engine";

const PlacementSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

export async function POST(req: Request) {
  try {
    const parsed = PlacementSchema.parse(await req.json());
    const evaluation = evaluatePlacementAssessment({ answers: parsed.answers });

    const masteredModuleIds = ARABIC_READING_MODULES.filter((m) =>
      evaluation.masteredCategories.includes(m.category)
    ).map((m) => m.id);

    const repo = await getRepository();
    await repo.savePlacementResult({
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      scorePercent: evaluation.scorePercent,
      levelLabelTr: evaluation.levelLabelTr,
      masteredModuleIds,
    });

    return NextResponse.json({ evaluation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz değerlendirme cevabı." }, { status: 400 });
    }
    return NextResponse.json({ error: "Değerlendirme kaydedilemedi." }, { status: 500 });
  }
}
