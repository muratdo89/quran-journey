import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";
import { buildHifzPageData } from "@/lib/hifz/page-data";

export async function GET(req: Request) {
  const page = Number(new URL(req.url).searchParams.get("page"));
  if (!Number.isInteger(page) || page < 1 || page > 604) {
    return NextResponse.json({ error: "Geçersiz sayfa numarası." }, { status: 400 });
  }
  try {
    const repo = await getRepository();
    const snapshot = await repo.getDashboardSnapshot();
    return NextResponse.json(buildHifzPageData(page, snapshot.preferences.preferredReciterId));
  } catch (error) {
    console.error("GET /api/hifz/page failed:", error);
    return NextResponse.json({ error: "Sayfa yüklenemedi." }, { status: 500 });
  }
}
