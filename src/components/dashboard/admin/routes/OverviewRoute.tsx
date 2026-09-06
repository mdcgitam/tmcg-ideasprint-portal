import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { OverviewSection } from "@/components/dashboard/admin/sections/OverviewSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function OverviewRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { teams, membersByTeam, pendingApprovals, nocs, exitRequests } = await fetchAdminDashboardData(
    profile,
    roomId ? { roomId } : undefined,
  );
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

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
