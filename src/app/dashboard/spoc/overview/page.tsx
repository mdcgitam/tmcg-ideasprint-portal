import { requireProfile } from "@/lib/auth/require-profile";
import { OverviewRoute } from "@/components/dashboard/admin/routes/OverviewRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "SPOC"]);
  return <OverviewRoute profile={profile} />;
}
