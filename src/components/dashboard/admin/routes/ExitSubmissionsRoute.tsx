import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ExitSubmissionsSection } from "@/components/dashboard/admin/sections/ExitSubmissionsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ExitSubmissionsRoute({ profile }: { profile: ProfileRow }) {
  const { exitRequests, teams, membersByTeam, rooms, zones, staffAccounts } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isSpoc = profile.role === "SPOC";
  const hideZoneFilters = isSpoc || profile.role === "Zone Manager";

  return (
    <SectionPageShell title="Exit Form Submissions" scope={scope} campus={profile.campus}>
      <ExitSubmissionsSection
        teams={teams}
        membersByTeam={membersByTeam}
        exitRequests={exitRequests}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        singleCampus={singleCampus}
        hideZoneFilters={hideZoneFilters}
        hideVenueFilter={isSpoc}
        hideSpocFilter={isSpoc}
      />
    </SectionPageShell>
  );
}
