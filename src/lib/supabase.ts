import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnvironment } from "./env.js";

let supabaseClient: SupabaseClient | undefined;

/** Creates one server-only Supabase client after validating its configuration. */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } = getSupabaseEnvironment();

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
  }

  return supabaseClient;
}
