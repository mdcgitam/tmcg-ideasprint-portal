import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ApprovalsSection } from "@/components/dashboard/admin/sections/ApprovalsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";
import { ZoneVenueTabs } from "@/components/dashboard/zone/ZoneVenueTabs";

export async function ApprovalsRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { pendingApprovals, exitRequests, teams, membersByTeam, rooms } = await fetchAdminDashboardData(
    profile,
    roomId ? { roomId } : undefined,
  );
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const venueTabs =
    profile.role === "Zone Manager" ? (
      <ZoneVenueTabs rooms={[...rooms].map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name))} />
    ) : undefined;

  return (
    <SectionPageShell title="Approvals" scope={scope} headerExtra={venueTabs}>
      <ApprovalsSection
        pendingApprovals={pendingApprovals}
        exitRequests={exitRequests}
        teams={teams}
        membersByTeam={membersByTeam}
      />
    </SectionPageShell>
  );
}
