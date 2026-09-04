import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { OverviewSection } from "@/components/dashboard/admin/sections/OverviewSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function OverviewRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, pendingApprovals, nocs, exitForms } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "Super Admin" ? "admin" : "spoc";

  return (
    <SectionPageShell title="Overview" scope={scope}>
      <OverviewSection
        scope={scope}
        teams={teams}
        membersByTeam={membersByTeam}
        pendingApprovals={pendingApprovals}
        nocs={nocs}
        exitForms={exitForms}
      />
    </SectionPageShell>
  );
}
