import type { CampusCode, ProfileRow } from "@/types/database";

const CAMPUS_CODES: CampusCode[] = ["VSP", "BLR", "HYD"];

export type SuperCampusParam = CampusCode | "all";

export function parseSuperCampus(raw: string | string[] | undefined): SuperCampusParam {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && (CAMPUS_CODES as string[]).includes(v) ? (v as CampusCode) : "all";
}

/**
 * The admin dashboard routes are shared: a Campus Admin sees their own campus,
 * the global Super Admin sees whichever campus module they picked (`?campus=`),
 * or every campus for "All". For a Super Admin this returns a profile whose
 * `campus` is pinned to the selection (null for "All"), so `fetchAdminDashboardData`
 * and every section scope to it with no further changes. For anyone else the
 * profile passes through untouched.
 */
export function effectiveAdminProfile(
  profile: ProfileRow,
  campusParam: string | string[] | undefined,
): { profile: ProfileRow; selected: SuperCampusParam } {
  if (profile.role !== "Super Admin") return { profile, selected: (profile.campus ?? "all") as SuperCampusParam };
  const selected = parseSuperCampus(campusParam);
  return {
    profile: { ...profile, campus: selected === "all" ? null : selected },
    selected,
  };
}
