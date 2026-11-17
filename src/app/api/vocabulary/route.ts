import { NextResponse } from "next/server";
import {
  getQuranTotals,
  getTopRoots,
  getWordsPage,
} from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") === "roots" ? "roots" : "words";
    const query = (url.searchParams.get("q") ?? "").trim();
    const pageParam = Number(url.searchParams.get("page") ?? "1");
    const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

    if (tab === "roots") {
      const rootsResult = getTopRoots({ query, page, pageSize: 30 });
      return NextResponse.json({
        tab: "roots",
        ...rootsResult,
      });
    }

    const surahRaw = url.searchParams.get("surah") ?? "all";
    const surahId =
      surahRaw !== "all" && Number.isInteger(Number(surahRaw)) && Number(surahRaw) >= 1 && Number(surahRaw) <= 114
        ? Number(surahRaw)
        : "all";
    const rootArabic = url.searchParams.get("root") ?? "all";
    const statusRaw = url.searchParams.get("status") ?? "all";
    const statusFilter =
      statusRaw === "new" ||
      statusRaw === "learning" ||
      statusRaw === "known" ||
      statusRaw === "difficult"
        ? statusRaw
        : "all";

    const repo = await getRepository();
    const snapshot = await repo.getDashboardSnapshot();
    const statusMap: Record<string, string> = {};
    for (const wp of snapshot.wordProgress) {
      statusMap[wp.wordLocation] = wp.status;
    }

    const mushafPageRaw = Number(url.searchParams.get("mpage"));
    const mushafPage = Number.isInteger(mushafPageRaw) && mushafPageRaw >= 1 ? mushafPageRaw : undefined;
    const unique = url.searchParams.get("unique") === "1";

    const result = getWordsPage({
      surahId,
      mushafPage,
      unique,
      rootArabic,
      query,
      statusFilter,
      statusMap,
      page,
      pageSize: mushafPage ? 200 : unique ? 30 : 24,
    });

    return NextResponse.json({
      tab: "words",
      ...result,
      totals: getQuranTotals(),
    });
  } catch (error) {
    console.error("GET /api/vocabulary failed:", error);
    return NextResponse.json({ error: "Kelime listesi yüklenemedi." }, { status: 500 });
  }
}
