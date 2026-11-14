import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/db";

const BookmarkSchema = z.object({
  verseKey: z.string().regex(/^\d+:\d+$/),
  pageNumber: z.number().int().min(1).max(604),
  label: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = BookmarkSchema.parse(await req.json());
    const repo = await getRepository();
    const result = await repo.toggleBookmark(parsed);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz yer imi verisi." }, { status: 400 });
    }
    return NextResponse.json({ error: "Yer imi kaydedilemedi." }, { status: 500 });
  }
}
