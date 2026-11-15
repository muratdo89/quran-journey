import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getRepository } from "@/lib/db";
import { PREFS_COOKIE, PrefsSchema, mergePrefsCookie } from "@/lib/db/prefs-cookie";

export async function PATCH(req: Request) {
  try {
    const parsed = PrefsSchema.parse(await req.json());
    const repo = await getRepository();
    await repo.updatePreferences(parsed);
    const cookieStore = await cookies();
    cookieStore.set(PREFS_COOKIE, mergePrefsCookie(cookieStore.get(PREFS_COOKIE)?.value, parsed), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz ayar değeri." }, { status: 400 });
    }
    return NextResponse.json({ error: "Ayarlar kaydedilemedi." }, { status: 500 });
  }
}
