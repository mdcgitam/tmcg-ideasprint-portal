import { requireProfile } from "@/lib/auth/require-profile";
import { fetchAdminDashboardData, computeDashboardCardCounts } from "@/lib/dashboard/admin-data";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function ZoneManagerDashboardPage() {
  const profile = await requireProfile(["Zone Manager"]);
  const data = await fetchAdminDashboardData(profile);
  const counts = computeDashboardCardCounts(data);
  const zoneLabel = data.zones.length > 0 ? `${data.zones.map((z) => z.name).join(", ")}, ${data.zones[0].campus}` : undefined;

  return <AdminDashboardShell profile={profile} scope="zone" counts={counts} zoneLabel={zoneLabel} />;
}
