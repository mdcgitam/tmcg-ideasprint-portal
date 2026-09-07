import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ExitSubmissionsSection } from "@/components/dashboard/admin/sections/ExitSubmissionsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";
import { ZoneVenueTabs } from "@/components/dashboard/zone/ZoneVenueTabs";

export async function ExitSubmissionsRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { exitRequests, teams, membersByTeam, rooms, zones, staffAccounts } = await fetchAdminDashboardData(
    profile,
    roomId ? { roomId } : undefined,
  );
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const venueTabs =
    profile.role === "Zone Manager" ? (
      <ZoneVenueTabs rooms={[...rooms].map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name))} />
    ) : undefined;

  return (
    <SectionPageShell title="Exit Form Submissions" scope={scope} campus={profile.campus} headerExtra={venueTabs}>
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
