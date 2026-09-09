import { requireProfile } from "@/lib/auth/require-profile";
import { effectiveAdminProfile } from "@/lib/auth/super-campus";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const raw = await requireProfile(["Super Admin", "Campus Admin"]);
  const { profile, selected } = effectiveAdminProfile(raw, (await searchParams).campus);

  return <AdminDashboardShell profile={profile} scope="admin" superCampus={selected} />;
}
