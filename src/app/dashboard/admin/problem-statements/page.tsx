import { requireProfile } from "@/lib/auth/require-profile";
import { effectiveAdminProfile } from "@/lib/auth/super-campus";
import { ProblemStatementsRoute } from "@/components/dashboard/admin/routes/ProblemStatementsRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ campus?: string }> }) {
  const profile = await requireProfile(["Super Admin", "Campus Admin"]);
  const { profile: p } = effectiveAdminProfile(profile, (await searchParams).campus);
  return <ProblemStatementsRoute profile={p} />;
}
