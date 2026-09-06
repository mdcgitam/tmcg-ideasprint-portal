import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { NocSection } from "@/components/dashboard/admin/sections/NocSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";
import { ZoneVenueTabs } from "@/components/dashboard/zone/ZoneVenueTabs";

export async function NocRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { teams, membersByTeam, nocs, rooms, zones, staffAccounts, problemStatements, exitRequests, config } =
    await fetchAdminDashboardData(profile, roomId ? { roomId } : undefined);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const venueTabs =
    profile.role === "Zone Manager" ? (
      <ZoneVenueTabs rooms={[...rooms].map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name))} />
    ) : undefined;

  return (
    <SectionPageShell title="NOC" scope={scope} headerExtra={venueTabs}>
      <NocSection
        teams={teams}
        membersByTeam={membersByTeam}
        nocs={nocs}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        problemStatements={problemStatements}
        exitRequests={exitRequests}
        config={config}
        scope={scope}
      />
    </SectionPageShell>
  );
}
