import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Only for the small set of
 * pre-auth operations that legitimately need to (team registration, the
 * auth callback's profile lookup/link) — never import this into anything
 * that renders per-user data, since it ignores every RLS policy in
 * supabase/migrations/0001_init_schema.sql. The `server-only` import makes
 * an accidental client-bundle inclusion a build error, not a leaked key.
 *
 * Untyped (no <Database> generic) — see the comment in ./client.ts for why.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
