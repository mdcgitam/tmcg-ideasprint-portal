import { CAMPUS_ORDER } from "./campus-config";

/**
 * Default admin "View by Team"/"View by Participants" row order across
 * NOC/PPT/Attendance/ID Cards/Problem Statement/Teams — grouped by physical
 * layout (Campus, skipped for a campus-scoped viewer -> Zone -> Venue),
 * unassigned rows pushed to the bottom within each level, with a final id
 * (Team ID or User ID) as the tiebreaker inside the same venue. Matches the
 * convention already established for the Rooms & Zones Teams tab.
 */
export function sortByLayout<T>(
  rows: T[],
  opts: {
    singleCampus: boolean;
    campusOf: (row: T) => string | null;
    zoneNameOf: (row: T) => string | null;
    venueNameOf: (row: T) => string | null;
    idOf: (row: T) => string;
  },
): T[] {
  const { singleCampus, campusOf, zoneNameOf, venueNameOf, idOf } = opts;
  return [...rows].sort((a, b) => {
    if (!singleCampus) {
      const ai = CAMPUS_ORDER.indexOf((campusOf(a) ?? "") as (typeof CAMPUS_ORDER)[number]);
      const bi = CAMPUS_ORDER.indexOf((campusOf(b) ?? "") as (typeof CAMPUS_ORDER)[number]);
      const campusDiff = (ai === -1 ? CAMPUS_ORDER.length : ai) - (bi === -1 ? CAMPUS_ORDER.length : bi);
      if (campusDiff !== 0) return campusDiff;
    }

    const aHasVenue = !!venueNameOf(a);
    const bHasVenue = !!venueNameOf(b);
    if (aHasVenue !== bHasVenue) return aHasVenue ? -1 : 1;

    const zoneDiff = (zoneNameOf(a) ?? "").localeCompare(zoneNameOf(b) ?? "");
    if (zoneDiff !== 0) return zoneDiff;

    const venueDiff = (venueNameOf(a) ?? "").localeCompare(venueNameOf(b) ?? "");
    if (venueDiff !== 0) return venueDiff;

    return idOf(a).localeCompare(idOf(b), undefined, { numeric: true });
  });
}
