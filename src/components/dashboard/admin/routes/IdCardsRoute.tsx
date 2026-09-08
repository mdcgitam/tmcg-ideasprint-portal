import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { IdCardsSection } from "@/components/dashboard/admin/sections/IdCardsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";
import { ZoneVenueTabs } from "@/components/dashboard/zone/ZoneVenueTabs";

export async function IdCardsRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { teams, membersByTeam, idCardCertRecords, staffAccounts, spocs, rooms, zones } = await fetchAdminDashboardData(
    profile,
    roomId ? { roomId } : undefined,
  );
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isZoneManager = profile.role === "Zone Manager";
  const venueTabs = isZoneManager ? (
    <ZoneVenueTabs rooms={[...rooms].map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name))} />
  ) : undefined;

  return (
    <SectionPageShell title="ID Cards & Certificates" scope={scope} campus={profile.campus} headerExtra={venueTabs}>
      <IdCardsSection
        singleCampus={singleCampus}
        hideVenue={isZoneManager}
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
