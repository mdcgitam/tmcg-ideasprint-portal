import { requireProfile } from "@/lib/auth/require-profile";
import { effectiveAdminProfile } from "@/lib/auth/super-campus";
import { ScheduleRoute } from "@/components/dashboard/admin/routes/ScheduleRoute";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const raw = await requireProfile(["Super Admin", "Campus Admin"]);
  const { profile } = effectiveAdminProfile(raw, (await searchParams).campus);
  return <ScheduleRoute profile={profile} />;
}
