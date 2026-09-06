import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminNotificationsSection } from "@/components/dashboard/admin/sections/AdminNotificationsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function NotificationsRoute({ profile }: { profile: ProfileRow }) {
  const { notifications, rooms } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Notifications" scope={scope}>
      <AdminNotificationsSection profileId={profile.id} notifications={notifications} scope={scope} rooms={rooms} />
    </SectionPageShell>
  );
}
