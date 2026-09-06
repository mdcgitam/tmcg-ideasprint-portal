"use client";

import { useMemo, useState } from "react";
import type { ExitRequestRow, NocRow, ProblemStatementRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { extendNocDeadline, DashboardActionError } from "@/lib/dashboard/team-actions";
import { downloadCsv } from "@/lib/csv";
import { FilterSelect } from "./TeamFormFields";
import { TeamDetailModal } from "./TeamDetailModal";

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Teams" view of the NOC page (NOC1/NOC2 reference) — one row per team. Attendance lives on the Attendance page only, not duplicated here. */
export function NocTeamsView({
  teams,
  membersByTeam,
  nocs,
  rooms,
  zones,
  staffAccounts,
  problemStatements,
  exitRequests,
  scope,
  onTeamRenamed,
  onTeamDeleted,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  nocs: NocRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  problemStatements: ProblemStatementRow[];
  exitRequests: ExitRequestRow[];
  scope: "spoc" | "admin";
  onTeamRenamed: (teamId: string, name: string) => void;
  onTeamDeleted: (teamId: string) => void;
}) {
  const [localNocs, setLocalNocs] = useState(nocs);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeadline, setBulkDeadline] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);

  const [campusFilter, setCampusFilter] = useState("");
  const [teamSizeFilter, setTeamSizeFilter] = useState("");
  const [venueFilter, setVenueFilter] = useState("");
  const [spocFilter, setSpocFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [rowDeadlines, setRowDeadlines] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const psOf = (team: TeamRow) => problemStatements.find((p) => p.id === team.current_problem_statement_id) ?? null;

  function uploadedCount(team: TeamRow) {
    const members = membersByTeam[team.id] ?? [];
    return members.filter((m) => localNocs.find((n) => n.profile_id === m.id)?.status === "Uploaded").length;
  }

  /** A team's deadline is only well-defined when every member shares the same value — otherwise shown as "Mixed" so nobody mistakes one member's deadline for the whole team's. */
  function teamDeadline(team: TeamRow): { display: string; iso: string | null; mixed: boolean; expired: boolean } {
    const members = membersByTeam[team.id] ?? [];
    const deadlines = members.map((m) => localNocs.find((n) => n.profile_id === m.id)?.deadline ?? null);
    const allSame = deadlines.every((d) => d === deadlines[0]);
    const anyExpired = deadlines.some((d) => d && new Date(d) < new Date());
    if (members.length === 0) return { display: "—", iso: null, mixed: false, expired: false };
    if (!allSame) return { display: "Mixed", iso: null, mixed: true, expired: anyExpired };
    const iso = deadlines[0];
    if (!iso) return { display: "Not set", iso: null, mixed: false, expired: false };
    return {
      display: new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      iso,
      mixed: false,
      expired: anyExpired,
    };
  }

  const campusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          teams
            .map((t) => (membersByTeam[t.id] ?? []).find((m) => m.is_lead)?.campus)
            .filter((c): c is string => Boolean(c)),
        ),
      ),
    [teams, membersByTeam],
  );

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((team) => {
      const members = membersByTeam[team.id] ?? [];
      const lead = members.find((m) => m.is_lead);

      if (q) {
        const haystack = `${team.team_name} ${lead?.name ?? ""} ${lead?.phone ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (campusFilter && lead?.campus !== campusFilter) return false;
      if (teamSizeFilter && String(team.member_count) !== teamSizeFilter) return false;
      if (venueFilter && team.room_id !== venueFilter) return false;
      if (spocFilter && team.spoc_profile_id !== spocFilter) return false;
      if (statusFilter) {
        const complete = uploadedCount(team) === members.length && members.length > 0;
        if (statusFilter === "completed" && !complete) return false;
        if (statusFilter === "pending" && complete) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, membersByTeam, search, campusFilter, teamSizeFilter, venueFilter, spocFilter, statusFilter, localNocs]);

  function toggleSelected(teamId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  async function handleBulkExtend() {
    if (!bulkDeadline || selected.size === 0) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      const deadlineIso = new Date(bulkDeadline).toISOString();
      const profileIds = Array.from(selected).flatMap((teamId) => (membersByTeam[teamId] ?? []).map((m) => m.id));
      await Promise.all(profileIds.map((id) => extendNocDeadline(id, deadlineIso)));
      setLocalNocs((prev) => {
        const touched = new Set(profileIds);
        const updated = prev.map((n) => (touched.has(n.profile_id) ? { ...n, deadline: deadlineIso } : n));
        const missing = profileIds.filter((id) => !prev.some((n) => n.profile_id === id));
        return [
          ...updated,
          ...missing.map((id) => ({ profile_id: id, status: "Not Uploaded", file_path: null, deadline: deadlineIso }) as NocRow),
        ];
      });
      setSelected(new Set());
      setBulkDeadline("");
    } catch (err) {
      setBulkError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleRowExtend(team: TeamRow) {
    const value = rowDeadlines[team.id] ?? toDatetimeLocal(teamDeadline(team).iso);
    if (!value) return;
    setRowBusy(team.id);
    setRowErrors((prev) => ({ ...prev, [team.id]: "" }));
    try {
      const deadlineIso = new Date(value).toISOString();
      const profileIds = (membersByTeam[team.id] ?? []).map((m) => m.id);
      await Promise.all(profileIds.map((id) => extendNocDeadline(id, deadlineIso)));
      setLocalNocs((prev) => {
        const touched = new Set(profileIds);
        const updated = prev.map((n) => (touched.has(n.profile_id) ? { ...n, deadline: deadlineIso } : n));
        const missing = profileIds.filter((id) => !prev.some((n) => n.profile_id === id));
        return [
          ...updated,
          ...missing.map((id) => ({ profile_id: id, status: "Not Uploaded", file_path: null, deadline: deadlineIso }) as NocRow),
        ];
      });
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [team.id]: err instanceof DashboardActionError ? err.message : "Something went wrong.",
      }));
    } finally {
      setRowBusy(null);
    }
  }

  function handleExportCsv() {
    downloadCsv(
      "noc-teams",
      filteredTeams.map((team) => {
        const members = membersByTeam[team.id] ?? [];
        const lead = members.find((m) => m.is_lead);
        return {
          Campus: lead?.campus ?? "—",
          "Team Name": team.team_name,
          "Team Lead": lead?.name ?? "—",
          "Team Size": String(team.member_count),
          Venue: roomOf(team)?.name ?? "Unassigned",
          SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
          "No. of Uploads": `${uploadedCount(team)}/${members.length}`,
          Status: uploadedCount(team) === members.length && members.length > 0 ? "Completed" : "Pending",
          Deadline: teamDeadline(team).display,
        };
      }),
    );
  }

  const openTeam = teams.find((t) => t.id === openTeamId) ?? null;

  return (
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
            onClick={handleExportCsv}
            className="rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Export CSV
          </button>
          <span className="font-heading text-xs text-ink-muted">Selected: {selected.size} team(s)</span>
        </div>
        {bulkError && <p className="font-heading text-xs text-danger">{bulkError}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-4">
        <FilterSelect label="Campus" value={campusFilter} onChange={setCampusFilter} options={campusOptions} />
        <FilterSelect label="Team Size" value={teamSizeFilter} onChange={setTeamSizeFilter} options={["3", "4"]} />
        <FilterSelect
          label="Venue"
          value={venueFilter}
          onChange={setVenueFilter}
          options={rooms.map((r) => r.name)}
          valueOptions={rooms.map((r) => r.id)}
        />
        <FilterSelect
          label="SPOC"
          value={spocFilter}
          onChange={setSpocFilter}
          options={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.name)}
          valueOptions={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.id)}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={["Completed", "Pending"]}
          valueOptions={["completed", "pending"]}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Team name / team lead / lead phone…"
          className="min-w-[180px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
      </div>

      <p className="font-heading text-xs text-ink-muted">Showing {filteredTeams.length} teams</p>

      {filteredTeams.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No teams match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                <th className="px-4 py-3" />
                <th className="px-4 py-3">Campus</th>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-4 py-3">Team Lead</th>
                <th className="px-4 py-3">Lead Phone No</th>
                <th className="px-4 py-3">Team Size</th>
                <th className="px-4 py-3">Venue</th>
                <th className="px-4 py-3">SPOC</th>
                <th className="px-4 py-3">No. of Uploads</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Open</th>
                <th className="px-4 py-3">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((team) => {
                const members = membersByTeam[team.id] ?? [];
                const lead = members.find((m) => m.is_lead);
                const complete = uploadedCount(team) === members.length && members.length > 0;
                const deadline = teamDeadline(team);
                const busy = rowBusy === team.id;
                const rowError = rowErrors[team.id];
                return (
                  <tr key={team.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(team.id)}
                        onChange={() => toggleSelected(team.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{lead?.campus ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">
                      {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{lead?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{lead?.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{team.member_count}</td>
                    <td className="px-4 py-3 text-ink-muted">{roomOf(team)?.name ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {uploadedCount(team)}/{members.length}
                    </td>
                    <td className="px-4 py-3">
                      <span className={complete ? "text-gitam" : "text-gold"}>{complete ? "Completed" : "Pending"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setOpenTeamId(team.id)} className="text-gold underline">
                        Open
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`font-heading text-[11px] ${deadline.expired ? "text-danger" : "text-ink-muted"}`}>
                          {deadline.display}
                          {deadline.expired && " — Time exceeded"}
                        </span>
                        <input
                          type="datetime-local"
                          value={rowDeadlines[team.id] ?? toDatetimeLocal(deadline.iso)}
                          onChange={(e) => setRowDeadlines((prev) => ({ ...prev, [team.id]: e.target.value }))}
                          className="rounded-lg border border-border bg-void px-2 py-1 font-heading text-xs text-ink outline-none focus:border-gold"
                        />
                        <button
                          type="button"
                          disabled={busy || !(rowDeadlines[team.id] ?? toDatetimeLocal(deadline.iso))}
                          onClick={() => handleRowExtend(team)}
                          className="w-fit rounded-full border border-gold/50 px-3 py-1 font-heading text-[11px] font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
                        >
                          {busy ? "Saving…" : deadline.iso || deadline.mixed ? "Update" : "Set"}
                        </button>
                        {rowError && <span className="font-heading text-[11px] text-danger">{rowError}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openTeam && (
        <TeamDetailModal
          team={openTeam}
          members={membersByTeam[openTeam.id] ?? []}
          room={roomOf(openTeam)}
          zone={zoneOf(roomOf(openTeam))}
          ps={psOf(openTeam)}
          exitRequests={exitRequests}
          nocs={localNocs}
          spocName={spocName(openTeam.spoc_profile_id)}
          scope={scope}
          onTeamRenamed={onTeamRenamed}
          onTeamDeleted={(teamId) => {
            setOpenTeamId(null);
            onTeamDeleted(teamId);
          }}
          onClose={() => setOpenTeamId(null)}
        />
      )}
    </div>
  );
}
