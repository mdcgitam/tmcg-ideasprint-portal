import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { IdCardsSection } from "@/components/dashboard/admin/sections/IdCardsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function IdCardsRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, idCardCertRecords, staffAccounts, spocs, rooms, zones } =
    await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isSpoc = profile.role === "SPOC";
  const hideZoneFilters = isSpoc || profile.role === "Zone Manager";

  return (
    <SectionPageShell title="ID Cards & Certificates" scope={scope} campus={profile.campus}>
      <IdCardsSection
        singleCampus={singleCampus}
        hideZoneFilters={hideZoneFilters}
        hideVenueFilter={isSpoc}
        hideSpocFilter={isSpoc}
        teams={teams}
        membersByTeam={membersByTeam}
        records={idCardCertRecords}
        scope={scope}
        staffAccounts={staffAccounts}
        spocs={spocs}
        rooms={rooms}
        zones={zones}
      />
    </SectionPageShell>
  );
}
