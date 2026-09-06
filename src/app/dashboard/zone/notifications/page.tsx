import { requireProfile } from "@/lib/auth/require-profile";
import { NotificationsRoute } from "@/components/dashboard/admin/routes/NotificationsRoute";

export default async function Page() {
  const profile = await requireProfile(["Zone Manager"]);
  return <NotificationsRoute profile={profile} />;
}
