import { requireProfile } from "@/lib/auth/require-profile";
import { ProblemStatementsRoute } from "@/components/dashboard/admin/routes/ProblemStatementsRoute";

export default async function Page() {
  const profile = await requireProfile(["Zone Manager"]);
  return <ProblemStatementsRoute profile={profile} />;
}
