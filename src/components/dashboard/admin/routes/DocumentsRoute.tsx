import type { ProfileRow } from "@/types/database";
import { dashboardPathForRole } from "@/lib/auth/roles";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { DocumentsSection } from "@/components/dashboard/DocumentsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function DocumentsRoute({ profile }: { profile: ProfileRow }) {
  const { config } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Documents" scope={scope} campus={profile.campus} homeHref={dashboardPathForRole(profile.role)}>
      <DocumentsSection config={config} campus={profile.campus} />
    </SectionPageShell>
  );
}
