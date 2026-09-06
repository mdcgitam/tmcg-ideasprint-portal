import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { OverviewSection } from "@/components/dashboard/admin/sections/OverviewSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function OverviewRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, pendingApprovals, nocs, exitRequests } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Overview" scope={scope}>
      <OverviewSection
        scope={scope}
        teams={teams}
        membersByTeam={membersByTeam}
        pendingApprovals={pendingApprovals}
        nocs={nocs}
        exitRequests={exitRequests}
      />
    </SectionPageShell>
  );
}
