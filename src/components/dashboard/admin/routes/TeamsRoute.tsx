import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { TeamsPage } from "@/components/dashboard/admin/sections/TeamsPage";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function TeamsRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, nocs, exitRequests, staffAccounts, rooms, zones, problemStatements } =
    await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Profile" scope={scope}>
      <TeamsPage
        teams={teams}
        membersByTeam={membersByTeam}
        nocs={nocs}
        exitRequests={exitRequests}
        scope={scope}
        staffAccounts={staffAccounts}
        rooms={rooms}
        zones={zones}
        problemStatements={problemStatements}
      />
    </SectionPageShell>
  );
}
