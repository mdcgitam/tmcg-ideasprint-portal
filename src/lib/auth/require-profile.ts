import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { dashboardPathForRole } from "@/lib/auth/roles";
import type { ProfileRow, UserRole } from "@/types/database";

/**
 * Gate for the per-section dashboard routes: redirects to /login if signed
 * out, or to the caller's own dashboard if their role isn't in the allowed
 * set. Collapses the getCurrentProfile()+redirect boilerplate that used to
 * be duplicated per-page into one call.
 */
export async function requireProfile(allowedRoles: UserRole[]): Promise<ProfileRow> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!allowedRoles.includes(profile.role)) redirect(dashboardPathForRole(profile.role));
  return profile;
}
