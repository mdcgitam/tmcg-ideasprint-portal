import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminNotificationsSection } from "@/components/dashboard/admin/sections/AdminNotificationsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";
import { ZoneVenueTabs } from "@/components/dashboard/zone/ZoneVenueTabs";

export async function NotificationsRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { notifications, rooms } = await fetchAdminDashboardData(profile, roomId ? { roomId } : undefined);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const venueTabs =
    profile.role === "Zone Manager" ? (
      <ZoneVenueTabs rooms={[...rooms].map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name))} />
    ) : undefined;

  return (
    <SectionPageShell title="Notifications" scope={scope} headerExtra={venueTabs}>
      <AdminNotificationsSection profileId={profile.id} notifications={notifications} scope={scope} rooms={rooms} />
    </SectionPageShell>
  );
}
