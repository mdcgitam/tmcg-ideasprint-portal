import { requireProfile } from "@/lib/auth/require-profile";
import { ExitSubmissionsRoute } from "@/components/dashboard/admin/routes/ExitSubmissionsRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "Campus Admin", "SPOC"]);
  return <ExitSubmissionsRoute profile={profile} />;
}
