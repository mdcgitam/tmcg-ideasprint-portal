import { CAMPUS_ORDER } from "./campus-config";

/**
 * Default admin "View by Team"/"View by Participants" row order across
 * NOC/PPT/Attendance/ID Cards/Problem Statement/Teams — grouped by Campus
 * (skipped for a campus-scoped viewer), then ascending Team ID or User ID.
 * Both are already unique within (or across) a campus, so no unassigned/
 * zone/venue bucketing is needed — a team's Zone/Venue can change later
 * without reshuffling the rest of the list.
 */
export function sortByLayout<T>(
  rows: T[],
  opts: {
    singleCampus: boolean;
    campusOf: (row: T) => string | null;
    idOf: (row: T) => string;
  },
): T[] {
  const { singleCampus, campusOf, idOf } = opts;
  return [...rows].sort((a, b) => {
    if (!singleCampus) {
      const ai = CAMPUS_ORDER.indexOf((campusOf(a) ?? "") as (typeof CAMPUS_ORDER)[number]);
      const bi = CAMPUS_ORDER.indexOf((campusOf(b) ?? "") as (typeof CAMPUS_ORDER)[number]);
      const campusDiff = (ai === -1 ? CAMPUS_ORDER.length : ai) - (bi === -1 ? CAMPUS_ORDER.length : bi);
      if (campusDiff !== 0) return campusDiff;
    }
    return idOf(a).localeCompare(idOf(b), undefined, { numeric: true });
  });
}
