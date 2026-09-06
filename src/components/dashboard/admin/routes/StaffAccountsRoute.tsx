import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { StaffAccountsSection } from "@/components/dashboard/admin/sections/StaffAccountsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function StaffAccountsRoute({ profile }: { profile: ProfileRow }) {
  const { staffAccounts, rooms, zones } = await fetchAdminDashboardData(profile);
  const isSuperAdmin = profile.role === "Super Admin";

  return (
    <SectionPageShell title="Staff Accounts" scope="admin" campus={profile.campus}>
      <StaffAccountsSection
        campus={profile.campus}
        canManageCampusAdmins={isSuperAdmin}
        staffAccounts={staffAccounts}
        rooms={rooms}
        zones={zones}
      />
    </SectionPageShell>
  );
}
