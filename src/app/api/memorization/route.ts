import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/db";

const MemorizationSchema = z.object({
  verseKey: z.string().regex(/^\d+:\d+$/),
  outcome: z.enum(["failed_recall", "partial_recall", "clean_recall", "delayed_clean_recall"]),
  comprehensionDelta: z.number().int().min(-20).max(50).optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = MemorizationSchema.parse(await req.json());
    const repo = await getRepository();
    const updated = await repo.updateVerseMemorization(parsed);
    return NextResponse.json({ verseProgress: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz ezber verisi." }, { status: 400 });
    }
    console.error("POST /api/memorization failed:", error);
    return NextResponse.json({ error: "Ezber durumu güncellenemedi." }, { status: 500 });
  }
}
