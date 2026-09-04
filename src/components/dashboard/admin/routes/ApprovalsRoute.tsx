import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ApprovalsSection } from "@/components/dashboard/admin/sections/ApprovalsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ApprovalsRoute({ profile }: { profile: ProfileRow }) {
  const { pendingApprovals, exitRequests, teams, membersByTeam } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "Super Admin" ? "admin" : "spoc";

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
