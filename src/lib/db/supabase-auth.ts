import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const SB_ACCESS_COOKIE = "qj_sb_access_token";
export const SB_REFRESH_COOKIE = "qj_sb_refresh_token";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createAnonSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getSupabaseSessionFromCookies(): Promise<{
  accessToken: string;
  userId: string;
  email: string | null;
} | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(SB_ACCESS_COOKIE)?.value;
    const refreshToken = cookieStore.get(SB_REFRESH_COOKIE)?.value;
    if (!accessToken && !refreshToken) return null;

    const client = createAnonSupabaseClient();
    if (!client) return null;

    if (accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (!error && data.user) {
        return {
          accessToken,
          userId: data.user.id,
          email: data.user.email ?? null,
        };
      }
    }

    if (refreshToken) {
      const { data: refreshed, error: refreshError } = await client.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (!refreshError && refreshed.session && refreshed.user) {
        return {
          accessToken: refreshed.session.access_token,
          userId: refreshed.user.id,
          email: refreshed.user.email ?? null,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}
