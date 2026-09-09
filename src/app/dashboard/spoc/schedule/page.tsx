import { requireProfile } from "@/lib/auth/require-profile";
import { ScheduleRoute } from "@/components/dashboard/admin/routes/ScheduleRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "Campus Admin", "SPOC"]);
  return <ScheduleRoute profile={profile} />;
}
