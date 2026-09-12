import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { NocSection } from "@/components/dashboard/admin/sections/NocSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function NocRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, nocs, rooms, zones, staffAccounts, problemStatements, config } =
    await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isSpoc = profile.role === "SPOC";
  const hideZoneFilters = isSpoc || profile.role === "Zone Manager";
  // A no-show team never uploaded anything and isn't going to — drop it
  // from view here; still visible (and reversible) in Rooms and Venues or
  // the Profile module.
  const activeTeams = teams.filter((t) => t.is_active);

  return (
    <SectionPageShell title="NOC" scope={scope} campus={profile.campus}>
      <NocSection
        singleCampus={singleCampus}
        hideZoneFilters={hideZoneFilters}
        hideVenueFilter={isSpoc}
        hideSpocFilter={isSpoc}
        teams={activeTeams}
        membersByTeam={membersByTeam}
        nocs={nocs}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        problemStatements={problemStatements}
        config={config}
        scope={scope}
      />
    </SectionPageShell>
  );
}
