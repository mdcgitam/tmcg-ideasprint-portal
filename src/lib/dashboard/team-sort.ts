import { CAMPUS_ORDER } from "./campus-config";

/**
 * Default admin "View by Team"/"View by Participants" row order across
 * NOC/PPT/Attendance/ID Cards/Problem Statement/Teams — grouped by physical
 * layout (Campus, skipped for a campus-scoped viewer -> Zone -> Venue ->
 * SPOC), unassigned rows pushed to the bottom within each level, with a
 * final id (Team ID or User ID) as the tiebreaker inside the same venue.
 * Matches the convention already established for the Rooms & Zones Teams
 * tab. SPOC is one-per-venue in practice, so it rarely changes the order
 * Venue already settled — it's kept as an explicit level anyway so the
 * order stays correct if that ever isn't true.
 */
export function sortByLayout<T>(
  rows: T[],
  opts: {
    singleCampus: boolean;
    campusOf: (row: T) => string | null;
    zoneNameOf: (row: T) => string | null;
    venueNameOf: (row: T) => string | null;
    spocNameOf: (row: T) => string | null;
    idOf: (row: T) => string;
  },
): T[] {
  const { singleCampus, campusOf, zoneNameOf, venueNameOf, spocNameOf, idOf } = opts;
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

    const spocDiff = (spocNameOf(a) ?? "").localeCompare(spocNameOf(b) ?? "");
    if (spocDiff !== 0) return spocDiff;

    return idOf(a).localeCompare(idOf(b), undefined, { numeric: true });
  });
}
