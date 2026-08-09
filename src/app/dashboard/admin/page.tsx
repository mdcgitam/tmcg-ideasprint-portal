import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { dashboardPathForRole } from "@/lib/auth/roles";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function AdminDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "Super Admin") redirect(dashboardPathForRole(profile.role));

  const data = await fetchAdminDashboardData();

  return <AdminDashboardShell profile={profile} scope="admin" {...data} />;
}
