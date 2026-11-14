import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/db";

const PrefsSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  arabicFontSize: z.number().int().min(20).max(56).optional(),
  arabicLineHeight: z.number().min(1.5).max(3.0).optional(),
  themeMode: z.enum(["light", "dark"]).optional(),
  showTranslationDefault: z.boolean().optional(),
  showTransliteration: z.boolean().optional(),
  preferredReciterId: z.number().int().optional(),
  preferredTranslationId: z.number().int().optional(),
  playbackSpeed: z.number().min(0.5).max(1.5).optional(),
  cloudAiAudioConsent: z.boolean().optional(),
  sessionMode: z.enum(["normal", "intensive", "recovery"]).optional(),
  dailyTargetMinutes: z.number().int().min(3).max(120).optional(),
  currentPageNumber: z.number().int().min(1).max(604).optional(),
});

export async function PATCH(req: Request) {
  try {
    const parsed = PrefsSchema.parse(await req.json());
    const repo = await getRepository();
    await repo.updatePreferences(parsed);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz ayar değeri." }, { status: 400 });
    }
    return NextResponse.json({ error: "Ayarlar kaydedilemedi." }, { status: 500 });
  }
}
