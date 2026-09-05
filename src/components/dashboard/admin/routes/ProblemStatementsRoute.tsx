import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ProblemStatementsAdminSection } from "@/components/dashboard/admin/sections/ProblemStatementsAdminSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ProblemStatementsRoute({ profile }: { profile: ProfileRow }) {
  const { problemStatements, problemStatementExtensions, teams, membersByTeam, rooms, zones, staffAccounts, config } =
    await fetchAdminDashboardData(profile);

  return (
    <SectionPageShell title="Problem Statements" scope="admin">
      <ProblemStatementsAdminSection
        problemStatements={problemStatements}
        problemStatementExtensions={problemStatementExtensions}
        teams={teams}
        membersByTeam={membersByTeam}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        config={config}
      />
    </SectionPageShell>
  );
}
