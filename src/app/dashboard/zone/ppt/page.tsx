import { requireProfile } from "@/lib/auth/require-profile";
import { PptRoute } from "@/components/dashboard/admin/routes/PptRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const profile = await requireProfile(["Zone Manager"]);
  const { room } = await searchParams;
  return <PptRoute profile={profile} roomId={room} />;
}
