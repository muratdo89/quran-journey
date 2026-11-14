import { NextResponse } from "next/server";
import {
  getAvailablePages,
  getMushafPageData,
  getMutashabihatMapForVerses,
} from "@/lib/content/canonical-loader";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pageNum = Number(url.searchParams.get("page") ?? "1");
    if (!Number.isInteger(pageNum) || !getAvailablePages().includes(pageNum)) {
      return NextResponse.json({ error: "Geçersiz Mushaf sayfası (1–604)." }, { status: 400 });
    }

    const pageData = getMushafPageData(pageNum);
    const verseKeys = pageData.sections.flatMap((s) => s.verses.map((v) => v.verseKey));
    const mutashabihat = getMutashabihatMapForVerses(verseKeys);

    const audioUrls = Array.from(
      new Set(
        pageData.sections
          .flatMap((s) => s.verses)
          .flatMap((v) => [v.audio.alafasyAyahUrl, v.audio.husaryMuallimAyahUrl])
          .filter((u): u is string => Boolean(u))
      )
    );

    return NextResponse.json(
      { pageData, mutashabihat, audioUrls },
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
  } catch (error) {
    console.error("GET /api/mushaf/offline failed:", error);
    return NextResponse.json({ error: "Çevrimdışı sayfa paketi oluşturulamadı." }, { status: 500 });
  }
}
