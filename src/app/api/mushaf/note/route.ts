import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/db";

const NoteSchema = z.object({
  verseKey: z.string().regex(/^\d+:\d+$/),
  pageNumber: z.number().int().min(1).max(604),
  noteText: z.string().max(2000),
  isDifficult: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const parsed = NoteSchema.parse(await req.json());
    const repo = await getRepository();
    const note = await repo.saveNote(parsed);
    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz not verisi." }, { status: 400 });
    }
    return NextResponse.json({ error: "Not kaydedilemedi." }, { status: 500 });
  }
}
