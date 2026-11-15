import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseDotEnv(content) {
  const vars = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

export function runCloudEnvSetup(
  rootDir = process.cwd(),
  options = { createEnvIfMissing: true }
) {
  const envExamplePath = path.join(rootDir, ".env.example");
  const envLocalPath = path.join(rootDir, ".env.local");
  const setupSqlPath = path.join(rootDir, "supabase", "setup_all.sql");
  const seedSqlPath = path.join(rootDir, "supabase", "seed.sql");

  let createdEnvLocal = false;
  if (
    options.createEnvIfMissing &&
    !fs.existsSync(envLocalPath) &&
    fs.existsSync(envExamplePath)
  ) {
    fs.copyFileSync(envExamplePath, envLocalPath);
    createdEnvLocal = true;
  }

  const fileEnv = fs.existsSync(envLocalPath)
    ? parseDotEnv(fs.readFileSync(envLocalPath, "utf8"))
    : {};

  const getEnv = (key) => (process.env[key] || fileEnv[key] || "").trim();

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const asrApiUrl = getEnv("QURAN_ASR_API_URL");

  const setupSqlStats = fs.existsSync(setupSqlPath)
    ? fs.statSync(setupSqlPath)
    : null;
  const seedSqlStats = fs.existsSync(seedSqlPath)
    ? fs.statSync(seedSqlPath)
    : null;

  return {
    envLocalExists: fs.existsSync(envLocalPath),
    createdEnvLocal,
    envLocalPath,
    supabaseFiles: {
      setupAllExists: Boolean(setupSqlStats),
      setupAllBytes: setupSqlStats?.size ?? 0,
      seedExists: Boolean(seedSqlStats),
      seedBytes: seedSqlStats?.size ?? 0,
    },
    envVars: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(supabaseUrl),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(supabaseAnonKey),
      QURAN_ASR_API_URL: Boolean(asrApiUrl),
    },
    mode:
      Boolean(supabaseUrl) && Boolean(supabaseAnonKey)
        ? "supabase_cloud_ready"
        : "local_sqlite_ready",
  };
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const report = runCloudEnvSetup(process.cwd(), { createEnvIfMissing: true });
  console.log("=== Quran Journey — Bulut ve Ortam Hazırlık Raporu ===");
  console.log(
    `.env.local: ${report.envLocalExists ? "Mevcut" : "Yok"}${
      report.createdEnvLocal ? " (.env.example şablonundan yeni oluşturuldu)" : ""
    }`
  );
  console.log(
    `supabase/setup_all.sql: ${
      report.supabaseFiles.setupAllExists
        ? `Hazır (${report.supabaseFiles.setupAllBytes} bayt)`
        : "Eksik"
    }`
  );
  console.log(
    `supabase/seed.sql: ${
      report.supabaseFiles.seedExists
        ? `Hazır (${report.supabaseFiles.seedBytes} bayt)`
        : "Eksik"
    }`
  );
  console.log(
    `NEXT_PUBLIC_SUPABASE_URL: ${
      report.envVars.NEXT_PUBLIC_SUPABASE_URL ? "Tanımlı" : "Boş (Yerel SQLite aktif)"
    }`
  );
  console.log(
    `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${
      report.envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Tanımlı" : "Boş (Yerel SQLite aktif)"
    }`
  );
  console.log(
    `QURAN_ASR_API_URL: ${
      report.envVars.QURAN_ASR_API_URL ? "Tanımlı" : "Boş (Yerel karşılaştırma modu)"
    }`
  );
  console.log(
    `Aktif Çalışma Modu: ${
      report.mode === "supabase_cloud_ready"
        ? "Supabase Bulut + Auth Hazır"
        : "Yerel SQLite Hazır (Bulut için .env.local veya Vercel ortam değişkenlerini doldurun)"
    }`
  );
}
