import { z } from "zod";

export const PREFS_COOKIE = "qj_prefs";

export const PrefsSchema = z.object({
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

export type PrefsPatch = z.infer<typeof PrefsSchema>;

export function parsePrefsCookie(raw: string): PrefsPatch | null {
  try {
    const parsed = PrefsSchema.safeParse(JSON.parse(decodeURIComponent(raw)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Merges a saved patch into the cookie value so the latest choice of every setting is kept. */
export function mergePrefsCookie(existingRaw: string | undefined, patch: PrefsPatch): string {
  const existing = existingRaw ? parsePrefsCookie(existingRaw) ?? {} : {};
  return encodeURIComponent(JSON.stringify({ ...existing, ...patch }));
}
