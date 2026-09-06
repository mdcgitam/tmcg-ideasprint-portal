import { requireProfile } from "@/lib/auth/require-profile";
import { AttendanceRoute } from "@/components/dashboard/admin/routes/AttendanceRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "Campus Admin", "SPOC"]);
  return <AttendanceRoute profile={profile} />;
}
