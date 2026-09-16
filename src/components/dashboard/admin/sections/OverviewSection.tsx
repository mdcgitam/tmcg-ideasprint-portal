"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createPortal } from "react-dom";
import type { ApprovalRequestRow, CampusCode, ExitRequestRow, NocRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { teamActiveStatus } from "@/components/dashboard/admin/sections/ExitStatusBadge";
import { FilterSelect } from "./TeamFormFields";
import { downloadCsv } from "@/lib/csv";
import { CAMPUS_ORDER } from "@/lib/dashboard/campus-config";
import {
  SCHOOL_OPTIONS,
  DEPARTMENT_BY_SCHOOL,
  BRANCH_BY_DEPARTMENT,
  GENDER_OPTIONS,
  STAY_OPTIONS,
  ALL_YEARS,
  ALL_DEPARTMENTS,
  ALL_BRANCHES,
} from "@/lib/registration/academic";

/**
 * dataviz skill's validated dark-mode categorical order (references/palette.md)
 * — each chart here is one series (a headcount) broken into nominal
 * categories already named by the X-axis, so per the skill's own anti-pattern
 * list ("a value-ramp on nominal categories") every bar within one chart
 * shares a single hue; a different slot per *chart* just helps tell the five
 * apart at a glance. Fixed assignment, never reassigned by filter state.
 */
const CHART_COLOR = {
  gender: "#3987e5",
  year: "#d95926",
  school: "#199e70",
  department: "#c98500",
  stay: "#d55181",
};

interface MemberRow {
  member: TeamMemberProfile;
  team: TeamRow;
}

interface DrillDown {
  title: string;
  rows: MemberRow[];
}

function inScope(value: string | null | undefined, filter: string): boolean {
  return !filter || value === filter;
}

/** Every possible category always renders (even at 0) so bar position/identity stays stable as filters change. */
function countBy(rows: MemberRow[], order: readonly string[], key: (m: TeamMemberProfile) => string) {
  const counts = new Map<string, number>();
  for (const { member } of rows) counts.set(key(member), (counts.get(key(member)) ?? 0) + 1);
  return order.map((name) => ({ name, count: counts.get(name) ?? 0 }));
}

export function OverviewSection({
  scope,
  teams,
  membersByTeam,
  pendingApprovals,
  pendingExitRequests,
  nocs,
  singleCampus,
}: {
  scope: "spoc" | "admin";
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  pendingApprovals: ApprovalRequestRow[];
  pendingExitRequests: ExitRequestRow[];
  nocs: NocRow[];
  singleCampus: boolean;
}) {
  const [campusFilter, setCampusFilter] = useState<CampusCode | "">("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [stayFilter, setStayFilter] = useState("");
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);

  const teamsInScope = useMemo(
    () => (campusFilter ? teams.filter((t) => t.campus === campusFilter) : teams),
    [teams, campusFilter],
  );
  const participatingTeams = useMemo(() => teamsInScope.filter((t) => t.is_active), [teamsInScope]);
  const noShowTeams = useMemo(() => teamsInScope.filter((t) => !t.is_active), [teamsInScope]);
  const belowMinimumTeams = useMemo(
    () => participatingTeams.filter((t) => teamActiveStatus(membersByTeam[t.id] ?? []) === "Inactive"),
    [participatingTeams, membersByTeam],
  );

  // Active members of teams that actually participated — the population every
  // demographic chart and KPI below draws from. A no-show team's roster never
  // showed up, so it doesn't belong in "how many of our attendees are 3rd
  // years" any more than it belongs in Attendance/NOC/PPT (0073).
  const activeRows = useMemo<MemberRow[]>(
    () => participatingTeams.flatMap((t) => (membersByTeam[t.id] ?? []).filter((m) => m.is_active).map((member) => ({ member, team: t }))),
    [participatingTeams, membersByTeam],
  );

  const missingNocs = useMemo(
    () => activeRows.filter(({ member }) => nocs.find((n) => n.profile_id === member.id)?.status !== "Uploaded").length,
    [activeRows, nocs],
  );

  const teamIdsInScope = useMemo(() => new Set(teamsInScope.map((t) => t.id)), [teamsInScope]);
  const pendingApprovalsInScope = useMemo(
    () => pendingApprovals.filter((a) => teamIdsInScope.has(a.team_id)),
    [pendingApprovals, teamIdsInScope],
  );
  const pendingExitsInScope = useMemo(
    () => pendingExitRequests.filter((r) => teamIdsInScope.has(r.team_id)),
    [pendingExitRequests, teamIdsInScope],
  );

  const departmentOptions = schoolFilter ? DEPARTMENT_BY_SCHOOL[schoolFilter as keyof typeof DEPARTMENT_BY_SCHOOL] : ALL_DEPARTMENTS;
  const branchOptions = departmentFilter
    ? (BRANCH_BY_DEPARTMENT[departmentFilter as keyof typeof BRANCH_BY_DEPARTMENT] ?? ALL_BRANCHES)
    : ALL_BRANCHES;

  const filteredRows = useMemo(
    () =>
      activeRows.filter(({ member }) =>
        inScope(member.school, schoolFilter) &&
        inScope(member.department, departmentFilter) &&
        inScope(member.branch, branchFilter) &&
        inScope(member.gender, genderFilter) &&
        inScope(member.year_of_study, yearFilter) &&
        inScope(member.stay, stayFilter),
      ),
    [activeRows, schoolFilter, departmentFilter, branchFilter, genderFilter, yearFilter, stayFilter],
  );

  const genderData = useMemo(() => countBy(filteredRows, GENDER_OPTIONS, (m) => m.gender), [filteredRows]);
  const yearData = useMemo(() => countBy(filteredRows, ALL_YEARS, (m) => m.year_of_study), [filteredRows]);
  const schoolData = useMemo(() => countBy(filteredRows, SCHOOL_OPTIONS, (m) => m.school), [filteredRows]);
  const departmentData = useMemo(
    () => countBy(filteredRows, departmentOptions, (m) => m.department),
    [filteredRows, departmentOptions],
  );
  const stayData = useMemo(() => countBy(filteredRows, STAY_OPTIONS, (m) => m.stay), [filteredRows]);

  function openDrillDown(label: string, value: string, key: (m: TeamMemberProfile) => string) {
    setDrillDown({ title: `${label}: ${value}`, rows: filteredRows.filter((r) => key(r.member) === value) });
  }

  function exportDrillDown(rows: MemberRow[], filename: string) {
    downloadCsv(
      filename,
      rows.map(({ member, team }) => ({
        ...(singleCampus ? {} : { Campus: member.campus ?? "—" }),
        "User ID": member.user_id,
        Name: member.name,
        Team: team.team_name,
        Position: member.is_lead ? "Team Lead" : "Member",
        Email: member.gitam_email,
        Phone: member.phone,
        School: member.school,
        Department: member.department,
        Branch: member.branch,
        Year: member.year_of_study,
        Gender: member.gender,
        Stay: member.stay,
      })),
    );
  }

  const hasActiveFilters = !!(schoolFilter || departmentFilter || branchFilter || genderFilter || yearFilter || stayFilter);

  const kpis = [
    { label: "Teams Registered", value: teamsInScope.length },
    { label: "Teams Participated", value: participatingTeams.length },
    { label: "Teams Marked No-Show", value: noShowTeams.length },
    { label: "Teams Below Minimum (exits)", value: belowMinimumTeams.length },
    { label: "Active Participants", value: activeRows.length },
    { label: "Missing NOCs", value: missingNocs },
    { label: scope === "admin" ? "Pending Profile Requests" : "Pending Requests", value: pendingApprovalsInScope.length },
    { label: "Pending Exit Requests", value: pendingExitsInScope.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface p-6">
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{c.label}</span>
            <p className="mt-3 font-display text-3xl text-ink">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Filters</span>
        <div className="flex flex-wrap items-center gap-2">
          {!singleCampus && (
            <FilterSelect label="Campus" value={campusFilter} onChange={(v) => setCampusFilter(v as CampusCode | "")} options={[...CAMPUS_ORDER]} valueOptions={[...CAMPUS_ORDER]} />
          )}
          <FilterSelect
            label="School"
            value={schoolFilter}
            onChange={(v) => {
              setSchoolFilter(v);
              setDepartmentFilter("");
              setBranchFilter("");
            }}
            options={[...SCHOOL_OPTIONS]}
            valueOptions={[...SCHOOL_OPTIONS]}
          />
          <FilterSelect
            label="Department"
            value={departmentFilter}
            onChange={(v) => {
              setDepartmentFilter(v);
              setBranchFilter("");
            }}
            options={[...departmentOptions]}
            valueOptions={[...departmentOptions]}
          />
          <FilterSelect label="Branch" value={branchFilter} onChange={setBranchFilter} options={[...branchOptions]} valueOptions={[...branchOptions]} />
          <FilterSelect label="Gender" value={genderFilter} onChange={setGenderFilter} options={[...GENDER_OPTIONS]} valueOptions={[...GENDER_OPTIONS]} />
          <FilterSelect label="Year" value={yearFilter} onChange={setYearFilter} options={[...ALL_YEARS]} valueOptions={[...ALL_YEARS]} />
          <FilterSelect label="Stay" value={stayFilter} onChange={setStayFilter} options={[...STAY_OPTIONS]} valueOptions={[...STAY_OPTIONS]} />
          {(hasActiveFilters || campusFilter) && (
            <button
              type="button"
              onClick={() => {
                setCampusFilter("");
                setSchoolFilter("");
                setDepartmentFilter("");
                setBranchFilter("");
                setGenderFilter("");
                setYearFilter("");
                setStayFilter("");
              }}
              className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
            >
              Clear Filters
            </button>
          )}
          <button
            type="button"
            onClick={() => exportDrillDown(filteredRows, "overview-filtered-participants")}
            className="ml-auto rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Download CSV
          </button>
        </div>
        <p className="font-heading text-xs text-ink-muted">Showing {filteredRows.length} people matching these filters</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OverviewChart title="Gender" color={CHART_COLOR.gender} data={genderData} onBarClick={(name) => openDrillDown("Gender", name, (m) => m.gender)} />
        <OverviewChart title="Year of Study" color={CHART_COLOR.year} data={yearData} onBarClick={(name) => openDrillDown("Year", name, (m) => m.year_of_study)} />
        <OverviewChart title="School" color={CHART_COLOR.school} data={schoolData} onBarClick={(name) => openDrillDown("School", name, (m) => m.school)} />
        <OverviewChart
          title="Department"
          color={CHART_COLOR.department}
          data={departmentData}
          angledLabels
          onBarClick={(name) => openDrillDown("Department", name, (m) => m.department)}
        />
        <OverviewChart title="Stay" color={CHART_COLOR.stay} data={stayData} onBarClick={(name) => openDrillDown("Stay", name, (m) => m.stay)} />
      </div>

      {drillDown && (
        <DrillDownModal
          drillDown={drillDown}
          singleCampus={singleCampus}
          onClose={() => setDrillDown(null)}
          onExport={() => exportDrillDown(drillDown.rows, `overview-${drillDown.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`)}
        />
      )}
    </div>
  );
}

function OverviewChart({
  title,
  color,
  data,
  angledLabels = false,
  onBarClick,
}: {
  title: string;
  color: string;
  data: { name: string; count: number }[];
  angledLabels?: boolean;
  onBarClick: (name: string) => void;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{title}</span>
        <span className="font-heading text-xs text-ink-faint">{total} total</span>
      </div>
      {total === 0 ? (
        <p className="mt-8 mb-4 text-center font-heading text-sm text-ink-muted">No matching people.</p>
      ) : (
        <div className="mt-4" style={{ width: "100%", height: angledLabels ? 260 : 220 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 16, right: 8, left: -16, bottom: angledLabels ? 48 : 4 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-border-strong)" }}
                tickLine={false}
                interval={0}
                angle={angledLabels ? -35 : 0}
                textAnchor={angledLabels ? "end" : "middle"}
                height={angledLabels ? 60 : 24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: "var(--color-border)", opacity: 0.4 }}
                contentStyle={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--color-ink)",
                }}
                labelStyle={{ color: "var(--color-ink-muted)" }}
              />
              <Bar
                dataKey="count"
                fill={color}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                onClick={(entry) => onBarClick(String(entry.name))}
                cursor="pointer"
              >
                <LabelList dataKey="count" position="top" fill="var(--color-ink-muted)" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function DrillDownModal({
  drillDown,
  singleCampus,
  onClose,
  onExport,
}: {
  drillDown: DrillDown;
  singleCampus: boolean;
  onClose: () => void;
  onExport: () => void;
}) {
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <h2 className="font-display text-xl text-ink">{drillDown.title}</h2>
            <p className="mt-1 font-heading text-xs text-ink-muted">{drillDown.rows.length} people</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onExport}
              className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
            >
              Close
            </button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                {!singleCampus && <th className="px-4 py-3">Campus</th>}
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Year</th>
              </tr>
            </thead>
            <tbody>
              {drillDown.rows.length === 0 ? (
                <tr>
                  <td colSpan={singleCampus ? 7 : 8} className="px-4 py-8 text-center text-ink-muted">
                    No one matches.
                  </td>
                </tr>
              ) : (
                drillDown.rows.map(({ member, team }) => (
                  <tr key={member.id} className="border-b border-border align-top last:border-0">
                    {!singleCampus && <td className="px-4 py-3 text-ink-muted">{member.campus ?? "—"}</td>}
                    <td className="px-4 py-3 text-ink">
                      {member.name} {member.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{team.team_name}</td>
                    <td className="px-4 py-3 text-ink-muted">{member.user_id}</td>
                    <td className="px-4 py-3 text-ink-muted">{member.gitam_email}</td>
                    <td className="px-4 py-3 text-ink-muted">{member.school}</td>
                    <td className="px-4 py-3 text-ink-muted">{member.department}</td>
                    <td className="px-4 py-3 text-ink-muted">{member.year_of_study}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
}
