import { requireProfile } from "@/lib/auth/require-profile";
import { ProblemStatementsRoute } from "@/components/dashboard/admin/routes/ProblemStatementsRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin"]);
  return <ProblemStatementsRoute profile={profile} />;
}
