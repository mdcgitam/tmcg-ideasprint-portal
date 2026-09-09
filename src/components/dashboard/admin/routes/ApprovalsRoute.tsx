import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ApprovalsSection } from "@/components/dashboard/admin/sections/ApprovalsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ApprovalsRoute({ profile }: { profile: ProfileRow }) {
  const { pendingApprovals, teams, membersByTeam, rooms, zones, staffAccounts } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Approvals" scope={scope} campus={profile.campus}>
      <ApprovalsSection
        pendingApprovals={pendingApprovals}
        teams={teams}
        membersByTeam={membersByTeam}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
      />
    </SectionPageShell>
  );
}
