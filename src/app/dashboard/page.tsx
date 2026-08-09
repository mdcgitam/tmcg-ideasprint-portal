import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { dashboardPathForRole } from "@/lib/auth/roles";

/** No intermediate landing page (SPEC §18) — routes straight to the role's dashboard. */
export default async function DashboardIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  redirect(dashboardPathForRole(profile.role));
}
