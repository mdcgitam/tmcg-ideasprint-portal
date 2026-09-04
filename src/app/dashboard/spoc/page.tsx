import { requireProfile } from "@/lib/auth/require-profile";
import { fetchAdminDashboardData, computeDashboardCardCounts } from "@/lib/dashboard/admin-data";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function SpocDashboardPage() {
  const profile = await requireProfile(["SPOC"]);
  const data = await fetchAdminDashboardData(profile);
  const counts = computeDashboardCardCounts(data);

  return <AdminDashboardShell profile={profile} scope="spoc" counts={counts} />;
}
