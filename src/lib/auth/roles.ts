import type { UserRole } from "@/types/database";

export type { UserRole };

/** Where a logged-in user lands after auth/callback resolves their role. */
export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case "Super Admin":
      return "/dashboard/super";
    case "Campus Admin":
      return "/dashboard/admin";
    case "Zone Manager":
      return "/dashboard/zone";
    case "SPOC":
      return "/dashboard/spoc";
    case "Team Lead":
    case "Member":
    default:
      return "/dashboard/team";
  }
}
