import { requireProfile } from "@/lib/auth/require-profile";
import { DocumentsRoute } from "@/components/dashboard/admin/routes/DocumentsRoute";

export default async function Page() {
  const profile = await requireProfile(["Zone Manager"]);
  return <DocumentsRoute profile={profile} />;
}
