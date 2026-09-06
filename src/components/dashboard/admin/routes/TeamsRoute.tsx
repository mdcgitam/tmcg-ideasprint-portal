import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { TeamsPage } from "@/components/dashboard/admin/sections/TeamsPage";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";
import { ZoneVenueTabs } from "@/components/dashboard/zone/ZoneVenueTabs";

export async function TeamsRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { teams, membersByTeam, nocs, exitRequests, staffAccounts, rooms, zones, problemStatements } =
    await fetchAdminDashboardData(profile, roomId ? { roomId } : undefined);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isZoneManager = profile.role === "Zone Manager";
  const venueTabs = isZoneManager ? (
    <ZoneVenueTabs rooms={[...rooms].map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name))} />
  ) : undefined;

  return (
    <SectionPageShell title="Profile" scope={scope} headerExtra={venueTabs}>
      <TeamsPage
        teams={teams}
        membersByTeam={membersByTeam}
        nocs={nocs}
        exitRequests={exitRequests}
        scope={scope}
        staffAccounts={staffAccounts}
        rooms={rooms}
        zones={zones}
        problemStatements={problemStatements}
        singleCampus={singleCampus}
        hideVenue={isZoneManager}
      />
    </SectionPageShell>
  );
}
