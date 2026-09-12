"use client";

import { useMemo, useState } from "react";
import type {
  CampusCode,
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
import {
  CAMPUS_ORDER,
  campusConfigKey,
  campusOverrideBoolean,
  campusOverrideValue,
  effectiveConfigValue,
  effectiveProblemStatementEndDetailed,
  nowDatetimeLocalValue,
  parseProblemStatementCode,
  problemStatementCode,
  problemStatementMaxNumber,
  PROBLEM_STATEMENT_PREFIX,
  sortCampuses,
} from "@/lib/dashboard/campus-config";
import { sortByLayout } from "@/lib/dashboard/team-sort";
import { downloadCsv } from "@/lib/csv";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";
import { FilterSelect } from "./TeamFormFields";

const PS_MIN = 1;

type View = "team" | "analytics";

interface PsFilters {
  search: string;
  campus: string;
  teamSize: string;
  zone: string;
  room: string;
  spoc: string;
}

const EMPTY_PS_FILTERS: PsFilters = { search: "", campus: "", teamSize: "", zone: "", room: "", spoc: "" };

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
 * Each campus runs its own independent problem statement track, numbered
 * 1 through a Super-Admin-configured per-campus ceiling
 * (problem_statement.max_number.<CAMPUS>, default 50) and distinguished by
 * a campus-letter prefix (V1, V2… for VSP, H1… for HYD, B1… for BLR) — a
 * team may only ever select from its own campus's track. The actual
 * titles/content live in an admin-provided Google
 * Sheet (one tab per campus), browsed externally by Team Leads. The sheet
 * URL and the "Go Live" release control live here (Super Admin only —
 * never Campus Admin) rather than in Configuration. A campus-specific
 * override, once set, always wins over the global value for that campus —
 * unlike the deadline fields, this is not latest-edit-wins, so a Super
 * Admin can go live for one campus independently without a later global
 * edit (or a later Go Live for "All") silently taking it over. Until a
 * campus's effective live_at is set, the sheet link stays hidden from
 * Zone Manager / SPOC / Campus Admin (here) and Team Lead / Member (on
 * their own dashboard).
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
  isSuperAdmin = false,
  viewerCampus = null,
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
  isSuperAdmin?: boolean;
  viewerCampus?: CampusCode | null;
}) {
  const [local, setLocal] = useState(problemStatements);
  const [localExtensions, setLocalExtensions] = useState(problemStatementExtensions);
  const [localTeams, setLocalTeams] = useState(teams);

  const [view, setView] = useState<View>("team");
  const fadeRef = useTabFade(view);

  const URL_KEY = "problem_statement.spreadsheet_url";
  const LIVE_AT_KEY = "problem_statement.live_at";

  function writeKeyFor(baseKey: string): string {
    return viewerCampus ? campusConfigKey(baseKey, viewerCampus) : baseKey;
  }

  // The spreadsheet URL is one shared global value, editable only from
  // "All" — frozen (read-only) while viewing a specific campus module, so
  // there's never a divergent link per campus. Only Go Live/Hide is
  // genuinely independent per campus.
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(configString(config, URL_KEY) ?? "");
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [liveAt, setLiveAt] = useState(configString(config, writeKeyFor(LIVE_AT_KEY)));

  // What everyone else (Campus Admin, SPOC, Zone Manager) actually sees:
  // the shared URL, revealed once their own campus's live_at is set (or
  // the global one, if that campus never got its own).
  const effectiveLiveAt = campusOverrideValue(config, LIVE_AT_KEY, viewerCampus);
  // "Has this scope ever gone live" — local optimistic value if this
  // session already changed it, else whatever's effective from config.
  const isLive = !!(liveAt ?? effectiveLiveAt);

  // Super-Admin-only pause: blocks new selections and hides the sheet link
  // for this scope without touching the already-created catalog or any
  // team's existing selection — reversible instantly. Kept separate from
  // live_at so toggling it doesn't stamp over the original "went live at"
  // record. Same campus-override-wins rule as the URL/live_at.
  const HIDDEN_KEY = "problem_statement.hidden";
  const [hidden, setHidden] = useState(campusOverrideBoolean(config, HIDDEN_KEY, viewerCampus));

  // One button covers all three states — go live, hide, unhide — instead
  // of a separate Go Live button that stays active (and confusing) forever
  // after the first click: !isLive -> "Go Live"; isLive && !hidden ->
  // "Hide"; isLive && hidden -> "Unhide". Unhiding re-syncs the catalog
  // too, so raising a campus's problem statement count while paused still
  // gets picked up without needing a separate "re-run Go Live" step.
  const primaryAction: "go-live" | "hide" | "unhide" = !isLive ? "go-live" : hidden ? "unhide" : "hide";
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Each campus's problem statement count ceiling (numbering starts at 1)
  // — Super-Admin-set from the Configuration page, read-only here. Going
  // live/unhiding creates/catches up exactly this many per campus, and
  // it's the ceiling Team Leads/admins can enter for that campus.
  const psMax: Record<CampusCode, number> = {
    VSP: problemStatementMaxNumber(config, "VSP"),
    HYD: problemStatementMaxNumber(config, "HYD"),
    BLR: problemStatementMaxNumber(config, "BLR"),
  };

  async function handleSaveUrl() {
    setSavingUrl(true);
    setUrlMessage(null);
    try {
      await setConfiguration(URL_KEY, spreadsheetUrl || null, "Problem statement spreadsheet URL.");
      setUrlMessage("Saved.");
    } catch (err) {
      setUrlMessage(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSavingUrl(false);
    }
  }

  /** Creates/updates every problem statement this scope should have, matching the currently configured per-campus count. Idempotent — safe to call on both first Go Live and on Unhide (to catch up a count raised while paused). */
  async function syncCatalog() {
    const campusesToRelease = viewerCampus ? [viewerCampus] : CAMPUS_ORDER;
    const codes = campusesToRelease.flatMap((campus) =>
      Array.from({ length: psMax[campus] }, (_, i) => ({ campus, code: problemStatementCode(campus, PS_MIN + i) })),
    );
    const results = await Promise.all(
      codes.map(async ({ campus, code }) => {
        const existing = local.find((p) => p.number === code);
        const id = await upsertProblemStatement({
          id: existing?.id ?? null,
          number: code,
          title: existing?.title || `Problem Statement ${code}`,
          description: existing?.description ?? "",
          status: "Released",
          campus,
        });
        return { id, code, campus, existing };
      }),
    );

    setLocal((prev) => {
      const next = [...prev];
      for (const { id, code, campus, existing } of results) {
        const row: ProblemStatementRow = {
          id,
          number: code,
          title: existing?.title || `Problem Statement ${code}`,
          description: existing?.description ?? null,
          status: "Released",
          campus,
          created_at: existing?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const idx = next.findIndex((p) => p.id === id);
        if (idx >= 0) next[idx] = row;
        else next.push(row);
      }
      return next;
    });
  }

  async function handlePrimaryAction() {
    if (primaryAction === "go-live") {
      const selectionStart = effectiveConfigValue(config, "problem_statement.selection_start", viewerCampus);
      const selectionEnd = effectiveConfigValue(config, "problem_statement.selection_end", viewerCampus);
      if (!selectionStart || !selectionEnd) {
        setActionError("Set the selection window (start & end) in Configuration before going live.");
        return;
      }
      if (!spreadsheetUrl.trim()) {
        setActionError("Add the spreadsheet URL from the \"All\" module before going live.");
        return;
      }
    }
    setBusy(true);
    setActionError(null);
    try {
      if (primaryAction === "go-live") {
        await syncCatalog();
        const nowIso = new Date().toISOString();
        await setConfiguration(writeKeyFor(LIVE_AT_KEY), nowIso, "When problem statements were released (Go Live).");
        setLiveAt(nowIso);
      } else if (primaryAction === "unhide") {
        await syncCatalog();
        await setConfiguration(writeKeyFor(HIDDEN_KEY), false, "Problem statement selection resumed.");
        setHidden(false);
      } else {
        await setConfiguration(writeKeyFor(HIDDEN_KEY), true, "Problem statement selection temporarily paused.");
        setHidden(true);
      }
    } catch (err) {
      setActionError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
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
  // A team's effective deadline: whichever of {global selection end,
  // campus-scoped selection end, this team's extension} was edited most
  // recently wins (0066) — same rule NOC/PPT use.
  function effectiveDeadlineDetailed(teamId: string): { value: string | null; fromIndividualOverride: boolean } {
    const campus = localTeams.find((t) => t.id === teamId)?.campus ?? null;
    const extension = extensionOf(teamId);
    return effectiveProblemStatementEndDetailed(config, campus, extension?.extended_until, extension?.granted_at);
  }
  const deadlineOf = (teamId: string) => effectiveDeadlineDetailed(teamId).value;

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

  const campusOptions = useMemo(() => sortCampuses(Array.from(new Set(localTeams.map((t) => t.campus)))), [localTeams]);

  const visibleTeams = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const filtered = localTeams.filter((team) => {
      const lead = (membersByTeam[team.id] ?? []).find((m) => m.is_lead);
      if (q) {
        const haystack = `${team.team_id} ${team.team_name} ${lead?.name ?? ""} ${lead?.phone ?? ""} ${psNumberOf(team)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.campus && team.campus !== filters.campus) return false;
      if (filters.teamSize && String(sizeOf(team)) !== filters.teamSize) return false;
      if (filters.zone && zoneOf(roomOf(team))?.id !== filters.zone) return false;
      if (filters.room && team.room_id !== filters.room) return false;
      if (filters.spoc && team.spoc_profile_id !== filters.spoc) return false;
      return true;
    });
    return sortByLayout(filtered, {
      singleCampus,
      campusOf: (team) => team.campus,
      zoneNameOf: (team) => zoneOf(roomOf(team))?.name ?? null,
      venueNameOf: (team) => roomOf(team)?.name ?? null,
      spocNameOf: (team) => spocName(team.spoc_profile_id),
      idOf: (team) => team.team_id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTeams, membersByTeam, filters, local, singleCampus]);

  function toggleSelected(teamId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function applyLocalExtension(teamId: string, iso: string) {
    const now = new Date().toISOString();
    setLocalExtensions((prev) => {
      const existing = prev.find((e) => e.team_id === teamId);
      if (existing) return prev.map((e) => (e.team_id === teamId ? { ...e, extended_until: iso, granted_at: now } : e));
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          team_id: teamId,
          extended_until: iso,
          duration_minutes: null,
          reason: null,
          granted_by: "",
          granted_at: now,
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
    const prefix = PROBLEM_STATEMENT_PREFIX[team.campus];
    const max = psMax[team.campus];
    const parsed = parseProblemStatementCode(raw);
    if (!raw || !parsed || parsed.campus !== team.campus || parsed.number < PS_MIN || parsed.number > max) {
      setPsErrors((prev) => ({ ...prev, [team.id]: `Enter a code between ${prefix}${PS_MIN} and ${prefix}${max}.` }));
      return;
    }
    const code = problemStatementCode(team.campus, parsed.number);
    setPsBusy(team.id);
    setPsErrors((prev) => ({ ...prev, [team.id]: "" }));
    try {
      const result = await adminSetProblemStatement(team.id, code);
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
                campus: team.campus,
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
          "Team ID": team.team_id,
          "Team Name": team.team_name,
          "Team Size": String(sizeOf(team)),
          "Team Lead": lead?.name ?? "—",
          "Lead Phone No": lead?.phone ?? "—",
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
  // Each campus's problem statements are numbered independently (V1.., H1..,
  // B1..) so a single merged table would mix unrelated codes together —
  // instead, show one table per campus. Scoped viewers (Campus Admin, SPOC,
  // Zone Manager, or a Super Admin who's selected a campus module) only
  // ever have one campus's teams anyway, so this naturally collapses to a
  // single table for them.
  const analyticsCampuses = singleCampus ? campusOptions : CAMPUS_ORDER;

  const analyticsByCampus = useMemo(() => {
    return analyticsCampuses.map((campus) => {
      const teamsInCampus = localTeams.filter((t) => t.campus === campus);
      const psInCampus = local.filter((p) => p.campus === campus);
      const counts = new Map<string, { number: string; count: number; teamNames: string[] }>();
      for (const ps of psInCampus) {
        counts.set(ps.id, { number: ps.number, count: 0, teamNames: [] });
      }
      for (const team of teamsInCampus) {
        if (!team.current_problem_statement_id) continue;
        const entry = counts.get(team.current_problem_statement_id);
        if (entry) {
          entry.count += 1;
          entry.teamNames.push(team.team_name);
        }
      }
      const rows = Array.from(counts.values()).sort((a, b) => {
        const pa = parseProblemStatementCode(a.number);
        const pb = parseProblemStatementCode(b.number);
        if (pa && pb) return pa.number - pb.number;
        return a.number.localeCompare(b.number);
      });
      const totalSelected = teamsInCampus.filter((t) => t.current_problem_statement_id).length;
      const totalReleased = psInCampus.filter((p) => p.status === "Released").length;
      return { campus, rows, totalSelected, totalTeams: teamsInCampus.length, totalReleased };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, localTeams, singleCampus, campusOptions]);

  const analyticsTotals = {
    totalSelected: analyticsByCampus.reduce((sum, c) => sum + c.totalSelected, 0),
    totalTeams: analyticsByCampus.reduce((sum, c) => sum + c.totalTeams, 0),
    totalReleased: analyticsByCampus.reduce((sum, c) => sum + c.totalReleased, 0),
  };

  return (
    <div className="flex flex-col gap-6">
      {isSuperAdmin ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Problem Statement Spreadsheet URL</span>
          <p className="mt-1 font-heading text-xs text-ink-muted">
            Hidden from Zone Manager, SPOC, Campus Admin, and Team Lead / Member until you click Go Live below.
          </p>
          {viewerCampus && (
            <p className="mt-1 font-heading text-xs text-gold">
              One shared link for all campuses — frozen here. Switch to the &ldquo;All&rdquo; module to change it; Go Live below still
              works independently for {viewerCampus}.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={spreadsheetUrl}
              onChange={(e) => setSpreadsheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/..."
              disabled={!!viewerCampus}
              className="flex-1 rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold disabled:cursor-not-allowed disabled:opacity-60"
            />
            {!viewerCampus && (
              <button
                type="button"
                disabled={savingUrl}
                onClick={handleSaveUrl}
                className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
              >
                {savingUrl ? "Saving…" : "Save"}
              </button>
            )}
          </div>
          {!viewerCampus && urlMessage && <p className="mt-2 font-heading text-xs text-ink-muted">{urlMessage}</p>}

          <div className="mt-5 flex flex-col items-start gap-1.5 border-t border-border pt-5">
            <button
              type="button"
              disabled={busy}
              onClick={handlePrimaryAction}
              className={`rounded-full px-6 py-2.5 font-heading text-sm font-medium transition-colors disabled:opacity-60 ${
                primaryAction === "hide"
                  ? "border border-danger/40 text-danger hover:bg-danger/10"
                  : "bg-gold text-void hover:bg-gold-light"
              }`}
            >
              {busy
                ? "Working…"
                : primaryAction === "go-live"
                  ? `Go Live for ${viewerCampus ?? "All Campuses"}`
                  : primaryAction === "unhide"
                    ? `Unhide for ${viewerCampus ?? "All Campuses"}`
                    : `Hide for ${viewerCampus ?? "All Campuses"}`}
            </button>
            <span className="max-w-md font-heading text-xs text-ink-muted">
              {!isLive
                ? `Not live for ${viewerCampus ?? "all campuses"} yet.`
                : hidden
                  ? `Live since ${fmtDateTime(liveAt ?? effectiveLiveAt)} — currently paused, the sheet link is hidden and no new selections are accepted.`
                  : `Live for ${viewerCampus ?? "all campuses"} since ${fmtDateTime(liveAt ?? effectiveLiveAt)}.`}
            </span>
            {actionError && <p className="font-heading text-xs text-danger">{actionError}</p>}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Problem Statement Sheet</span>
          {campusOverrideBoolean(config, HIDDEN_KEY, viewerCampus) ? (
            <p className="mt-2 font-heading text-xs text-gold">Temporarily paused — check back shortly.</p>
          ) : effectiveLiveAt && spreadsheetUrl ? (
            <>
              <p className="mt-2 font-heading text-sm text-ink">
                <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="text-gold underline">
                  Open the problem statement sheet ↗
                </a>
              </p>
              <p className="mt-1 font-heading text-xs text-ink-muted">Live since {fmtDateTime(effectiveLiveAt)}.</p>
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
                  min={nowDatetimeLocalValue()}
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
              {!singleCampus && (
                <FilterSelect
                  label="Campus"
                  value={filters.campus}
                  onChange={(v) => setFilters((f) => ({ ...f, campus: v }))}
                  options={campusOptions}
                />
              )}
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
                placeholder="Team ID / team name / team lead / lead phone / PS code…"
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
                      <th className="px-4 py-3">Team ID</th>
                      <th className="px-4 py-3">Team Name</th>
                      <th className="px-4 py-3">Team Size</th>
                      <th className="px-4 py-3">Team Lead</th>
                      <th className="px-4 py-3">Lead Phone No</th>
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
                      const psBusyHere = psBusy === team.id;
                      const extendBusyHere = extendBusy === team.id;
                      const { value: currentDeadline, fromIndividualOverride } = effectiveDeadlineDetailed(team.id);
                      const deadlineFieldValue = deadlineDrafts[team.id] ?? toDatetimeLocal(currentDeadline);

                      return (
                        <tr key={team.id} className="border-b border-border align-top last:border-0">
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={selected.has(team.id)} onChange={() => toggleSelected(team.id)} />
                          </td>
                          {!singleCampus && <td className="px-4 py-3 text-ink-muted">{lead?.campus ?? "—"}</td>}
                          <td className="px-4 py-3 text-ink-muted">{team.team_id}</td>
                          <td className="px-4 py-3 text-ink">{team.team_name}</td>
                          <td className="px-4 py-3 text-ink-muted">{sizeOf(team)}</td>
                          <td className="px-4 py-3 text-ink-muted">{lead?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-ink-muted">{lead?.phone ?? "—"}</td>
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
                                    type="text"
                                    value={psDrafts[team.id] ?? psNumberOf(team)}
                                    onChange={(e) => setPsDrafts((prev) => ({ ...prev, [team.id]: e.target.value }))}
                                    placeholder={`${PROBLEM_STATEMENT_PREFIX[team.campus]}${PS_MIN}–${PROBLEM_STATEMENT_PREFIX[team.campus]}${psMax[team.campus]}`}
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
                                Current: {fmtDateTime(currentDeadline)}
                                {currentDeadline && !fromIndividualOverride && " (general)"}
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="datetime-local"
                                  min={nowDatetimeLocalValue()}
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
          <div className="flex flex-col gap-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface p-5">
                <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Teams Selected</span>
                <p className="mt-2 font-display text-3xl text-ink">
                  {analyticsTotals.totalSelected}
                  <span className="ml-2 font-heading text-sm text-ink-muted">of {analyticsTotals.totalTeams}</span>
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-5">
                <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Problem Statements Live</span>
                <p className="mt-2 font-display text-3xl text-ink">{analyticsTotals.totalReleased}</p>
              </div>
            </div>

            {analyticsByCampus.map(({ campus, rows, totalSelected, totalTeams }) => (
              <div key={campus} className="flex flex-col gap-2">
                {!singleCampus && (
                  <span className="font-mono text-xs tracking-[0.2em] text-gold uppercase">
                    {campus} — {totalSelected} of {totalTeams} selected
                  </span>
                )}
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
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-ink-muted">
                            No problem statements released for {campus} yet.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.number} className="border-b border-border align-top last:border-0">
                            <td className="px-4 py-3 text-ink">{row.number}</td>
                            <td className="px-4 py-3 text-ink-muted">{row.count}</td>
                            <td className="px-4 py-3 text-ink-muted">{row.teamNames.length === 0 ? "—" : row.teamNames.join(", ")}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
