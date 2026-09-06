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
import { downloadCsv } from "@/lib/csv";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

const PS_MIN = 1;
const PS_MAX = 50;

type View = "team" | "analytics";

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function configString(config: Record<string, unknown>, key: string): string | null {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function BarChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-14 shrink-0 font-mono text-xs text-ink-muted">#{d.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-void">
            <div className="h-4 rounded bg-gold" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right font-heading text-xs text-ink-muted">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Problem Statements are catalogued in our DB only as bare number+status
 * rows (1–50) — the actual titles/content live in an admin-provided Google
 * Sheet, browsed externally by Team Leads. "Go Live" bulk-releases PS 1–50
 * and opens the selection window in one action; Team Leads then just type
 * the number they picked from the sheet.
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
}: {
  problemStatements: ProblemStatementRow[];
  problemStatementExtensions: ProblemStatementExtensionRow[];
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  config: Record<string, unknown>;
}) {
  const [local, setLocal] = useState(problemStatements);
  const [localExtensions, setLocalExtensions] = useState(problemStatementExtensions);
  const [localTeams, setLocalTeams] = useState(teams);
  const [localConfig, setLocalConfig] = useState(config);

  const [view, setView] = useState<View>("team");
  const fadeRef = useTabFade(view);

  // ── Setup: sheet URL / deadline / go-live ───────────────────────────────
  const [sheetUrlDraft, setSheetUrlDraft] = useState(configString(config, "problem_statement.spreadsheet_url") ?? "");
  const [savingSheetUrl, setSavingSheetUrl] = useState(false);
  const [deadlineDraft, setDeadlineDraft] = useState(
    toDatetimeLocal(configString(config, "problem_statement.selection_end")),
  );
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);

  const selectionStart = configString(localConfig, "problem_statement.selection_start");
  const selectionEnd = configString(localConfig, "problem_statement.selection_end");

  async function handleSaveSheetUrl() {
    setSavingSheetUrl(true);
    setSetupError(null);
    try {
      await setConfiguration(
        "problem_statement.spreadsheet_url",
        sheetUrlDraft.trim(),
        "Google Sheet URL for Problem Statements, shown to Team Leads.",
      );
      setLocalConfig((c) => ({ ...c, "problem_statement.spreadsheet_url": sheetUrlDraft.trim() }));
      setSetupMessage("Sheet link saved.");
    } catch (err) {
      setSetupError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSavingSheetUrl(false);
    }
  }

  async function handleSaveDeadline() {
    if (!deadlineDraft) return;
    setSavingDeadline(true);
    setSetupError(null);
    try {
      const iso = new Date(deadlineDraft).toISOString();
      await setConfiguration("problem_statement.selection_end", iso, "Problem statement selection window close time.");
      setLocalConfig((c) => ({ ...c, "problem_statement.selection_end": iso }));
      setSetupMessage("Deadline saved.");
    } catch (err) {
      setSetupError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSavingDeadline(false);
    }
  }

  async function handleGoLive() {
    const sheetUrl = configString(localConfig, "problem_statement.spreadsheet_url");
    if (!sheetUrl) {
      setSetupError("Save the sheet link before going live.");
      return;
    }
    if (!selectionEnd) {
      setSetupError("Save a selection deadline before going live.");
      return;
    }
    setGoingLive(true);
    setSetupError(null);
    setSetupMessage(null);
    try {
      const nowIso = new Date().toISOString();
      await setConfiguration("problem_statement.selection_start", nowIso, "Problem statement selection window open time.");

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
      setLocalConfig((c) => ({ ...c, "problem_statement.selection_start": nowIso }));
      setSetupMessage("Live — problem statements 1–50 are released and the selection window is open.");
    } catch (err) {
      setSetupError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setGoingLive(false);
    }
  }

  // ── Team View: inline PS edit + per-team/bulk deadline extend ───────────
  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const psNumberOf = (team: TeamRow) => local.find((p) => p.id === team.current_problem_statement_id)?.number ?? "";
  const extensionOf = (teamId: string) => localExtensions.find((e) => e.team_id === teamId);

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
    const value = deadlineDrafts[team.id] ?? toDatetimeLocal(extensionOf(team.id)?.extended_until);
    if (!value) return;
    setExtendBusy(team.id);
    setExtendErrors((prev) => ({ ...prev, [team.id]: "" }));
    try {
      const iso = new Date(value).toISOString();
      await extendProblemStatementDeadline(team.id, iso, "Extended by admin");
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
      await Promise.all(teamIds.map((teamId) => extendProblemStatementDeadline(teamId, iso, "Bulk extension")));
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
      localTeams.map((team) => {
        const lead = (membersByTeam[team.id] ?? []).find((m) => m.is_lead);
        return {
          Campus: lead?.campus ?? "—",
          "Team Name": team.team_name,
          "Team Lead": lead?.name ?? "—",
          "Lead Phone No": lead?.phone ?? "—",
          "Team Size": String(team.member_count),
          Venue: roomOf(team)?.name ?? "Unassigned",
          SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
          "PS Code": psNumberOf(team) || "—",
          "Deadline Extension": extensionOf(team.id)?.extended_until ?? "—",
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
    const rows = Array.from(counts.values()).sort((a, b) => Number(a.number) - Number(b.number) || a.number.localeCompare(b.number));
    const totalSelected = localTeams.filter((t) => t.current_problem_statement_id).length;
    return { rows, totalSelected, totalTeams: localTeams.length };
  }, [local, localTeams]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Problem Statement Sheet</span>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={sheetUrlDraft}
            onChange={(e) => setSheetUrlDraft(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/..."
            className="min-w-[260px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={savingSheetUrl || !sheetUrlDraft.trim()}
            onClick={handleSaveSheetUrl}
            className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
          >
            {savingSheetUrl ? "Saving…" : "Save Link"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="font-heading text-xs text-ink-muted">Selection Deadline</label>
          <input
            type="datetime-local"
            value={deadlineDraft}
            onChange={(e) => setDeadlineDraft(e.target.value)}
            className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={savingDeadline || !deadlineDraft}
            onClick={handleSaveDeadline}
            className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
          >
            {savingDeadline ? "Saving…" : "Save Deadline"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={goingLive}
            onClick={handleGoLive}
            className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {goingLive ? "Going Live…" : "Go Live Now"}
          </button>
          <span className="font-heading text-xs text-ink-muted">
            {selectionStart
              ? `Live since ${new Date(selectionStart).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
              : "Not live yet"}
            {selectionEnd &&
              ` · Closes ${new Date(selectionEnd).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
          </span>
        </div>
        {setupError && <p className="font-heading text-xs text-danger">{setupError}</p>}
        {setupMessage && <p className="font-heading text-xs text-gitam">{setupMessage}</p>}
      </div>

      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "team", label: "Team View" },
          { value: "analytics", label: "Analytics" },
        ]}
      />

      <div ref={fadeRef}>
        {view === "team" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Bulk Extend Deadline (selected teams)</span>
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
                  {bulkBusy ? "Applying…" : "Apply Bulk Extend"}
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
                  Export CSV
                </button>
                <span className="font-heading text-xs text-ink-muted">Selected: {selected.size} team(s)</span>
              </div>
              {bulkError && <p className="font-heading text-xs text-danger">{bulkError}</p>}
            </div>

            {localTeams.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-8 text-center">
                <p className="font-heading text-sm text-ink-muted">No teams registered yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                <table className="w-full text-left font-heading text-sm">
                  <thead>
                    <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                      <th className="px-4 py-3" />
                      <th className="px-4 py-3">Campus</th>
                      <th className="px-4 py-3">Team Name</th>
                      <th className="px-4 py-3">Team Lead Name</th>
                      <th className="px-4 py-3">Team Lead Phone</th>
                      <th className="px-4 py-3">Team Size</th>
                      <th className="px-4 py-3">Venue</th>
                      <th className="px-4 py-3">SPOC</th>
                      <th className="px-4 py-3">PS Code</th>
                      <th className="px-4 py-3">Extension</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localTeams.map((team) => {
                      const lead = (membersByTeam[team.id] ?? []).find((m) => m.is_lead);
                      const room = roomOf(team);
                      const zone = zoneOf(room);
                      const venue = room ? (zone ? `${room.name} (${zone.name})` : room.name) : "Unassigned";
                      const extension = extensionOf(team.id);
                      const psBusyHere = psBusy === team.id;
                      const extendBusyHere = extendBusy === team.id;

                      return (
                        <tr key={team.id} className="border-b border-border align-top last:border-0">
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={selected.has(team.id)} onChange={() => toggleSelected(team.id)} />
                          </td>
                          <td className="px-4 py-3 text-ink-muted">{lead?.campus ?? "—"}</td>
                          <td className="px-4 py-3 text-ink">
                            {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                          </td>
                          <td className="px-4 py-3 text-ink-muted">{lead?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-ink-muted">{lead?.phone ?? "—"}</td>
                          <td className="px-4 py-3 text-ink-muted">{team.member_count}</td>
                          <td className="px-4 py-3 text-ink-muted">{venue}</td>
                          <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
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
                                  className="w-fit rounded-full border border-gold/50 px-3 py-1 font-heading text-[11px] font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
                                >
                                  {psBusyHere ? "Saving…" : "Save"}
                                </button>
                              </div>
                              {psErrors[team.id] && <span className="font-heading text-[11px] text-danger">{psErrors[team.id]}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="font-heading text-[11px] text-ink-muted">
                                Current:{" "}
                                {extension
                                  ? new Date(extension.extended_until).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                                  : "Not set"}
                              </span>
                              <input
                                type="datetime-local"
                                value={deadlineDrafts[team.id] ?? toDatetimeLocal(extension?.extended_until)}
                                onChange={(e) => setDeadlineDrafts((prev) => ({ ...prev, [team.id]: e.target.value }))}
                                className="rounded-lg border border-border bg-void px-2 py-1 font-heading text-xs text-ink outline-none focus:border-gold"
                              />
                              <button
                                type="button"
                                disabled={extendBusyHere || !(deadlineDrafts[team.id] ?? toDatetimeLocal(extension?.extended_until))}
                                onClick={() => handleRowExtend(team)}
                                className="w-fit rounded-full border border-gold/50 px-3 py-1 font-heading text-[11px] font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
                              >
                                {extendBusyHere ? "Saving…" : extension ? "Update" : "Extend"}
                              </button>
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

            <div className="rounded-xl border border-border bg-surface p-5">
              <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Teams per Problem Statement</span>
              <div className="mt-4">
                {analytics.rows.length === 0 ? (
                  <p className="font-heading text-sm text-ink-muted">No problem statements released yet.</p>
                ) : (
                  <BarChart data={analytics.rows.map((r) => ({ label: r.number, count: r.count }))} />
                )}
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
                      <td className="px-4 py-3 text-ink">#{row.number}</td>
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
