import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { RoomsZonesSection } from "@/components/dashboard/admin/sections/RoomsZonesSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function RoomsZonesRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, rooms, zones, spocs, staffAccounts } = await fetchAdminDashboardData(profile);

  return (
    <SectionPageShell title="Rooms & Zones" scope="admin">
      <RoomsZonesSection
        teams={teams}
        membersByTeam={membersByTeam}
        rooms={rooms}
        zones={zones}
        spocs={spocs}
        staffAccounts={staffAccounts}
      />
    </SectionPageShell>
  );
}
