import { requireProfile } from "@/lib/auth/require-profile";
import { fetchAdminDashboardData, computeDashboardCardCounts } from "@/lib/dashboard/admin-data";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function ZoneManagerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const profile = await requireProfile(["Zone Manager"]);
  const { room } = await searchParams;
  const data = await fetchAdminDashboardData(profile, room ? { roomId: room } : undefined);
  const counts = computeDashboardCardCounts(data);
  const zoneRooms = data.rooms
    .map((r) => ({ id: r.id, name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminDashboardShell
      profile={profile}
      scope="zone"
      counts={counts}
      zoneRooms={zoneRooms}
      activeRoomId={room}
    />
  );
}
