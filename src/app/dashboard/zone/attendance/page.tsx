import { requireProfile } from "@/lib/auth/require-profile";
import { AttendanceRoute } from "@/components/dashboard/admin/routes/AttendanceRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const profile = await requireProfile(["Zone Manager"]);
  const { room } = await searchParams;
  return <AttendanceRoute profile={profile} roomId={room} />;
}
