import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/db";

const CompleteSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("reading_module"), moduleId: z.string().min(1) }),
  z.object({ kind: z.literal("tajweed"), slug: z.string().min(1) }),
]);

export async function POST(req: Request) {
  try {
    const parsed = CompleteSchema.parse(await req.json());
    const repo = await getRepository();
    if (parsed.kind === "reading_module") {
      await repo.completeReadingModule({ moduleId: parsed.moduleId });
    } else {
      await repo.markTajweedPracticed({ slug: parsed.slug });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz ders kaydı." }, { status: 400 });
    }
    return NextResponse.json({ error: "Ders ilerlemesi kaydedilemedi." }, { status: 500 });
  }
}
