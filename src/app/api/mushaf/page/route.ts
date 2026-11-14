import { NextResponse } from "next/server";
import { z } from "zod";
import { getAvailablePages } from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";

const MarkPageSchema = z.object({
  pageNumber: z.number().int().min(1).max(604),
});

export async function POST(req: Request) {
  try {
    const parsed = MarkPageSchema.parse(await req.json());
    if (!getAvailablePages().includes(parsed.pageNumber)) {
      return NextResponse.json(
        { error: `Sayfa ${parsed.pageNumber} henüz doğrulanmış pakette yer almıyor.` },
        { status: 404 }
      );
    }

    const repo = await getRepository();
    await repo.markPageStudied({ pageNumber: parsed.pageNumber });
    return NextResponse.json({ ok: true, pageNumber: parsed.pageNumber });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz sayfa numarası." }, { status: 400 });
    }
    console.error("POST /api/mushaf/page failed:", error);
    return NextResponse.json({ error: "Sayfa durumu kaydedilemedi." }, { status: 500 });
  }
}
