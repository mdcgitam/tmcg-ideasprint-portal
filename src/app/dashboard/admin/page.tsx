import { requireProfile } from "@/lib/auth/require-profile";
import { fetchAdminDashboardData, computeDashboardCardCounts } from "@/lib/dashboard/admin-data";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function AdminDashboardPage() {
  const profile = await requireProfile(["Super Admin"]);
  const data = await fetchAdminDashboardData(profile);
  const counts = computeDashboardCardCounts(data);

  return <AdminDashboardShell profile={profile} scope="admin" counts={counts} />;
}
