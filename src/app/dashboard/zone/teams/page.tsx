import { requireProfile } from "@/lib/auth/require-profile";
import { TeamsRoute } from "@/components/dashboard/admin/routes/TeamsRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const profile = await requireProfile(["Zone Manager"]);
  const { room } = await searchParams;
  return <TeamsRoute profile={profile} roomId={room} />;
}
