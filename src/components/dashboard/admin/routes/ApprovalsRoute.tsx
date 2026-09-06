import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ApprovalsSection } from "@/components/dashboard/admin/sections/ApprovalsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ApprovalsRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { pendingApprovals, exitRequests, teams, membersByTeam } = await fetchAdminDashboardData(
    profile,
    roomId ? { roomId } : undefined,
  );
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Approvals" scope={scope}>
      <ApprovalsSection
        pendingApprovals={pendingApprovals}
        exitRequests={exitRequests}
        teams={teams}
        membersByTeam={membersByTeam}
      />
    </SectionPageShell>
  );
}
