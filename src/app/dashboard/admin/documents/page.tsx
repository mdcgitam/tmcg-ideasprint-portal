import { requireProfile } from "@/lib/auth/require-profile";
import { DocumentsRoute } from "@/components/dashboard/admin/routes/DocumentsRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "Campus Admin"]);
  return <DocumentsRoute profile={profile} />;
}
