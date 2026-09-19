import type { ProfileRow } from "@/types/database";
import { dashboardPathForRole } from "@/lib/auth/roles";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ScheduleSection } from "@/components/dashboard/ScheduleSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ScheduleRoute({ profile }: { profile: ProfileRow }) {
  const { config } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Schedule - Phase 1" scope={scope} campus={profile.campus} homeHref={dashboardPathForRole(profile.role)}>
      <ScheduleSection config={config} profile={profile} />
    </SectionPageShell>
  );
}
