import { requireProfile } from "@/lib/auth/require-profile";
import { NotificationsRoute } from "@/components/dashboard/admin/routes/NotificationsRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "Campus Admin", "SPOC"]);
  return <NotificationsRoute profile={profile} />;
}
