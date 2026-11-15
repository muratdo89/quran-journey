import { cookies } from "next/headers";
import { SqliteProgressRepository } from "./sqlite-repository";
import { PREFS_COOKIE, parsePrefsCookie } from "./prefs-cookie";
import {
  getSupabaseSessionFromCookies,
  isSupabaseConfigured,
} from "./supabase-auth";
import { SupabaseProgressRepository } from "./supabase-repository";
import type { BackendConfigurationStatus, ProgressRepository } from "./types";

let singletonSqlite: SqliteProgressRepository | null = null;

function getSqliteSingleton(): SqliteProgressRepository {
  if (!singletonSqlite) {
    singletonSqlite = new SqliteProgressRepository();
  }
  return singletonSqlite;
}

export async function getRepository(): Promise<ProgressRepository> {
  const session = await getSupabaseSessionFromCookies();
  if (session) {
    return new SupabaseProgressRepository(session.accessToken, session.userId);
  }
  const sqlite = getSqliteSingleton();
  await restorePrefsFromCookie(sqlite);
  return sqlite;
}

/**
 * Without Supabase, Vercel runs a temporary SQLite file per serverless instance, so a new
 * instance forgets the chosen reciter, page and reader settings. The preferences route mirrors
 * every saved setting into a cookie; replay it here so the choice survives instance changes.
 */
let lastAppliedPrefsCookie: string | null = null;
async function restorePrefsFromCookie(repo: SqliteProgressRepository) {
  let raw: string | undefined;
  try {
    raw = (await cookies()).get(PREFS_COOKIE)?.value;
  } catch {
    return; // called outside a request (build, tests)
  }
  if (!raw || raw === lastAppliedPrefsCookie) return;
  const prefs = parsePrefsCookie(raw);
  if (!prefs) return;
  try {
    await repo.updatePreferences(prefs);
    lastAppliedPrefsCookie = raw;
  } catch {
    /* keep serving with database defaults */
  }
}

export async function getBackendConfigurationStatus(): Promise<BackendConfigurationStatus> {
  const supabaseConfigured = isSupabaseConfigured();
  const session = await getSupabaseSessionFromCookies();
  const sqlite = getSqliteSingleton();

  const qfConfigured = Boolean(
    process.env.QF_CLIENT_ID && process.env.QF_CLIENT_SECRET
  );
  // HybridQuranAsrProvider always enables client Web Speech + Arabic Levenshtein sequence checks,
  // optionally backed by QURAN_ASR_API_URL when configured.
  const asrConfigured = true;

  const activePersistence: BackendConfigurationStatus["activePersistence"] = session
    ? "supabase_postgres"
    : sqlite.isEphemeralTmp
      ? "sqlite_ephemeral_tmp"
      : "sqlite_local";

  return {
    activePersistence,
    supabaseConfigured,
    supabaseAuthenticatedUserEmail: session?.email ?? null,
    quranFoundationOAuthConfigured: qfConfigured,
    asrProviderConfigured: asrConfigured,
    sqlitePath: session ? null : sqlite.dbPath,
  };
}

export * from "./types";
