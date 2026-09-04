import { requireProfile } from "@/lib/auth/require-profile";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function SpocDashboardPage() {
  const profile = await requireProfile(["SPOC"]);
  const { notifications } = await fetchAdminDashboardData(profile);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return <AdminDashboardShell profile={profile} scope="spoc" unreadCount={unreadCount} />;
}
