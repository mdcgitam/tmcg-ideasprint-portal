import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ProblemStatementsAdminSection } from "@/components/dashboard/admin/sections/ProblemStatementsAdminSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";
import { ZoneVenueTabs } from "@/components/dashboard/zone/ZoneVenueTabs";

export async function ProblemStatementsRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { problemStatements, problemStatementExtensions, teams, membersByTeam, rooms, zones, staffAccounts, config } =
    await fetchAdminDashboardData(profile, roomId ? { roomId } : undefined);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const canManage = profile.role === "Super Admin" || profile.role === "Campus Admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isZoneManager = profile.role === "Zone Manager";
  const venueTabs = isZoneManager ? (
    <ZoneVenueTabs rooms={[...rooms].map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name))} />
  ) : undefined;

  return (
    <SectionPageShell title="Problem Statements" scope={scope} campus={profile.campus} headerExtra={venueTabs}>
      <ProblemStatementsAdminSection
        singleCampus={singleCampus}
        hideVenue={isZoneManager}
        problemStatements={problemStatements}
        problemStatementExtensions={problemStatementExtensions}
        teams={teams}
        membersByTeam={membersByTeam}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        config={config}
        canManage={canManage}
      />
    </SectionPageShell>
  );
}
