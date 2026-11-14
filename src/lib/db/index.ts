import { SqliteProgressRepository } from "./sqlite-repository";
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
  return getSqliteSingleton();
}

export async function getBackendConfigurationStatus(): Promise<BackendConfigurationStatus> {
  const supabaseConfigured = isSupabaseConfigured();
  const session = await getSupabaseSessionFromCookies();
  const sqlite = getSqliteSingleton();

  const qfConfigured = Boolean(
    process.env.QF_CLIENT_ID && process.env.QF_CLIENT_SECRET
  );
  const asrConfigured = Boolean(
    process.env.QURAN_ASR_API_URL || process.env.OPENAI_API_KEY
  );

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
