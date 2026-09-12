import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { OverviewSection } from "@/components/dashboard/admin/sections/OverviewSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function OverviewRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, approvalRequests, nocs } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Overview" scope={scope} campus={profile.campus}>
      <OverviewSection
        scope={scope}
        teams={teams}
        membersByTeam={membersByTeam}
        pendingApprovals={approvalRequests.filter((a) => a.status === "Pending")}
        nocs={nocs}
      />
    </SectionPageShell>
  );
}
