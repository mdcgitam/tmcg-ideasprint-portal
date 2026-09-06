import { requireProfile } from "@/lib/auth/require-profile";
import { NocRoute } from "@/components/dashboard/admin/routes/NocRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const profile = await requireProfile(["Zone Manager"]);
  const { room } = await searchParams;
  return <NocRoute profile={profile} roomId={room} />;
}
