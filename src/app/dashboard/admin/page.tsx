import { requireProfile } from "@/lib/auth/require-profile";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function AdminDashboardPage() {
  const profile = await requireProfile(["Super Admin"]);
  const { notifications } = await fetchAdminDashboardData(profile);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return <AdminDashboardShell profile={profile} scope="admin" unreadCount={unreadCount} />;
}
