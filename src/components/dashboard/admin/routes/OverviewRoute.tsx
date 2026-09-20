import type { ProfileRow } from "@/types/database";
import { dashboardPathForRole } from "@/lib/auth/roles";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { OverviewSection } from "@/components/dashboard/admin/sections/OverviewSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function OverviewRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, approvalRequests, exitRequests, nocs, rooms, zones, staffAccounts, spocs, problemStatements } =
    await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  // Only the Super Admin's "All" view ever mixes more than one campus's data -
  // every other viewer (Campus Admin/SPOC/Zone Manager, or a Super Admin who's
  // picked one campus module) already gets pre-scoped data from
  // fetchAdminDashboardData, so a Campus filter would have nothing to narrow.
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;

  return (
    <SectionPageShell title="Overview" scope={scope} campus={profile.campus} homeHref={dashboardPathForRole(profile.role)}>
      <OverviewSection
        scope={scope}
        teams={teams}
        membersByTeam={membersByTeam}
        pendingApprovals={approvalRequests.filter((a) => a.status === "Pending")}
        pendingExitRequests={exitRequests.filter((r) => r.status === "Requested")}
        nocs={nocs}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        spocs={spocs}
        problemStatements={problemStatements}
        singleCampus={singleCampus}
      />
    </SectionPageShell>
  );
}
