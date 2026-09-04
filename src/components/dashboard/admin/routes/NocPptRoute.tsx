import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { NocPptSection } from "@/components/dashboard/admin/sections/NocPptSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function NocPptRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, nocs, presentations } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "Super Admin" ? "admin" : "spoc";

  return (
    <SectionPageShell title="NOC & PPT" scope={scope}>
      <NocPptSection teams={teams} membersByTeam={membersByTeam} nocs={nocs} presentations={presentations} scope={scope} />
    </SectionPageShell>
  );
}
