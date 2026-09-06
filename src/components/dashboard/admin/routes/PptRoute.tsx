import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { PptSection } from "@/components/dashboard/admin/sections/PptSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";
import { ZoneVenueTabs } from "@/components/dashboard/zone/ZoneVenueTabs";

export async function PptRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const {
    teams,
    membersByTeam,
    presentations,
    rooms,
    zones,
    staffAccounts,
    problemStatements,
    config,
  } = await fetchAdminDashboardData(profile, roomId ? { roomId } : undefined);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isZoneManager = profile.role === "Zone Manager";
  const venueTabs = isZoneManager ? (
    <ZoneVenueTabs rooms={[...rooms].map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name))} />
  ) : undefined;

  return (
    <SectionPageShell title="PPT" scope={scope} headerExtra={venueTabs}>
      <PptSection
        singleCampus={singleCampus}
        hideVenue={isZoneManager}
        teams={teams}
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
