import { requireProfile } from "@/lib/auth/require-profile";
import { TeamsRoute } from "@/components/dashboard/admin/routes/TeamsRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "Campus Admin", "SPOC"]);
  return <TeamsRoute profile={profile} />;
}
