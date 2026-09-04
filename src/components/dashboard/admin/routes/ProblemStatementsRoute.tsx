import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ProblemStatementsAdminSection } from "@/components/dashboard/admin/sections/ProblemStatementsAdminSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ProblemStatementsRoute({ profile }: { profile: ProfileRow }) {
  const { problemStatements, teams } = await fetchAdminDashboardData(profile);

  return (
    <SectionPageShell title="Problem Statements" scope="admin">
      <ProblemStatementsAdminSection problemStatements={problemStatements} teams={teams} />
    </SectionPageShell>
  );
}
