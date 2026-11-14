import { NextResponse } from "next/server";
import { getTopRoots, searchQuranVerses } from "@/lib/content/canonical-loader";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    const scopeParam = url.searchParams.get("scope");
    const scope =
      scopeParam === "arabic" || scopeParam === "turkish" ? scopeParam : "all";
    const surahParam = Number(url.searchParams.get("surahId"));
    const surahId =
      Number.isInteger(surahParam) && surahParam >= 1 && surahParam <= 114
        ? surahParam
        : undefined;

    if (!query) {
      return NextResponse.json({ results: [], totalMatches: 0, matchingRoots: [] });
    }

    const { results, totalMatches } = searchQuranVerses({
      query,
      scope,
      surahId,
      limit: 35,
    });
    const roots = getTopRoots({ query, page: 1, pageSize: 6 });

    return NextResponse.json({
      results,
      totalMatches,
      matchingRoots: roots.items,
    });
  } catch (error) {
    console.error("GET /api/search failed:", error);
    return NextResponse.json({ error: "Arama sırasında hata oluştu." }, { status: 500 });
  }
}
