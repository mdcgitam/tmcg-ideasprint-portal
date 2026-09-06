import { requireProfile } from "@/lib/auth/require-profile";
import { effectiveAdminProfile } from "@/lib/auth/super-campus";
import { fetchAdminDashboardData, computeDashboardCardCounts } from "@/lib/dashboard/admin-data";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const raw = await requireProfile(["Super Admin", "Campus Admin"]);
  const { profile, selected } = effectiveAdminProfile(raw, (await searchParams).campus);
  const data = await fetchAdminDashboardData(profile);
  const counts = computeDashboardCardCounts(data);

  return <AdminDashboardShell profile={profile} scope="admin" counts={counts} superCampus={selected} />;
}
