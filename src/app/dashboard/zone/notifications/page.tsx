import { requireProfile } from "@/lib/auth/require-profile";
import { NotificationsRoute } from "@/components/dashboard/admin/routes/NotificationsRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const profile = await requireProfile(["Zone Manager"]);
  const { room } = await searchParams;
  return <NotificationsRoute profile={profile} roomId={room} />;
}
