import { type ReactNode, useMemo } from "react";
import type { ProfileRow, RoomRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { FilterSelect, YEAR_OPTIONS } from "./TeamFormFields";

export interface MemberRow {
  member: TeamMemberProfile;
  team: TeamRow;
}

export interface MemberFilters {
  search: string;
  campus: string;
  position: string; // "" | "lead" | "member"
  teamSize: string;
  year: string;
  school: string;
  department: string;
  branch: string;
  stay: string;
  room: string;
  spoc: string;
}

export const EMPTY_MEMBER_FILTERS: MemberFilters = {
  search: "",
  campus: "",
  position: "",
  teamSize: "",
  year: "",
  school: "",
  department: "",
  branch: "",
  stay: "",
  room: "",
  spoc: "",
};

/** "View by Members"' filter set — one row per member. Search matches User ID, Name, Email, Reg No, Phone No. */
export function filterMembers(rows: MemberRow[], filters: MemberFilters): MemberRow[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter(({ member, team }) => {
    if (q) {
      const haystack = `${member.user_id} ${member.name} ${member.gitam_email} ${member.reg_no} ${member.phone}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.campus && member.campus !== filters.campus) return false;
    if (filters.position && (filters.position === "lead") !== member.is_lead) return false;
    if (filters.teamSize && String(team.member_count) !== filters.teamSize) return false;
    if (filters.year && member.year_of_study !== filters.year) return false;
    if (filters.school && member.school !== filters.school) return false;
    if (filters.department && member.department !== filters.department) return false;
    if (filters.branch && member.branch !== filters.branch) return false;
    if (filters.stay && member.stay !== filters.stay) return false;
    if (filters.room && team.room_id !== filters.room) return false;
    if (filters.spoc && team.spoc_profile_id !== filters.spoc) return false;
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
  staffAccounts,
  extraActions,
  sortById,
  onToggleSort,
}: {
  filters: MemberFilters;
  onChange: (next: MemberFilters) => void;
  rows: MemberRow[];
  rooms: RoomRow[];
  staffAccounts: ProfileRow[];
  extraActions?: ReactNode;
  sortById?: boolean;
  onToggleSort?: () => void;
}) {
  function set<K extends keyof MemberFilters>(key: K, value: string) {
    onChange({ ...filters, [key]: value });
  }

  const campusOptions = useMemo(() => uniqueOptions(rows, (m) => m.campus), [rows]);
  const schoolOptions = useMemo(() => uniqueOptions(rows, (m) => m.school), [rows]);
  const departmentOptions = useMemo(() => uniqueOptions(rows, (m) => m.department), [rows]);
  const branchOptions = useMemo(() => uniqueOptions(rows, (m) => m.branch), [rows]);
  const stayOptions = useMemo(() => uniqueOptions(rows, (m) => m.stay), [rows]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search by user ID, name, email, reg no, or phone…"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
        {extraActions}
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Campus" value={filters.campus} onChange={(v) => set("campus", v)} options={campusOptions} />
        <FilterSelect
          label="Position"
          value={filters.position}
          onChange={(v) => set("position", v)}
          options={["Team Lead", "Member"]}
          valueOptions={["lead", "member"]}
        />
        <FilterSelect label="Team Size" value={filters.teamSize} onChange={(v) => set("teamSize", v)} options={["3", "4"]} />
        <FilterSelect label="Year" value={filters.year} onChange={(v) => set("year", v)} options={YEAR_OPTIONS} />
        <FilterSelect label="School" value={filters.school} onChange={(v) => set("school", v)} options={schoolOptions} />
        <FilterSelect label="Department" value={filters.department} onChange={(v) => set("department", v)} options={departmentOptions} />
        <FilterSelect label="Branch" value={filters.branch} onChange={(v) => set("branch", v)} options={branchOptions} />
        <FilterSelect label="Stay" value={filters.stay} onChange={(v) => set("stay", v)} options={stayOptions} />
        <FilterSelect
          label="Venue"
          value={filters.room}
          onChange={(v) => set("room", v)}
          options={rooms.map((r) => r.name)}
          valueOptions={rooms.map((r) => r.id)}
        />
        <FilterSelect
          label="SPOC"
          value={filters.spoc}
          onChange={(v) => set("spoc", v)}
          options={staffAccounts.map((s) => s.name)}
          valueOptions={staffAccounts.map((s) => s.id)}
        />
        {onToggleSort && (
          <button
            type="button"
            onClick={onToggleSort}
            className={`rounded-lg border px-3 py-1.5 font-heading text-xs transition-colors ${
              sortById ? "border-gold bg-gold/10 text-gold" : "border-border text-ink-muted hover:border-gold hover:text-gold"
            }`}
          >
            View All (by ID)
          </button>
        )}
      </div>
    </div>
  );
}
