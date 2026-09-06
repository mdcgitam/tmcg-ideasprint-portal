import { requireProfile } from "@/lib/auth/require-profile";
import { OverviewRoute } from "@/components/dashboard/admin/routes/OverviewRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const profile = await requireProfile(["Zone Manager"]);
  const { room } = await searchParams;
  return <OverviewRoute profile={profile} roomId={room} />;
}
