import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { PptSection } from "@/components/dashboard/admin/sections/PptSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function PptRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, presentations } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "Super Admin" ? "admin" : "spoc";

  return (
    <SectionPageShell title="PPT" scope={scope}>
      <PptSection teams={teams} membersByTeam={membersByTeam} presentations={presentations} scope={scope} />
    </SectionPageShell>
  );
}
