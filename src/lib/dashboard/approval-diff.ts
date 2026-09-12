/**
 * Turns a profile-edit approval_request's before/after snapshots into a
 * field-level diff — shared by the admin Profile Requests table
 * (ApprovalsSection) and the Team Lead's own Requests tab (ProfileSection)
 * so both read the same request the same way.
 */

// Fields a Team Lead can put into an edit request (see ProfileSection's
// `toEditable`) plus the team-name field — mapped to human labels.
const MEMBER_FIELD_LABELS: Array<[string, string]> = [
  ["name", "Name"],
  ["phone", "Phone"],
  ["graduation", "Graduation"],
  ["program", "Program"],
  ["yearOfStudy", "Year of Study"],
  ["school", "School"],
  ["department", "Department"],
  ["branch", "Branch"],
  ["gender", "Gender"],
  ["stay", "Stay"],
];

export interface FieldChange {
  label: string;
  from: string;
  to: string;
}
export interface MemberDiff {
  profileId: string;
  changes: FieldChange[];
}
export interface EditDiff {
  teamName: FieldChange | null;
  members: MemberDiff[];
  /** Only used when the request isn't the known {team, members} shape. */
  generic: FieldChange[];
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join(", ");
  }
  return String(v);
}

function prettifyKey(k: string): string {
  return k
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Turn a request's before/after snapshots into a field-level diff — the reviewer sees only what actually changes, not the whole record. */
export function buildEditDiff(currentRaw: unknown, requestedRaw: unknown): EditDiff {
  const current = (currentRaw ?? {}) as Record<string, unknown>;
  const requested = (requestedRaw ?? {}) as Record<string, unknown>;

  const isKnownShape =
    "team" in requested || "members" in requested || "team" in current || "members" in current;

  if (isKnownShape) {
    const curTeam = (current.team ?? {}) as Record<string, unknown>;
    const reqTeam = (requested.team ?? {}) as Record<string, unknown>;
    const teamFrom = asText(curTeam.teamName);
    const teamTo = asText(reqTeam.teamName);
    const teamName: FieldChange | null =
      teamFrom !== teamTo ? { label: "Team Name", from: teamFrom, to: teamTo } : null;

    const curMembers = (Array.isArray(current.members) ? current.members : []) as Record<string, unknown>[];
    const reqMembers = (Array.isArray(requested.members) ? requested.members : []) as Record<string, unknown>[];

    const members: MemberDiff[] = [];
    reqMembers.forEach((rm, i) => {
      const cm =
        curMembers.find((m) => m.profileId === rm.profileId) ?? curMembers[i] ?? ({} as Record<string, unknown>);
      const changes: FieldChange[] = [];
      for (const [key, label] of MEMBER_FIELD_LABELS) {
        const from = asText(cm[key]);
        const to = asText(rm[key]);
        if (from !== to) changes.push({ label, from, to });
      }
      if (changes.length > 0) members.push({ profileId: String(rm.profileId ?? i), changes });
    });

    return { teamName, members, generic: [] };
  }

  const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(requested)]));
  const generic = keys
    .map((k) => ({ label: prettifyKey(k), from: asText(current[k]), to: asText(requested[k]) }))
    .filter((c) => c.from !== c.to);
  return { teamName: null, members: [], generic };
}

/** One line per changed field, grouped by who it belongs to — for a table's Changes column or a CSV export. `memberName` resolves a profileId to a display name (e.g. via membersByTeam). */
export function summarizeDiff(diff: EditDiff, memberName: (profileId: string) => string): string {
  const parts: string[] = [];
  if (diff.teamName) parts.push(`Team Name: ${diff.teamName.from || "—"} → ${diff.teamName.to || "—"}`);
  for (const md of diff.members) {
    const fields = md.changes.map((c) => `${c.label}: ${c.from || "—"} → ${c.to || "—"}`).join(", ");
    parts.push(`${memberName(md.profileId)} — ${fields}`);
  }
  for (const c of diff.generic) parts.push(`${c.label}: ${c.from || "—"} → ${c.to || "—"}`);
  return parts.length > 0 ? parts.join("; ") : "No field changes.";
}
