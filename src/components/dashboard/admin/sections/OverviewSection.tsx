"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createPortal } from "react-dom";
import type { ApprovalRequestRow, CampusCode, ExitRequestRow, NocRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { teamActiveStatus } from "@/components/dashboard/admin/sections/ExitStatusBadge";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { FilterSelect } from "./TeamFormFields";
import { downloadCsv } from "@/lib/csv";
import { useTabFade } from "@/hooks/useTabFade";
import { CAMPUS_ORDER } from "@/lib/dashboard/campus-config";
import {
  GRADUATION_OPTIONS,
  ALL_PROGRAMS,
  PROGRAM_BY_GRADUATION,
  YEAR_BY_PROGRAM,
  SCHOOL_OPTIONS,
  DEPARTMENT_BY_SCHOOL,
  BRANCH_BY_DEPARTMENT,
  ALL_YEARS,
  ALL_DEPARTMENTS,
  ALL_BRANCHES,
  GENDER_OPTIONS,
  STAY_OPTIONS,
} from "@/lib/registration/academic";

type Tab = "summary" | "breakdown";

/**
 * dataviz skill's validated dark-mode categorical order (references/palette.md)
 * — each chart here is one series (a headcount) broken into nominal
 * categories already named by the X-axis, so per the skill's own anti-pattern
 * list ("a value-ramp on nominal categories") every bar within one chart
 * shares a single hue; a different slot per *chart* just helps tell them
 * apart at a glance. Fixed assignment, never reassigned by filter state.
 */
const CHART_COLOR = {
  graduation: "#3987e5",
  program: "#d95926",
  year: "#199e70",
  school: "#c98500",
  department: "#d55181",
  branch: "#008300",
  gender: "#9085e9",
  stay: "#e66767",
};

interface MemberRow {
  member: TeamMemberProfile;
  team: TeamRow;
}

/** Generic enough to back every drill-down — team lists, request lists, and member lists alike — so clicking a KPI number behaves exactly like clicking a chart bar. */
interface DrillDown {
  title: string;
  countLabel: string;
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
  csvFilename: string;
  csvRows: Record<string, unknown>[];
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
  const [tab, setTab] = useState<Tab>("summary");
  const fadeRef = useTabFade(tab);
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);

  const participatingTeams = useMemo(() => teams.filter((t) => t.is_active), [teams]);
  const exitedTeams = useMemo(
    () => participatingTeams.filter((t) => teamActiveStatus(membersByTeam[t.id] ?? []) === "Inactive"),
    [participatingTeams, membersByTeam],
  );
  const teamsYetToSelectPs = useMemo(() => participatingTeams.filter((t) => !t.current_problem_statement_id), [participatingTeams]);

  // Active members of teams that actually participated — the population every
  // "Active ___" KPI and every chart below draws from. A no-show team's
  // roster never showed up, so it doesn't belong in "how many of our
  // attendees are 3rd years" any more than it belongs in Attendance/NOC/PPT
  // (0073).
  const activeRows = useMemo<MemberRow[]>(
    () => participatingTeams.flatMap((t) => (membersByTeam[t.id] ?? []).filter((m) => m.is_active).map((member) => ({ member, team: t }))),
    [participatingTeams, membersByTeam],
  );

  const missingNocRows = useMemo(
    () => activeRows.filter(({ member }) => nocs.find((n) => n.profile_id === member.id)?.status !== "Uploaded"),
    [activeRows, nocs],
  );

  function leadOf(teamId: string): TeamMemberProfile | null {
    return (membersByTeam[teamId] ?? []).find((m) => m.is_lead) ?? null;
  }
  function personName(teamId: string, profileId: string): string {
    return (membersByTeam[teamId] ?? []).find((m) => m.id === profileId)?.name ?? "Unknown";
  }

  // ── Breakdown tab: filters + charts ───────────────────────────────────
  const [campusFilter, setCampusFilter] = useState<CampusCode | "">("");
  const [graduationFilter, setGraduationFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [stayFilter, setStayFilter] = useState("");

  const programOptions = graduationFilter ? PROGRAM_BY_GRADUATION[graduationFilter as keyof typeof PROGRAM_BY_GRADUATION] : ALL_PROGRAMS;
  const yearOptions = programFilter ? YEAR_BY_PROGRAM[programFilter] ?? ALL_YEARS : ALL_YEARS;
  const departmentOptions = schoolFilter ? DEPARTMENT_BY_SCHOOL[schoolFilter as keyof typeof DEPARTMENT_BY_SCHOOL] : ALL_DEPARTMENTS;
  const branchOptions = departmentFilter
    ? (BRANCH_BY_DEPARTMENT[departmentFilter as keyof typeof BRANCH_BY_DEPARTMENT] ?? ALL_BRANCHES)
    : ALL_BRANCHES;

  const filteredRows = useMemo(
    () =>
      activeRows.filter(
        ({ member }) =>
          inScope(member.campus, campusFilter) &&
          inScope(member.graduation, graduationFilter) &&
          inScope(member.program, programFilter) &&
          inScope(member.year_of_study, yearFilter) &&
          inScope(member.school, schoolFilter) &&
          inScope(member.department, departmentFilter) &&
          inScope(member.branch, branchFilter) &&
          inScope(member.gender, genderFilter) &&
          inScope(member.stay, stayFilter),
      ),
    [activeRows, campusFilter, graduationFilter, programFilter, yearFilter, schoolFilter, departmentFilter, branchFilter, genderFilter, stayFilter],
  );

  const graduationData = useMemo(() => countBy(filteredRows, GRADUATION_OPTIONS, (m) => m.graduation ?? ""), [filteredRows]);
  const programData = useMemo(() => countBy(filteredRows, programOptions, (m) => m.program ?? ""), [filteredRows, programOptions]);
  const yearData = useMemo(() => countBy(filteredRows, yearOptions, (m) => m.year_of_study), [filteredRows, yearOptions]);
  const schoolData = useMemo(() => countBy(filteredRows, SCHOOL_OPTIONS, (m) => m.school), [filteredRows]);
  const departmentData = useMemo(() => countBy(filteredRows, departmentOptions, (m) => m.department), [filteredRows, departmentOptions]);
  const branchData = useMemo(() => countBy(filteredRows, branchOptions, (m) => m.branch), [filteredRows, branchOptions]);
  const genderData = useMemo(() => countBy(filteredRows, GENDER_OPTIONS, (m) => m.gender), [filteredRows]);
  const stayData = useMemo(() => countBy(filteredRows, STAY_OPTIONS, (m) => m.stay), [filteredRows]);

  const hasActiveFilters = !!(
    campusFilter ||
    graduationFilter ||
    programFilter ||
    yearFilter ||
    schoolFilter ||
    departmentFilter ||
    branchFilter ||
    genderFilter ||
    stayFilter
  );

  function clearFilters() {
    setCampusFilter("");
    setGraduationFilter("");
    setProgramFilter("");
    setYearFilter("");
    setSchoolFilter("");
    setDepartmentFilter("");
    setBranchFilter("");
    setGenderFilter("");
    setStayFilter("");
  }

  // ── Drill-downs ────────────────────────────────────────────────────────
  function memberDrillDown(title: string, rows: MemberRow[]): DrillDown {
    return {
      title,
      countLabel: `${rows.length} people`,
      columns: [...(singleCampus ? [] : ["Campus"]), "Name", "Team", "User ID", "Email", "School", "Department", "Year"],
      rows: rows.map(({ member, team }) => ({
        key: member.id,
        cells: [
          ...(singleCampus ? [] : [member.campus ?? "—"]),
          <>
            {member.name} {member.is_lead && <span className="text-xs text-gold">(Lead)</span>}
          </>,
          team.team_name,
          member.user_id,
          member.gitam_email,
          member.school,
          member.department,
          member.year_of_study,
        ],
      })),
      csvFilename: `overview-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      csvRows: rows.map(({ member, team }) => ({
        ...(singleCampus ? {} : { Campus: member.campus ?? "—" }),
        "User ID": member.user_id,
        Name: member.name,
        Team: team.team_name,
        Position: member.is_lead ? "Team Lead" : "Member",
        Email: member.gitam_email,
        Phone: member.phone,
        Graduation: member.graduation ?? "—",
        Program: member.program ?? "—",
        Year: member.year_of_study,
        School: member.school,
        Department: member.department,
        Branch: member.branch,
        Gender: member.gender,
        Stay: member.stay,
      })),
    };
  }

  function teamDrillDown(title: string, rows: TeamRow[]): DrillDown {
    return {
      title,
      countLabel: `${rows.length} teams`,
      columns: [...(singleCampus ? [] : ["Campus"]), "Team ID", "Team Name", "Team Lead", "Size", "Participation", "PS Selected"],
      rows: rows.map((team) => {
        const lead = leadOf(team.id);
        const size = (membersByTeam[team.id] ?? []).filter((m) => m.is_active).length;
        return {
          key: team.id,
          cells: [
            ...(singleCampus ? [] : [team.campus]),
            team.team_id,
            team.team_name,
            lead?.name ?? "—",
            size,
            team.is_active ? "Participated" : "No-Show",
            team.current_problem_statement_id ? "Yes" : "No",
          ],
        };
      }),
      csvFilename: `overview-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      csvRows: rows.map((team) => ({
        ...(singleCampus ? {} : { Campus: team.campus }),
        "Team ID": team.team_id,
        "Team Name": team.team_name,
        "Team Lead": leadOf(team.id)?.name ?? "—",
        Size: (membersByTeam[team.id] ?? []).filter((m) => m.is_active).length,
        Participation: team.is_active ? "Participated" : "No-Show",
        "PS Selected": team.current_problem_statement_id ? "Yes" : "No",
      })),
    };
  }

  function approvalDrillDown(title: string, rows: ApprovalRequestRow[]): DrillDown {
    const teamOf = (id: string) => teams.find((t) => t.id === id) ?? null;
    return {
      title,
      countLabel: `${rows.length} requests`,
      columns: [...(singleCampus ? [] : ["Campus"]), "Team", "Requested By", "Requested At"],
      rows: rows.map((r) => {
        const team = teamOf(r.team_id);
        return {
          key: r.id,
          cells: [
            ...(singleCampus ? [] : [team?.campus ?? "—"]),
            team?.team_name ?? "Unknown team",
            personName(r.team_id, r.requested_by),
            new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
          ],
        };
      }),
      csvFilename: `overview-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      csvRows: rows.map((r) => {
        const team = teamOf(r.team_id);
        return {
          ...(singleCampus ? {} : { Campus: team?.campus ?? "—" }),
          "Team ID": team?.team_id ?? "—",
          Team: team?.team_name ?? "Unknown team",
          "Requested By": personName(r.team_id, r.requested_by),
          "Requested At": r.created_at,
        };
      }),
    };
  }

  function exitDrillDown(title: string, rows: ExitRequestRow[]): DrillDown {
    const teamOf = (id: string) => teams.find((t) => t.id === id) ?? null;
    return {
      title,
      countLabel: `${rows.length} requests`,
      columns: [...(singleCampus ? [] : ["Campus"]), "Team", "Participant", "Requested At"],
      rows: rows.map((r) => {
        const team = teamOf(r.team_id);
        return {
          key: r.id,
          cells: [
            ...(singleCampus ? [] : [team?.campus ?? "—"]),
            team?.team_name ?? "Unknown team",
            personName(r.team_id, r.profile_id),
            new Date(r.requested_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
          ],
        };
      }),
      csvFilename: `overview-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      csvRows: rows.map((r) => {
        const team = teamOf(r.team_id);
        return {
          ...(singleCampus ? {} : { Campus: team?.campus ?? "—" }),
          "Team ID": team?.team_id ?? "—",
          Team: team?.team_name ?? "Unknown team",
          Participant: personName(r.team_id, r.profile_id),
          "Requested At": r.requested_at,
        };
      }),
    };
  }

  function openChartDrillDown(label: string, value: string, key: (m: TeamMemberProfile) => string) {
    setDrillDown(memberDrillDown(`${label}: ${value}`, filteredRows.filter((r) => key(r.member) === value)));
  }

  const kpis: { label: string; value: number; onClick: () => void }[] = [
    { label: "No. of Teams Registered", value: teams.length, onClick: () => setDrillDown(teamDrillDown("Teams Registered", teams)) },
    { label: "No. of Teams Participated", value: participatingTeams.length, onClick: () => setDrillDown(teamDrillDown("Teams Participated", participatingTeams)) },
    { label: "No. of Teams Exited", value: exitedTeams.length, onClick: () => setDrillDown(teamDrillDown("Teams Exited", exitedTeams)) },
    { label: "No. of Active Participants", value: activeRows.length, onClick: () => setDrillDown(memberDrillDown("Active Participants", activeRows)) },
    {
      label: "No. of Active Male Participants",
      value: activeRows.filter((r) => r.member.gender === "Male").length,
      onClick: () => setDrillDown(memberDrillDown("Active Male Participants", activeRows.filter((r) => r.member.gender === "Male"))),
    },
    {
      label: "No. of Active Female Participants",
      value: activeRows.filter((r) => r.member.gender === "Female").length,
      onClick: () => setDrillDown(memberDrillDown("Active Female Participants", activeRows.filter((r) => r.member.gender === "Female"))),
    },
    {
      label: "No. of Active Dayscholar Participants",
      value: activeRows.filter((r) => r.member.stay === "Day Scholar").length,
      onClick: () => setDrillDown(memberDrillDown("Active Dayscholar Participants", activeRows.filter((r) => r.member.stay === "Day Scholar"))),
    },
    {
      label: "No. of Active Hostler Participants",
      value: activeRows.filter((r) => r.member.stay === "Hostel").length,
      onClick: () => setDrillDown(memberDrillDown("Active Hostler Participants", activeRows.filter((r) => r.member.stay === "Hostel"))),
    },
    { label: "No. of Missing NOC", value: missingNocRows.length, onClick: () => setDrillDown(memberDrillDown("Missing NOC", missingNocRows)) },
    {
      label: "No. of Teams Yet to Select Problem Statement",
      value: teamsYetToSelectPs.length,
      onClick: () => setDrillDown(teamDrillDown("Teams Yet to Select Problem Statement", teamsYetToSelectPs)),
    },
    {
      label: scope === "admin" ? "No. of Pending Profile Requests" : "No. of Pending Requests",
      value: pendingApprovals.length,
      onClick: () => setDrillDown(approvalDrillDown("Pending Profile Requests", pendingApprovals)),
    },
    {
      label: "No. of Pending Exit Submissions",
      value: pendingExitRequests.length,
      onClick: () => setDrillDown(exitDrillDown("Pending Exit Submissions", pendingExitRequests)),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ViewToggle
        value={tab}
        onChange={setTab}
        options={[
          { value: "summary", label: "Summary" },
          { value: "breakdown", label: "Breakdown" },
        ]}
      />

      <div ref={fadeRef}>
        {tab === "summary" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.onClick}
                className="rounded-xl border border-border bg-surface p-6 text-left transition-colors hover:border-gold/50"
              >
                <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{c.label}</span>
                <p className="mt-3 font-display text-3xl text-ink">{c.value}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Filters</span>
              <div className="flex flex-wrap items-center gap-2">
                {!singleCampus && (
                  <FilterSelect label="Campus" value={campusFilter} onChange={(v) => setCampusFilter(v as CampusCode | "")} options={[...CAMPUS_ORDER]} valueOptions={[...CAMPUS_ORDER]} />
                )}
                <FilterSelect
                  label="Graduation"
                  value={graduationFilter}
                  onChange={(v) => {
                    setGraduationFilter(v);
                    setProgramFilter("");
                    setYearFilter("");
                  }}
                  options={[...GRADUATION_OPTIONS]}
                  valueOptions={[...GRADUATION_OPTIONS]}
                />
                <FilterSelect
                  label="Program"
                  value={programFilter}
                  onChange={(v) => {
                    setProgramFilter(v);
                    setYearFilter("");
                  }}
                  options={[...programOptions]}
                  valueOptions={[...programOptions]}
                />
                <FilterSelect label="Year" value={yearFilter} onChange={setYearFilter} options={[...yearOptions]} valueOptions={[...yearOptions]} />
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
                <FilterSelect label="Stay" value={stayFilter} onChange={setStayFilter} options={[...STAY_OPTIONS]} valueOptions={[...STAY_OPTIONS]} />
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
                  >
                    Clear Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrillDown(memberDrillDown("Filtered Participants", filteredRows))}
                  className="ml-auto rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                >
                  Download CSV
                </button>
              </div>
              <p className="font-heading text-xs text-ink-muted">Showing {filteredRows.length} people matching these filters</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <OverviewChart title="Graduation" color={CHART_COLOR.graduation} data={graduationData} onBarClick={(name) => openChartDrillDown("Graduation", name, (m) => m.graduation ?? "")} />
              <OverviewChart title="Program" color={CHART_COLOR.program} data={programData} onBarClick={(name) => openChartDrillDown("Program", name, (m) => m.program ?? "")} />
              <OverviewChart title="Year of Study" color={CHART_COLOR.year} data={yearData} onBarClick={(name) => openChartDrillDown("Year", name, (m) => m.year_of_study)} />
              <OverviewChart title="School" color={CHART_COLOR.school} data={schoolData} onBarClick={(name) => openChartDrillDown("School", name, (m) => m.school)} />
              <OverviewChart
                title="Department"
                color={CHART_COLOR.department}
                data={departmentData}
                angledLabels
                onBarClick={(name) => openChartDrillDown("Department", name, (m) => m.department)}
              />
              <OverviewChart
                title="Branch"
                color={CHART_COLOR.branch}
                data={branchData}
                angledLabels
                onBarClick={(name) => openChartDrillDown("Branch", name, (m) => m.branch)}
              />
              <OverviewChart title="Gender" color={CHART_COLOR.gender} data={genderData} onBarClick={(name) => openChartDrillDown("Gender", name, (m) => m.gender)} />
              <OverviewChart title="Stay" color={CHART_COLOR.stay} data={stayData} onBarClick={(name) => openChartDrillDown("Stay", name, (m) => m.stay)} />
            </div>
          </div>
        )}
      </div>

      {drillDown && <DrillDownModal drillDown={drillDown} onClose={() => setDrillDown(null)} />}
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

function DrillDownModal({ drillDown, onClose }: { drillDown: DrillDown; onClose: () => void }) {
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
            <p className="mt-1 font-heading text-xs text-ink-muted">{drillDown.countLabel}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => downloadCsv(drillDown.csvFilename, drillDown.csvRows)}
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
                {drillDown.columns.map((c) => (
                  <th key={c} className="px-4 py-3">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drillDown.rows.length === 0 ? (
                <tr>
                  <td colSpan={drillDown.columns.length} className="px-4 py-8 text-center text-ink-muted">
                    Nothing matches.
                  </td>
                </tr>
              ) : (
                drillDown.rows.map((row) => (
                  <tr key={row.key} className="border-b border-border align-top last:border-0">
                    {row.cells.map((cell, i) => (
                      <td key={i} className={`px-4 py-3 ${i === 0 ? "text-ink" : "text-ink-muted"}`}>
                        {cell}
                      </td>
                    ))}
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
