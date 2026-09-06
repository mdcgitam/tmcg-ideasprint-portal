import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { NocSection } from "@/components/dashboard/admin/sections/NocSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function NocRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { teams, membersByTeam, nocs, rooms, zones, staffAccounts, problemStatements, exitRequests, config } =
    await fetchAdminDashboardData(profile, roomId ? { roomId } : undefined);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

  return (
    <SectionPageShell title="NOC" scope={scope}>
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
