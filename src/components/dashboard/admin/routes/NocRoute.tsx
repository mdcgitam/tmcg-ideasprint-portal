import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { NocSection } from "@/components/dashboard/admin/sections/NocSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function NocRoute({ profile }: { profile: ProfileRow }) {
  const {
    teams,
    membersByTeam,
    nocs,
    attendance,
    attendanceSessions,
    rooms,
    zones,
    staffAccounts,
    problemStatements,
    exitRequests,
  } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "Super Admin" ? "admin" : "spoc";

  return (
    <SectionPageShell title="NOC" scope={scope}>
      <NocSection
        teams={teams}
        membersByTeam={membersByTeam}
        nocs={nocs}
        attendance={attendance}
        attendanceSessions={attendanceSessions}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        problemStatements={problemStatements}
        exitRequests={exitRequests}
        scope={scope}
      />
    </SectionPageShell>
  );
}
