import type { ProfileRow } from "@/types/database";
import { dashboardPathForRole } from "@/lib/auth/roles";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ConfigurationSection } from "@/components/dashboard/admin/sections/ConfigurationSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ConfigurationRoute({ profile }: { profile: ProfileRow }) {
  const { config } = await fetchAdminDashboardData(profile);

  return (
    <SectionPageShell title="Configuration" scope="admin" campus={profile.campus} homeHref={dashboardPathForRole(profile.role)}>
      <ConfigurationSection config={config} profile={profile} />
    </SectionPageShell>
  );
}
