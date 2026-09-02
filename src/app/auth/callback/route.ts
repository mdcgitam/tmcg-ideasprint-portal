import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { dashboardPathForRole } from "@/lib/auth/roles";
import type { ProfileRow } from "@/types/database";

// SPEC.md §12/16-17: Google Auth is restricted to university accounts only —
// the OAuth provider itself doesn't enforce this, so it's re-checked here,
// server-side, right after the session is created.
const ALLOWED_DOMAIN_PATTERN = /@(student\.gitam\.edu|gitam\.in)$/i;

// Testing/demo accounts only — bypasses the university-domain rule for these
// specific addresses. Remove entries (or this whole set) once no longer needed.
const DOMAIN_EXCEPTION_EMAILS = new Set(["switchone06@gmail.com"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !exchangeData.session) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const email = exchangeData.session.user.email?.toLowerCase() ?? "";

  if (!ALLOWED_DOMAIN_PATTERN.test(email) && !DOMAIN_EXCEPTION_EMAILS.has(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain_not_allowed`);
  }

  // Registration happens before any auth session exists (SPEC §16-17), so
  // the profile row already exists by the time someone reaches this point —
  // look it up with the service client since an unlinked profile's RLS
  // wouldn't otherwise be visible to this brand-new session.
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("*").eq("gitam_email", email).maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_registered`);
  }

  const profileRow = profile as ProfileRow;

  if (!profileRow.auth_user_id) {
    await service.from("profiles").update({ auth_user_id: exchangeData.session.user.id }).eq("id", profileRow.id);
  }

  return NextResponse.redirect(`${origin}${dashboardPathForRole(profileRow.role)}`);
}
