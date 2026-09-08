import { requireProfile } from "@/lib/auth/require-profile";
import { ProblemStatementsRoute } from "@/components/dashboard/admin/routes/ProblemStatementsRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const profile = await requireProfile(["Zone Manager"]);
  const { room } = await searchParams;
  return <ProblemStatementsRoute profile={profile} roomId={room} />;
}
