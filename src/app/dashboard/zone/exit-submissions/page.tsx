import { requireProfile } from "@/lib/auth/require-profile";
import { ExitSubmissionsRoute } from "@/components/dashboard/admin/routes/ExitSubmissionsRoute";

export default async function Page() {
  const profile = await requireProfile(["Zone Manager"]);
  return <ExitSubmissionsRoute profile={profile} />;
}
