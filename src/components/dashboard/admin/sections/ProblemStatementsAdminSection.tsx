"use client";

import { useMemo, useState } from "react";
import type {
  ProblemStatementExtensionRow,
  ProblemStatementRow,
  ProfileRow,
  RoomRow,
  TeamRow,
  ZoneRow,
} from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import {
  adminSetProblemStatement,
  extendProblemStatementDeadline,
  setConfiguration,
  upsertProblemStatement,
  DashboardActionError,
} from "@/lib/dashboard/admin-actions";
import { effectiveConfigValue } from "@/lib/dashboard/campus-config";
import { downloadCsv } from "@/lib/csv";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";
import { FilterSelect } from "./TeamFormFields";

const PS_MIN = 1;
const PS_MAX = 50;

type View = "team" | "analytics";

interface PsFilters {
  search: string;
  teamSize: string;
  zone: string;
  room: string;
  spoc: string;
}

const EMPTY_PS_FILTERS: PsFilters = { search: "", teamSize: "", zone: "", room: "", spoc: "" };

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function configString(config: Record<string, unknown>, key: string): string | null {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Problem Statements are catalogued in our DB only as bare number+status
 * rows (1–50) — the actual titles/content live in an admin-provided Google
 * Sheet, browsed externally by Team Leads. The sheet URL and the "Go Live"
 * release control live here (Super Admin / Campus Admin only) rather than in
 * Configuration. Until Go Live is clicked, the sheet link stays hidden from
 * Zone Manager / SPOC (here) and Team Lead / Member (on their own
 * dashboard) — "live" is recorded as a timestamp
 * (problem_statement.live_at) so there's a record of when it happened.
 */
export function ProblemStatementsAdminSection({
  problemStatements,
  problemStatementExtensions,
  teams,
  membersByTeam,
  rooms,
  zones,
  staffAccounts,
  config,
  singleCampus = false,
  hideZoneFilters = false,
  hideVenueFilter = false,
  hideSpocFilter = false,
  canManage = false,
}: {
  problemStatements: ProblemStatementRow[];
  problemStatementExtensions: ProblemStatementExtensionRow[];
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  config: Record<string, unknown>;
  singleCampus?: boolean;
  hideZoneFilters?: boolean;
  hideVenueFilter?: boolean;
  hideSpocFilter?: boolean;
  canManage?: boolean;
}) {
  const [local, setLocal] = useState(problemStatements);
  const [localExtensions, setLocalExtensions] = useState(problemStatementExtensions);
  const [localTeams, setLocalTeams] = useState(teams);

  const [view, setView] = useState<View>("team");
  const fadeRef = useTabFade(view);

  const selectionStart = configString(config, "problem_statement.selection_start");
  const selectionEnd = configString(config, "problem_statement.selection_end");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(configString(config, "problem_statement.spreadsheet_url") ?? "");
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [liveAt, setLiveAt] = useState(configString(config, "problem_statement.live_at"));
  const [goingLive, setGoingLive] = useState(false);
  const [goLiveError, setGoLiveError] = useState<string | null>(null);

  async function handleSaveUrl() {
    setSavingUrl(true);
    setUrlMessage(null);
    try {
      await setConfiguration("problem_statement.spreadsheet_url", spreadsheetUrl || null, "Problem statement spreadsheet URL.");
      setUrlMessage("Saved.");
    } catch (err) {
      setUrlMessage(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSavingUrl(false);
    }
  }

  async function handleGoLive() {
    if (!selectionStart || !selectionEnd) {
      setGoLiveError("Set the selection window (start & end) in Configuration before going live.");
      return;
    }
    if (!spreadsheetUrl.trim()) {
      setGoLiveError("Add the spreadsheet URL above before going live.");
      return;
    }
    setGoingLive(true);
    setGoLiveError(null);
    try {
      const results = await Promise.all(
        Array.from({ length: PS_MAX - PS_MIN + 1 }, (_, i) => String(PS_MIN + i)).map(async (number) => {
          const existing = local.find((p) => p.number === number);
          const id = await upsertProblemStatement({
            id: existing?.id ?? null,
            number,
            title: existing?.title || `Problem Statement ${number}`,
            description: existing?.description ?? "",
            status: "Released",
          });
          return { id, number, existing };
        }),
      );

      setLocal((prev) => {
        const next = [...prev];
        for (const { id, number, existing } of results) {
          const row: ProblemStatementRow = {
            id,
            number,
            title: existing?.title || `Problem Statement ${number}`,
            description: existing?.description ?? null,
            status: "Released",
            created_at: existing?.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const idx = next.findIndex((p) => p.id === id);
          if (idx >= 0) next[idx] = row;
          else next.push(row);
        }
        return next;
      });

      const nowIso = new Date().toISOString();
      await setConfiguration("problem_statement.live_at", nowIso, "When problem statements were released (Go Live).");
      setLiveAt(nowIso);
    } catch (err) {
      setGoLiveError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setGoingLive(false);
    }
  }

  // ── Team view: inline PS edit + per-team/bulk deadline ─────────────────
  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const psNumberOf = (team: TeamRow) => local.find((p) => p.id === team.current_problem_statement_id)?.number ?? "";
  // Displayed team size = active members only (an approved exit deactivates the profile).
  const sizeOf = (team: TeamRow) => (membersByTeam[team.id] ?? []).filter((m) => m.is_active).length || team.member_count;
  const extensionOf = (teamId: string) => localExtensions.find((e) => e.team_id === teamId);
  // A team's effective deadline: its own extension, else its campus-scoped
  // selection end (falling back to the global default, same as select_problem_statement/0048).
  const deadlineOf = (teamId: string) => {
    const campus = localTeams.find((t) => t.id === teamId)?.campus ?? null;
    return extensionOf(teamId)?.extended_until ?? effectiveConfigValue(config, "problem_statement.selection_end", campus);
  };

  const [psDrafts, setPsDrafts] = useState<Record<string, string>>({});
  const [psBusy, setPsBusy] = useState<string | null>(null);
  const [psErrors, setPsErrors] = useState<Record<string, string>>({});

  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<string, string>>({});
  const [extendBusy, setExtendBusy] = useState<string | null>(null);
  const [extendErrors, setExtendErrors] = useState<Record<string, string>>({});

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeadline, setBulkDeadline] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Once a PS code is saved the field freezes into a plain value + "Edit" button, rather than staying an always-open input.
  const [editingPs, setEditingPs] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<PsFilters>(EMPTY_PS_FILTERS);

  const visibleTeams = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return localTeams.filter((team) => {
      const lead = (membersByTeam[team.id] ?? []).find((m) => m.is_lead);
      if (q) {
        const haystack = `${team.team_name} ${lead?.name ?? ""} ${lead?.phone ?? ""} ${psNumberOf(team)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.teamSize && String(sizeOf(team)) !== filters.teamSize) return false;
      if (filters.zone && zoneOf(roomOf(team))?.id !== filters.zone) return false;
      if (filters.room && team.room_id !== filters.room) return false;
      if (filters.spoc && team.spoc_profile_id !== filters.spoc) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTeams, membersByTeam, filters, local]);

  function toggleSelected(teamId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function applyLocalExtension(teamId: string, iso: string) {
    setLocalExtensions((prev) => {
      const existing = prev.find((e) => e.team_id === teamId);
      if (existing) return prev.map((e) => (e.team_id === teamId ? { ...e, extended_until: iso } : e));
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          team_id: teamId,
          extended_until: iso,
          duration_minutes: null,
          reason: null,
          granted_by: "",
          granted_at: new Date().toISOString(),
        },
      ];
    });
  }

  function startEditPs(team: TeamRow) {
    setPsDrafts((prev) => ({ ...prev, [team.id]: psNumberOf(team) }));
    setPsErrors((prev) => ({ ...prev, [team.id]: "" }));
    setEditingPs((prev) => new Set(prev).add(team.id));
  }

  async function handlePsSave(team: TeamRow) {
    const raw = (psDrafts[team.id] ?? psNumberOf(team)).trim();
    const n = Number(raw);
    if (!raw || !Number.isInteger(n) || n < PS_MIN || n > PS_MAX) {
      setPsErrors((prev) => ({ ...prev, [team.id]: `Enter a number between ${PS_MIN} and ${PS_MAX}.` }));
      return;
    }
    setPsBusy(team.id);
    setPsErrors((prev) => ({ ...prev, [team.id]: "" }));
    try {
      const result = await adminSetProblemStatement(team.id, String(n));
      setLocalTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, current_problem_statement_id: result.id } : t)));
      setLocal((prev) => {
        const exists = prev.find((p) => p.id === result.id);
        return exists
          ? prev
          : [
              ...prev,
              {
                id: result.id,
                number: result.number,
                title: result.title,
                description: null,
                status: "Released",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];
      });
      setEditingPs((prev) => {
        const next = new Set(prev);
        next.delete(team.id);
        return next;
      });
    } catch (err) {
      setPsErrors((prev) => ({
        ...prev,
        [team.id]: err instanceof DashboardActionError ? err.message : "Something went wrong.",
      }));
    } finally {
      setPsBusy(null);
    }
  }

  async function handleRowExtend(team: TeamRow) {
    const value = deadlineDrafts[team.id] ?? toDatetimeLocal(deadlineOf(team.id));
    if (!value) return;
    setExtendBusy(team.id);
    setExtendErrors((prev) => ({ ...prev, [team.id]: "" }));
    try {
      const iso = new Date(value).toISOString();
      await extendProblemStatementDeadline(team.id, iso, "Set by admin");
      applyLocalExtension(team.id, iso);
    } catch (err) {
      setExtendErrors((prev) => ({
        ...prev,
        [team.id]: err instanceof DashboardActionError ? err.message : "Something went wrong.",
      }));
    } finally {
      setExtendBusy(null);
    }
  }

  async function handleBulkExtend() {
    if (!bulkDeadline || selected.size === 0) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      const iso = new Date(bulkDeadline).toISOString();
      const teamIds = Array.from(selected);
      await Promise.all(teamIds.map((teamId) => extendProblemStatementDeadline(teamId, iso, "Bulk update")));
      teamIds.forEach((teamId) => applyLocalExtension(teamId, iso));
      setSelected(new Set());
      setBulkDeadline("");
    } catch (err) {
      setBulkError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBulkBusy(false);
    }
  }

  function handleExportTeamView() {
    downloadCsv(
      "problem-statement-teams",
      visibleTeams.map((team) => {
        const lead = (membersByTeam[team.id] ?? []).find((m) => m.is_lead);
        const room = roomOf(team);
        return {
          ...(singleCampus ? {} : { Campus: lead?.campus ?? "—" }),
          "Team Name": team.team_name,
          "Team Lead": lead?.name ?? "—",
          "Lead Phone No": lead?.phone ?? "—",
          "Team Size": String(sizeOf(team)),
          Zone: zoneOf(room)?.name ?? "—",
          Venue: room?.name ?? "Unassigned",
          SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
          "PS Code": psNumberOf(team) || "—",
          Deadline: deadlineOf(team.id) ?? "—",
        };
      }),
    );
  }

  // ── Analytics ────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const counts = new Map<string, { number: string; count: number; teamNames: string[] }>();
    for (const ps of local) {
      counts.set(ps.id, { number: ps.number, count: 0, teamNames: [] });
    }
    for (const team of localTeams) {
      if (!team.current_problem_statement_id) continue;
      const entry = counts.get(team.current_problem_statement_id);
      if (entry) {
        entry.count += 1;
        entry.teamNames.push(team.team_name);
      }
    }
    const rows = Array.from(counts.values()).sort(
      (a, b) => Number(a.number) - Number(b.number) || a.number.localeCompare(b.number),
    );
    const totalSelected = localTeams.filter((t) => t.current_problem_statement_id).length;
    return { rows, totalSelected, totalTeams: localTeams.length };
  }, [local, localTeams]);

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Problem Statement Spreadsheet URL</span>
          <p className="mt-1 font-heading text-xs text-ink-muted">
            Hidden from Zone Manager, SPOC, and Team Lead / Member until you click Go Live below.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={spreadsheetUrl}
              onChange={(e) => setSpreadsheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/..."
              className="flex-1 rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
            />
            <button
              type="button"
              disabled={savingUrl}
              onClick={handleSaveUrl}
              className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {savingUrl ? "Saving…" : "Save"}
            </button>
          </div>
          {urlMessage && <p className="mt-2 font-heading text-xs text-ink-muted">{urlMessage}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <button
              type="button"
              disabled={goingLive}
              onClick={handleGoLive}
              className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {goingLive ? "Going Live…" : "Go Live Now"}
            </button>
            <span className="font-heading text-xs text-ink-muted">
              {liveAt ? `Live since ${fmtDateTime(liveAt)}` : "Not live yet — the sheet is hidden from other roles."}
            </span>
          </div>
          {goLiveError && <p className="mt-2 font-heading text-xs text-danger">{goLiveError}</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Problem Statement Sheet</span>
          {liveAt && spreadsheetUrl ? (
            <>
              <p className="mt-2 font-heading text-sm text-ink">
                <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="text-gold underline">
                  Open the problem statement sheet ↗
                </a>
              </p>
              <p className="mt-1 font-heading text-xs text-ink-muted">Live since {fmtDateTime(liveAt)}.</p>
            </>
          ) : (
            <p className="mt-2 font-heading text-xs text-ink-muted">The problem statement list hasn&rsquo;t gone live yet.</p>
          )}
        </div>
      )}

      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "team", label: "View by Team" },
          { value: "analytics", label: "Analytics" },
        ]}
      />

      <div ref={fadeRef}>
        {view === "team" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">
                Bulk Set Deadline (selected teams)
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="datetime-local"
                  value={bulkDeadline}
                  onChange={(e) => setBulkDeadline(e.target.value)}
                  className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
                />
                <button
                  type="button"
                  disabled={bulkBusy || !bulkDeadline || selected.size === 0}
                  onClick={handleBulkExtend}
                  className="rounded-full bg-gold px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
                >
                  {bulkBusy ? "Applying…" : "Apply to Selected"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleExportTeamView}
                  className="rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                >
                  Download CSV
                </button>
                <span className="font-heading text-xs text-ink-muted">Selected: {selected.size} team(s)</span>
              </div>
              {bulkError && <p className="font-heading text-xs text-danger">{bulkError}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-4">
              <FilterSelect
                label="Team Size"
                value={filters.teamSize}
                onChange={(v) => setFilters((f) => ({ ...f, teamSize: v }))}
                options={Array.from(new Set(localTeams.map((t) => sizeOf(t))))
                  .sort((a, b) => a - b)
                  .map(String)}
              />
              {!hideZoneFilters && (
                <FilterSelect
                  label="Zone"
                  value={filters.zone}
                  onChange={(v) => setFilters((f) => ({ ...f, zone: v }))}
                  options={zones.map((z) => z.name)}
                  valueOptions={zones.map((z) => z.id)}
                />
              )}
              {!hideVenueFilter && (
                <FilterSelect
                  label="Venue"
                  value={filters.room}
                  onChange={(v) => setFilters((f) => ({ ...f, room: v }))}
                  options={rooms.map((r) => r.name)}
                  valueOptions={rooms.map((r) => r.id)}
                />
              )}
              {!hideSpocFilter && (
                <FilterSelect
                  label="SPOC"
                  value={filters.spoc}
                  onChange={(v) => setFilters((f) => ({ ...f, spoc: v }))}
                  options={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.name)}
                  valueOptions={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.id)}
                />
              )}
              <input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Team name / team lead / lead phone / PS code…"
                className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
              />
            </div>

            <p className="font-heading text-xs text-ink-muted">Showing {visibleTeams.length} teams</p>

            {visibleTeams.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-8 text-center">
                <p className="font-heading text-sm text-ink-muted">
                  {localTeams.length === 0 ? "No teams registered yet." : "No teams match the current filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                <table className="w-full text-left font-heading text-sm">
                  <thead>
                    <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                      <th className="px-4 py-3" />
                      {!singleCampus && <th className="px-4 py-3">Campus</th>}
                      <th className="px-4 py-3">Team Name</th>
                      <th className="px-4 py-3">Team Lead</th>
                      <th className="px-4 py-3">Lead Phone No</th>
                      <th className="px-4 py-3">Team Size</th>
                      <th className="px-4 py-3">Zone</th>
                      <th className="px-4 py-3">Venue</th>
                      <th className="px-4 py-3">SPOC</th>
                      <th className="px-4 py-3">PS Code</th>
                      <th className="px-4 py-3">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTeams.map((team) => {
                      const lead = (membersByTeam[team.id] ?? []).find((m) => m.is_lead);
                      const room = roomOf(team);
                      const zone = zoneOf(room);
                      const extension = extensionOf(team.id);
                      const psBusyHere = psBusy === team.id;
                      const extendBusyHere = extendBusy === team.id;
                      const teamSelectionEnd = effectiveConfigValue(config, "problem_statement.selection_end", team.campus);
                      const deadlineFieldValue =
                        deadlineDrafts[team.id] ?? toDatetimeLocal(extension?.extended_until ?? teamSelectionEnd);

                      return (
                        <tr key={team.id} className="border-b border-border align-top last:border-0">
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={selected.has(team.id)} onChange={() => toggleSelected(team.id)} />
                          </td>
                          {!singleCampus && <td className="px-4 py-3 text-ink-muted">{lead?.campus ?? "—"}</td>}
                          <td className="px-4 py-3 text-ink">{team.team_name}</td>
                          <td className="px-4 py-3 text-ink-muted">{lead?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-ink-muted">{lead?.phone ?? "—"}</td>
                          <td className="px-4 py-3 text-ink-muted">{sizeOf(team)}</td>
                          <td className="px-4 py-3 text-ink-muted">{zone?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-ink-muted">{room?.name ?? "Unassigned"}</td>
                          <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {psNumberOf(team) && !editingPs.has(team.id) ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-heading text-xs text-ink">{psNumberOf(team)}</span>
                                  <button
                                    type="button"
                                    onClick={() => startEditPs(team)}
                                    className="w-fit rounded-full border border-gold/50 px-3 py-1 font-heading text-[11px] font-medium text-gold transition-colors hover:bg-gold/10"
                                  >
                                    Edit
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={PS_MIN}
                                    max={PS_MAX}
                                    value={psDrafts[team.id] ?? psNumberOf(team)}
                                    onChange={(e) => setPsDrafts((prev) => ({ ...prev, [team.id]: e.target.value }))}
                                    placeholder="1–50"
                                    className="w-20 rounded-lg border border-border bg-void px-2 py-1 font-heading text-xs text-ink outline-none focus:border-gold"
                                  />
                                  <button
                                    type="button"
                                    disabled={psBusyHere}
                                    onClick={() => handlePsSave(team)}
                                    className="w-fit shrink-0 rounded-full border border-gold/50 px-3 py-1 font-heading text-[11px] font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
                                  >
                                    {psBusyHere ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              )}
                              {psErrors[team.id] && <span className="font-heading text-[11px] text-danger">{psErrors[team.id]}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="font-heading text-[11px] text-ink-muted">
                                Current: {fmtDateTime(extension?.extended_until ?? teamSelectionEnd)}
                                {!extension && teamSelectionEnd && " (general)"}
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="datetime-local"
                                  value={deadlineFieldValue}
                                  onChange={(e) => setDeadlineDrafts((prev) => ({ ...prev, [team.id]: e.target.value }))}
                                  className="rounded-lg border border-border bg-void px-2 py-1 font-heading text-xs text-ink outline-none focus:border-gold"
                                />
                                <button
                                  type="button"
                                  disabled={extendBusyHere || !deadlineFieldValue}
                                  onClick={() => handleRowExtend(team)}
                                  className="w-fit shrink-0 rounded-full border border-gold/50 px-3 py-1 font-heading text-[11px] font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
                                >
                                  {extendBusyHere ? "Saving…" : "Save"}
                                </button>
                              </div>
                              {extendErrors[team.id] && (
                                <span className="font-heading text-[11px] text-danger">{extendErrors[team.id]}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === "analytics" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface p-5">
                <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Teams Selected</span>
                <p className="mt-2 font-display text-3xl text-ink">
                  {analytics.totalSelected}
                  <span className="ml-2 font-heading text-sm text-ink-muted">of {analytics.totalTeams}</span>
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-5">
                <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Problem Statements Live</span>
                <p className="mt-2 font-display text-3xl text-ink">{local.filter((p) => p.status === "Released").length}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-left font-heading text-sm">
                <thead>
                  <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                    <th className="px-4 py-3">PS Code</th>
                    <th className="px-4 py-3">No. of Teams</th>
                    <th className="px-4 py-3">Teams</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.rows.map((row) => (
                    <tr key={row.number} className="border-b border-border align-top last:border-0">
                      <td className="px-4 py-3 text-ink">{row.number}</td>
                      <td className="px-4 py-3 text-ink-muted">{row.count}</td>
                      <td className="px-4 py-3 text-ink-muted">{row.teamNames.length === 0 ? "—" : row.teamNames.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
