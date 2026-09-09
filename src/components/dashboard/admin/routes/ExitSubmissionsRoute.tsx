import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ExitSubmissionsSection } from "@/components/dashboard/admin/sections/ExitSubmissionsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ExitSubmissionsRoute({ profile }: { profile: ProfileRow }) {
  const { exitRequests, teams, membersByTeam, rooms, zones, staffAccounts } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Exit Form Submissions" scope={scope} campus={profile.campus}>
      <ExitSubmissionsSection
        exitRequests={exitRequests}
        teams={teams}
        membersByTeam={membersByTeam}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
      />
    </SectionPageShell>
  );
}
