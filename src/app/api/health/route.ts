import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getContentManifest, getQuranMeta } from "@/lib/content/canonical-loader";
import { getBackendConfigurationStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [backend, meta, manifest] = await Promise.all([
      getBackendConfigurationStatus(),
      Promise.resolve(getQuranMeta()),
      Promise.resolve(getContentManifest()),
    ]);

    const setupSqlExists = fs.existsSync(
      path.join(process.cwd(), "supabase", "setup_all.sql")
    );
    const seedSqlExists = fs.existsSync(
      path.join(process.cwd(), "supabase", "seed.sql")
    );

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      canonicalCorpus: {
        totalSurahs: meta.totalSurahs,
        totalPages: meta.totalPages,
        totalVerses: meta.totalVerses,
        totalWords: meta.totalWords,
        quranMetaSha256: manifest.datasets["quran-meta"]?.sha256 ?? null,
      },
      backend,
      deploymentReady: {
        localSqliteReady:
          backend.activePersistence === "sqlite_local" ||
          backend.activePersistence === "sqlite_ephemeral_tmp" ||
          backend.activePersistence === "supabase_postgres",
        supabaseSqlFilesReady: setupSqlExists && seedSqlExists,
        supabaseConfigured: backend.supabaseConfigured,
        asrProviderConfigured: backend.asrProviderConfigured,
        vercelOneClickUrl:
          "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmuratdo89%2Fquran-journey&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY",
      },
    });
  } catch (error) {
    console.error("GET /api/health failed:", error);
    return NextResponse.json(
      { ok: false, error: "Sistem sağlık kontrolü tamamlanamadı." },
      { status: 500 }
    );
  }
}
