import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminNotificationsSection } from "@/components/dashboard/admin/sections/AdminNotificationsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

// No venue tab bar here — notifications aren't venue-scoped data; the
// compose box has its own Who / Where pickers.
export async function NotificationsRoute({ profile }: { profile: ProfileRow }) {
  const { notifications, rooms, zones } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Notifications" scope={scope} campus={profile.campus}>
      <AdminNotificationsSection
        profileId={profile.id}
        role={profile.role}
        notifications={notifications}
        rooms={rooms}
        zones={zones}
      />
    </SectionPageShell>
  );
}
