import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ProblemStatementsAdminSection } from "@/components/dashboard/admin/sections/ProblemStatementsAdminSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ProblemStatementsRoute({ profile }: { profile: ProfileRow }) {
  const { problemStatements, problemStatementExtensions, teams, membersByTeam, rooms, zones, staffAccounts, config } =
    await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const isSuperAdmin = profile.role === "Super Admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isSpoc = profile.role === "SPOC";
  const hideZoneFilters = isSpoc || profile.role === "Zone Manager";
  // For everyone but Super Admin this is just their own fixed campus; for
  // Super Admin it's whichever module they're viewing (null = "All").
  const viewerCampus = profile.campus;

  return (
    <SectionPageShell title="Problem Statements" scope={scope} campus={profile.campus}>
      <ProblemStatementsAdminSection
        singleCampus={singleCampus}
        hideZoneFilters={hideZoneFilters}
        hideVenueFilter={isSpoc}
        hideSpocFilter={isSpoc}
        problemStatements={problemStatements}
        problemStatementExtensions={problemStatementExtensions}
        teams={teams}
        membersByTeam={membersByTeam}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        config={config}
        isSuperAdmin={isSuperAdmin}
        viewerCampus={viewerCampus}
      />
    </SectionPageShell>
  );
}
