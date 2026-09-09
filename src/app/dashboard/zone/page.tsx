import { requireProfile } from "@/lib/auth/require-profile";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function ZoneManagerDashboardPage() {
  const profile = await requireProfile(["Zone Manager"]);
  const { zones } = await fetchAdminDashboardData(profile);
  const zoneLabel = zones.length > 0 ? `${zones.map((z) => z.name).join("_")}_${zones[0].campus}` : undefined;

  return <AdminDashboardShell profile={profile} scope="zone" zoneLabel={zoneLabel} />;
}
