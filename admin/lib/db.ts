import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* 直连 Supabase（service key，绕 RLS）。仅 server actions / route handlers 使用。 */
let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY missing (root .env.local)");
  }
  client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
