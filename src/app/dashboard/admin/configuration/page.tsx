import { requireProfile } from "@/lib/auth/require-profile";
import { ConfigurationRoute } from "@/components/dashboard/admin/routes/ConfigurationRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin"]);
  return <ConfigurationRoute profile={profile} />;
}
