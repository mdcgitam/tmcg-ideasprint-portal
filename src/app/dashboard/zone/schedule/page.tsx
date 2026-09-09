import { requireProfile } from "@/lib/auth/require-profile";
import { ScheduleRoute } from "@/components/dashboard/admin/routes/ScheduleRoute";

export default async function Page() {
  const profile = await requireProfile(["Zone Manager"]);
  return <ScheduleRoute profile={profile} />;
}
