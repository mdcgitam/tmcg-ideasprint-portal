import { requireProfile } from "@/lib/auth/require-profile";
import { AttendanceRoute } from "@/components/dashboard/admin/routes/AttendanceRoute";

export default async function Page() {
  const profile = await requireProfile(["Zone Manager"]);
  return <AttendanceRoute profile={profile} />;
}
