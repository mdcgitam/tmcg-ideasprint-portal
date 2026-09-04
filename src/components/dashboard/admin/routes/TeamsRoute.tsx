import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { TeamsPage } from "@/components/dashboard/admin/sections/TeamsPage";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function TeamsRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, nocs, exitRequests, attendance, attendanceSessions, staffAccounts, rooms, zones, problemStatements } =
    await fetchAdminDashboardData(profile);
  const scope = profile.role === "Super Admin" ? "admin" : "spoc";

  return (
    <SectionPageShell title="Teams" scope={scope}>
      <TeamsPage
        teams={teams}
        membersByTeam={membersByTeam}
        nocs={nocs}
        exitRequests={exitRequests}
        attendance={attendance}
        attendanceSessions={attendanceSessions}
        scope={scope}
        staffAccounts={staffAccounts}
        rooms={rooms}
        zones={zones}
        problemStatements={problemStatements}
      />
    </SectionPageShell>
  );
}
