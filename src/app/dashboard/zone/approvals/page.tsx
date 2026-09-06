import { requireProfile } from "@/lib/auth/require-profile";
import { ApprovalsRoute } from "@/components/dashboard/admin/routes/ApprovalsRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const profile = await requireProfile(["Zone Manager"]);
  const { room } = await searchParams;
  return <ApprovalsRoute profile={profile} roomId={room} />;
}
