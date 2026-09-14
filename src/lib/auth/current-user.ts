import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/database";

/**
 * Reads the logged-in user's own profile row via the session-scoped server
 * client — relies on the `profiles_select` RLS policy (self OR teammate OR
 * assigned-SPOC's participant OR Super Admin), so this only ever returns a
 * caller's own row here, not an arbitrary lookup.
 *
 * Uses getSession() (reads the cookie, no network call) rather than
 * getUser() (a Supabase Auth network round-trip) — every caller of this
 * function sits behind src/proxy.ts, which already called getUser() once
 * for this exact request and redirected unauthenticated ones to /login.
 * Re-verifying over the network here would just be a second round-trip for
 * the same answer.
 */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("auth_user_id", user.id).maybeSingle();

  if (error || !data) return null;
  return data as ProfileRow;
}
