import { type ReactNode, useMemo } from "react";
import type { ExitRequestRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { FilterSelect, YEAR_OPTIONS } from "./TeamFormFields";
import { MEMBER_STATUS_OPTIONS, exitStatusLabel } from "./ExitStatusBadge";

export interface MemberRow {
  member: TeamMemberProfile;
  team: TeamRow;
}

export interface MemberFilters {
  search: string;
  campus: string;
  position: string; // "" | "lead" | "member"
  teamSize: string;
  graduation: string;
  program: string;
  year: string;
  school: string;
  department: string;
  branch: string;
  gender: string;
  stay: string;
  zone: string;
  room: string;
  spoc: string;
  status: string;
}

export const EMPTY_MEMBER_FILTERS: MemberFilters = {
  search: "",
  campus: "",
  position: "",
  teamSize: "",
  graduation: "",
  program: "",
  year: "",
  school: "",
  department: "",
  branch: "",
  gender: "",
  stay: "",
  zone: "",
  room: "",
  spoc: "",
  status: "",
};

/** "View by Participants"' filter set — one row per member. Search matches User ID, Team Name, Participant Name, Reg No, Email, Phone No. */
export function filterMembers(
  rows: MemberRow[],
  filters: MemberFilters,
  exitRequests: ExitRequestRow[],
  rooms: RoomRow[],
): MemberRow[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter(({ member, team }) => {
    if (q) {
      const haystack =
        `${member.user_id} ${team.team_name} ${member.name} ${member.reg_no} ${member.gitam_email} ${member.phone}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.campus && member.campus !== filters.campus) return false;
    if (filters.teamSize && String(team.member_count) !== filters.teamSize) return false;
    if (filters.position && (filters.position === "lead") !== member.is_lead) return false;
    if (filters.graduation && member.graduation !== filters.graduation) return false;
    if (filters.program && member.program !== filters.program) return false;
    if (filters.year && member.year_of_study !== filters.year) return false;
    if (filters.school && member.school !== filters.school) return false;
    if (filters.department && member.department !== filters.department) return false;
    if (filters.branch && member.branch !== filters.branch) return false;
    if (filters.gender && member.gender !== filters.gender) return false;
    if (filters.stay && member.stay !== filters.stay) return false;
    if (filters.zone) {
      const room = rooms.find((r) => r.id === team.room_id);
      if (!room || room.zone_id !== filters.zone) return false;
    }
    if (filters.room && team.room_id !== filters.room) return false;
    if (filters.spoc && team.spoc_profile_id !== filters.spoc) return false;
    if (filters.status && exitStatusLabel(exitRequests.find((r) => r.profile_id === member.id)) !== filters.status) return false;
    return true;
  });
}

function uniqueOptions(rows: MemberRow[], pick: (m: TeamMemberProfile) => string): string[] {
  return Array.from(new Set(rows.map(({ member }) => pick(member)).filter(Boolean)));
}

export function MembersFilterBar({
  filters,
  onChange,
  rows,
  rooms,
  zones,
  staffAccounts,
  extraActions,
  singleCampus = false,
  hideVenue = false,
}: {
  filters: MemberFilters;
  onChange: (next: MemberFilters) => void;
  rows: MemberRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  extraActions?: ReactNode;
  singleCampus?: boolean;
  hideVenue?: boolean;
}) {
  function set<K extends keyof MemberFilters>(key: K, value: string) {
    onChange({ ...filters, [key]: value });
  }

  const campusOptions = useMemo(() => uniqueOptions(rows, (m) => m.campus ?? ""), [rows]);
  const graduationOptions = useMemo(() => uniqueOptions(rows, (m) => m.graduation ?? ""), [rows]);
  const programOptions = useMemo(() => uniqueOptions(rows, (m) => m.program ?? ""), [rows]);
  const schoolOptions = useMemo(() => uniqueOptions(rows, (m) => m.school), [rows]);
  const departmentOptions = useMemo(() => uniqueOptions(rows, (m) => m.department), [rows]);
  const branchOptions = useMemo(() => uniqueOptions(rows, (m) => m.branch), [rows]);
  const genderOptions = useMemo(() => uniqueOptions(rows, (m) => m.gender), [rows]);
  const stayOptions = useMemo(() => uniqueOptions(rows, (m) => m.stay), [rows]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search by user ID, team name, participant name, reg no, email, or phone…"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
        {extraActions}
      </div>
      <div className="flex flex-wrap gap-2">
        {!singleCampus && (
          <FilterSelect label="Campus" value={filters.campus} onChange={(v) => set("campus", v)} options={campusOptions} />
        )}
        <FilterSelect label="Team Size" value={filters.teamSize} onChange={(v) => set("teamSize", v)} options={["3", "4"]} />
        <FilterSelect
          label="Position"
          value={filters.position}
          onChange={(v) => set("position", v)}
          options={["Team Lead", "Member"]}
          valueOptions={["lead", "member"]}
        />
        <FilterSelect label="Graduation" value={filters.graduation} onChange={(v) => set("graduation", v)} options={graduationOptions} />
        <FilterSelect label="Program" value={filters.program} onChange={(v) => set("program", v)} options={programOptions} />
        <FilterSelect label="Year" value={filters.year} onChange={(v) => set("year", v)} options={YEAR_OPTIONS} />
        <FilterSelect label="School" value={filters.school} onChange={(v) => set("school", v)} options={schoolOptions} />
        <FilterSelect label="Department" value={filters.department} onChange={(v) => set("department", v)} options={departmentOptions} />
        <FilterSelect label="Branch" value={filters.branch} onChange={(v) => set("branch", v)} options={branchOptions} />
        <FilterSelect label="Gender" value={filters.gender} onChange={(v) => set("gender", v)} options={genderOptions} />
        <FilterSelect label="Stay" value={filters.stay} onChange={(v) => set("stay", v)} options={stayOptions} />
        {!hideVenue && (
          <>
            <FilterSelect
              label="Zone"
              value={filters.zone}
              onChange={(v) => set("zone", v)}
              options={zones.map((z) => z.name)}
              valueOptions={zones.map((z) => z.id)}
            />
            <FilterSelect
              label="Venue"
              value={filters.room}
              onChange={(v) => set("room", v)}
              options={rooms.map((r) => r.name)}
              valueOptions={rooms.map((r) => r.id)}
            />
          </>
        )}
        <FilterSelect
          label="SPOC"
          value={filters.spoc}
          onChange={(v) => set("spoc", v)}
          options={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.name)}
          valueOptions={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.id)}
        />
        <FilterSelect label="Status" value={filters.status} onChange={(v) => set("status", v)} options={[...MEMBER_STATUS_OPTIONS]} />
      </div>
    </div>
  );
}
