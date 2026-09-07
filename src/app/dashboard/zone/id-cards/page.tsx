import { requireProfile } from "@/lib/auth/require-profile";
import { IdCardsRoute } from "@/components/dashboard/admin/routes/IdCardsRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const profile = await requireProfile(["Zone Manager"]);
  const { room } = await searchParams;
  return <IdCardsRoute profile={profile} roomId={room} />;
}
