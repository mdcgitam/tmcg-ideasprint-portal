import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { OverviewSection } from "@/components/dashboard/admin/sections/OverviewSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";
import { ZoneVenueTabs } from "@/components/dashboard/zone/ZoneVenueTabs";

export async function OverviewRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { teams, membersByTeam, pendingApprovals, nocs, exitRequests, rooms } = await fetchAdminDashboardData(
    profile,
    roomId ? { roomId } : undefined,
  );
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const venueTabs =
    profile.role === "Zone Manager" ? (
      <ZoneVenueTabs rooms={[...rooms].map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name))} />
    ) : undefined;

  return (
    <SectionPageShell title="Overview" scope={scope} headerExtra={venueTabs}>
      <OverviewSection
        scope={scope}
        teams={teams}
        membersByTeam={membersByTeam}
        pendingApprovals={pendingApprovals}
        nocs={nocs}
        exitRequests={exitRequests}
      />
    </SectionPageShell>
  );
}
