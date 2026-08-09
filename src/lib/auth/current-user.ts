import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/database";

/**
 * Reads the logged-in user's own profile row via the session-scoped server
 * client — relies on the `profiles_select` RLS policy (self OR teammate OR
 * assigned-SPOC's participant OR Super Admin), so this only ever returns a
 * caller's own row here, not an arbitrary lookup.
 */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("auth_user_id", user.id).maybeSingle();

  if (error || !data) return null;
  return data as ProfileRow;
}
