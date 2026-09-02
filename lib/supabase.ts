import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

let dashboardClient: SupabaseClient | null = null;
let tokenClient: SupabaseClient | null = null;

/**
 * Server-only client for the dedicated IES dashboard project
 * (holds the ies_* tables). Service-role key — never import client-side.
 */
export function supabaseDashboard(): SupabaseClient {
  if (dashboardClient) return dashboardClient;
  const url = process.env.DASHBOARD_SUPABASE_URL;
  const key = process.env.DASHBOARD_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing DASHBOARD_SUPABASE_URL / DASHBOARD_SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }
  dashboardClient = createClient(url, key, opts);
  return dashboardClient;
}

/**
 * Server-only client for the shared "GHL Token" project — used ONLY to read
 * the agency OAuth token. No dashboard data lives here.
 */
export function supabaseToken(): SupabaseClient {
  if (tokenClient) return tokenClient;
  const url = process.env.TOKEN_SUPABASE_URL;
  const key = process.env.TOKEN_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing TOKEN_SUPABASE_URL / TOKEN_SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }
  tokenClient = createClient(url, key, opts);
  return tokenClient;
}
