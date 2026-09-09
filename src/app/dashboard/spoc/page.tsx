import { requireProfile } from "@/lib/auth/require-profile";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function SpocDashboardPage() {
  const profile = await requireProfile(["SPOC"]);
  const { rooms, zones } = await fetchAdminDashboardData(profile);
  const room = rooms.find((r) => r.spoc_profile_id === profile.id);
  const zone = room ? zones.find((z) => z.id === room.zone_id) : undefined;
  const spocLabel = zone && room ? `${zone.name}_${room.name}_${zone.campus}` : undefined;

  return <AdminDashboardShell profile={profile} scope="spoc" spocLabel={spocLabel} />;
}
