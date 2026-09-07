import { requireProfile } from "@/lib/auth/require-profile";
import { IdCardsRoute } from "@/components/dashboard/admin/routes/IdCardsRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "Campus Admin", "SPOC"]);
  return <IdCardsRoute profile={profile} />;
}
