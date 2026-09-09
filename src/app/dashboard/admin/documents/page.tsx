import { requireProfile } from "@/lib/auth/require-profile";
import { effectiveAdminProfile } from "@/lib/auth/super-campus";
import { DocumentsRoute } from "@/components/dashboard/admin/routes/DocumentsRoute";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const raw = await requireProfile(["Super Admin", "Campus Admin"]);
  const { profile } = effectiveAdminProfile(raw, (await searchParams).campus);
  return <DocumentsRoute profile={profile} />;
}
