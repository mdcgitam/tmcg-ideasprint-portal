import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ApprovalsSection } from "@/components/dashboard/admin/sections/ApprovalsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ApprovalsRoute({ profile }: { profile: ProfileRow }) {
  const { approvalRequests, teams, membersByTeam, staffAccounts } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;

  return (
    <SectionPageShell title="Profile Requests" scope={scope} campus={profile.campus}>
      <ApprovalsSection
        approvalRequests={approvalRequests}
        teams={teams}
        membersByTeam={membersByTeam}
        staffAccounts={staffAccounts}
        singleCampus={singleCampus}
      />
    </SectionPageShell>
  );
}
