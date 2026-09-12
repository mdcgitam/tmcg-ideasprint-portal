import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { PptSection } from "@/components/dashboard/admin/sections/PptSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function PptRoute({ profile }: { profile: ProfileRow }) {
  const {
    teams,
    membersByTeam,
    presentations,
    rooms,
    zones,
    staffAccounts,
    problemStatements,
    config,
  } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isSpoc = profile.role === "SPOC";
  const hideZoneFilters = isSpoc || profile.role === "Zone Manager";
  // A no-show team never uploaded anything and isn't going to — drop it
  // from view here; still visible (and reversible) in Rooms and Venues or
  // the Profile module.
  const activeTeams = teams.filter((t) => t.is_active);

  return (
    <SectionPageShell title="PPT" scope={scope} campus={profile.campus}>
      <PptSection
        singleCampus={singleCampus}
        hideZoneFilters={hideZoneFilters}
        hideVenueFilter={isSpoc}
        hideSpocFilter={isSpoc}
        teams={activeTeams}
        membersByTeam={membersByTeam}
        presentations={presentations}
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
