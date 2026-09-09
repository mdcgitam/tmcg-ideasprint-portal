import { requireProfile } from "@/lib/auth/require-profile";
import { IdCardsRoute } from "@/components/dashboard/admin/routes/IdCardsRoute";

export default async function Page() {
  const profile = await requireProfile(["Zone Manager"]);
  return <IdCardsRoute profile={profile} />;
}
