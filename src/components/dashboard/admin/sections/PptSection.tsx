"use client";

import { useMemo, useRef, useState } from "react";
import type {
  PresentationRow,
  ProblemStatementRow,
  ProfileRow,
  RoomRow,
  TeamRow,
  ZoneRow,
} from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import {
  deletePresentation,
  deletePresentationFile,
  extendPresentationDeadline,
  getSignedUrl,
  uploadPresentationFile,
  recordPresentation,
  DashboardActionError,
} from "@/lib/dashboard/team-actions";
import { FilterSelect } from "./TeamFormFields";

interface PptFilters {
  search: string;
  campus: string;
  teamSize: string;
  room: string;
  spoc: string;
  status: string; // "" | "Uploaded" | "Not Uploaded"
}

const EMPTY_PPT_FILTERS: PptFilters = { search: "", campus: "", teamSize: "", room: "", spoc: "", status: "" };

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Presentation (PPT) tracker — one row per team, matching the admin NOC Teams table's format. Files must be a PDF under 16MB, uploaded by the Team Lead only. */
export function PptSection({
  teams,
  membersByTeam,
  presentations,
  rooms,
  zones,
  staffAccounts,
  problemStatements,
  scope,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  presentations: PresentationRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  problemStatements: ProblemStatementRow[];
  scope: "spoc" | "admin";
}) {
  const [localPresentations, setLocalPresentations] = useState(presentations);
  const [filters, setFilters] = useState<PptFilters>(EMPTY_PPT_FILTERS);

  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<string, string>>({});
  const [deadlineBusy, setDeadlineBusy] = useState<string | null>(null);
  const [deadlineErrors, setDeadlineErrors] = useState<Record<string, string>>({});

  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const uploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const psOf = (team: TeamRow) => problemStatements.find((p) => p.id === team.current_problem_statement_id) ?? null;

  async function handleAdminUpload(teamId: string, file: File) {
    if (file.type !== "application/pdf") {
      setRowErrors((prev) => ({ ...prev, [teamId]: "Only PDF files are allowed." }));
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      setRowErrors((prev) => ({ ...prev, [teamId]: "File exceeds the 16MB limit." }));
      return;
    }
    setRowBusy(teamId);
    setRowErrors((prev) => ({ ...prev, [teamId]: "" }));
    try {
      const path = await uploadPresentationFile(teamId, file);
      await recordPresentation(teamId, path);
      setLocalPresentations((prev) => {
        const exists = prev.find((p) => p.team_id === teamId);
        return exists
          ? prev.map((p) => (p.team_id === teamId ? { ...p, status: "Uploaded", file_path: path } : p))
          : [
              ...prev,
              {
                id: crypto.randomUUID(),
                team_id: teamId,
                file_path: path,
                status: "Uploaded",
                uploaded_by: null,
                uploaded_at: new Date().toISOString(),
                deadline: null,
              } as PresentationRow,
            ];
      });
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [teamId]: err instanceof DashboardActionError ? err.message : "Something went wrong.",
      }));
    } finally {
      setRowBusy(null);
    }
  }

  async function handleExtendDeadline(teamId: string) {
    const presentation = localPresentations.find((p) => p.team_id === teamId);
    const value = deadlineDrafts[teamId] ?? toDatetimeLocal(presentation?.deadline);
    if (!value) return;
    setDeadlineBusy(teamId);
    setDeadlineErrors((prev) => ({ ...prev, [teamId]: "" }));
    try {
      const deadlineIso = new Date(value).toISOString();
      await extendPresentationDeadline(teamId, deadlineIso);
      setLocalPresentations((prev) => {
        const exists = prev.find((p) => p.team_id === teamId);
        return exists
          ? prev.map((p) => (p.team_id === teamId ? { ...p, deadline: deadlineIso } : p))
          : [
              ...prev,
              {
                id: crypto.randomUUID(),
                team_id: teamId,
                file_path: null,
                status: "Not Uploaded",
                uploaded_by: null,
                uploaded_at: null,
                deadline: deadlineIso,
              } as PresentationRow,
            ];
      });
    } catch (err) {
      setDeadlineErrors((prev) => ({
        ...prev,
        [teamId]: err instanceof DashboardActionError ? err.message : "Something went wrong.",
      }));
    } finally {
      setDeadlineBusy(null);
    }
  }

  async function handleView(teamId: string) {
    const presentation = localPresentations.find((p) => p.team_id === teamId);
    if (!presentation?.file_path) return;
    const url = await getSignedUrl("ppt-uploads", presentation.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(teamId: string) {
    const presentation = localPresentations.find((p) => p.team_id === teamId);
    if (!presentation?.file_path) return;
    if (!window.confirm("Delete this team's presentation?")) return;
    setRowBusy(teamId);
    setRowErrors((prev) => ({ ...prev, [teamId]: "" }));
    try {
      await deletePresentationFile(presentation.file_path);
      await deletePresentation(teamId);
      setLocalPresentations((prev) =>
        prev.map((p) => (p.team_id === teamId ? { ...p, status: "Not Uploaded", file_path: null } : p)),
      );
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [teamId]: err instanceof DashboardActionError ? err.message : "Something went wrong.",
      }));
    } finally {
      setRowBusy(null);
    }
  }

  const campusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          teams
            .map((t) => (membersByTeam[t.id] ?? []).find((m) => m.is_lead)?.campus)
            .filter((c): c is NonNullable<typeof c> => Boolean(c)),
        ),
      ),
    [teams, membersByTeam],
  );

  const visibleTeams = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return teams.filter((team) => {
      const members = membersByTeam[team.id] ?? [];
      const lead = members.find((m) => m.is_lead);
      const status = localPresentations.find((p) => p.team_id === team.id)?.status ?? "Not Uploaded";

      if (q) {
        const haystack = `${team.team_name} ${lead?.name ?? ""} ${lead?.phone ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.campus && lead?.campus !== filters.campus) return false;
      if (filters.teamSize && String(team.member_count) !== filters.teamSize) return false;
      if (filters.room && team.room_id !== filters.room) return false;
      if (filters.spoc && team.spoc_profile_id !== filters.spoc) return false;
      if (filters.status && status !== filters.status) return false;
      return true;
    });
  }, [teams, membersByTeam, filters, localPresentations]);

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">
          {scope === "admin" ? "No teams registered yet." : "No teams assigned to you yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-heading text-xs text-ink-muted">
        PPT files must be a PDF under 16MB. Only the Team Lead can upload.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-4">
        <FilterSelect label="Campus" value={filters.campus} onChange={(v) => setFilters((f) => ({ ...f, campus: v }))} options={campusOptions} />
        <FilterSelect
          label="Team Size"
          value={filters.teamSize}
          onChange={(v) => setFilters((f) => ({ ...f, teamSize: v }))}
          options={["3", "4"]}
        />
        <FilterSelect
          label="Venue"
          value={filters.room}
          onChange={(v) => setFilters((f) => ({ ...f, room: v }))}
          options={rooms.map((r) => r.name)}
          valueOptions={rooms.map((r) => r.id)}
        />
        <FilterSelect
          label="SPOC"
          value={filters.spoc}
          onChange={(v) => setFilters((f) => ({ ...f, spoc: v }))}
          options={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.name)}
          valueOptions={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.id)}
        />
        <FilterSelect
          label="PPT Status"
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={["Uploaded", "Not Uploaded"]}
        />
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Team name / team lead / lead phone…"
          className="min-w-[180px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
      </div>

      <p className="font-heading text-xs text-ink-muted">Showing {visibleTeams.length} teams</p>

      <div>
        {visibleTeams.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-heading text-sm text-ink-muted">No teams match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left font-heading text-sm">
              <thead>
                <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                  <th className="px-4 py-3">Campus</th>
                  <th className="px-4 py-3">Team Name</th>
                  <th className="px-4 py-3">Team Lead</th>
                  <th className="px-4 py-3">Lead Phone No</th>
                  <th className="px-4 py-3">Team Size</th>
                  <th className="px-4 py-3">Venue</th>
                  <th className="px-4 py-3">SPOC</th>
                  <th className="px-4 py-3">PS Code</th>
                  <th className="px-4 py-3">PPT Status</th>
                  <th className="px-4 py-3">PPT Link</th>
                  {scope === "admin" && <th className="px-4 py-3">Admin Upload</th>}
                  <th className="px-4 py-3">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {visibleTeams.map((team) => {
                  const members = membersByTeam[team.id] ?? [];
                  const lead = members.find((m) => m.is_lead);
                  const presentation = localPresentations.find((p) => p.team_id === team.id);
                  const room = roomOf(team);
                  const zone = zoneOf(room);
                  const venue = room ? (zone ? `${room.name} (${zone.name})` : room.name) : "Unassigned";
                  const ps = psOf(team);
                  const uploaded = presentation?.status === "Uploaded" && presentation.file_path;
                  const currentDeadline = presentation?.deadline ?? null;
                  const expired = !!currentDeadline && new Date(currentDeadline) < new Date();
                  const deadlineBusyHere = deadlineBusy === team.id;
                  const deadlineError = deadlineErrors[team.id];
                  const rowBusyHere = rowBusy === team.id;
                  const rowError = rowErrors[team.id];

                  return (
                    <tr key={team.id} className="border-b border-border bg-surface align-top last:border-0">
                      <td className="px-4 py-3 text-ink-muted">{lead?.campus ?? "—"}</td>
                      <td className="px-4 py-3 text-ink">
                        {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{lead?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-muted">{lead?.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-muted">{team.member_count}</td>
                      <td className="px-4 py-3 text-ink-muted">{venue}</td>
                      <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                      <td className="px-4 py-3 text-ink-muted">{ps?.number ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={uploaded ? "text-gitam" : "text-gold"}>
                          {presentation?.status ?? "Not Uploaded"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {uploaded ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleView(team.id)}
                                className="text-gold underline"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                disabled={rowBusyHere}
                                onClick={() => handleDelete(team.id)}
                                className="text-danger underline disabled:opacity-60"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            "—"
                          )}
                          {rowError && <span className="w-full font-heading text-[11px] text-danger">{rowError}</span>}
                        </div>
                      </td>
                      {scope === "admin" && (
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <input
                              ref={(el) => {
                                uploadInputRefs.current[team.id] = el;
                              }}
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleAdminUpload(team.id, file);
                                e.target.value = "";
                              }}
                            />
                            <button
                              type="button"
                              disabled={rowBusyHere}
                              onClick={() => uploadInputRefs.current[team.id]?.click()}
                              className="w-fit rounded-full bg-gold px-3 py-1 font-heading text-[11px] font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
                            >
                              {rowBusyHere ? "Uploading…" : uploaded ? "Replace" : "Upload"}
                            </button>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`font-heading text-[11px] ${expired ? "text-danger" : "text-ink-muted"}`}>
                            Current:{" "}
                            {currentDeadline
                              ? new Date(currentDeadline).toLocaleString("en-IN", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : "Not set"}
                            {expired && " — Time exceeded"}
                          </span>
                          <input
                            type="datetime-local"
                            value={deadlineDrafts[team.id] ?? toDatetimeLocal(currentDeadline)}
                            onChange={(e) => setDeadlineDrafts((prev) => ({ ...prev, [team.id]: e.target.value }))}
                            className="rounded-lg border border-border bg-void px-2 py-1 font-heading text-xs text-ink outline-none focus:border-gold"
                          />
                          <button
                            type="button"
                            disabled={deadlineBusyHere || !(deadlineDrafts[team.id] ?? toDatetimeLocal(currentDeadline))}
                            onClick={() => handleExtendDeadline(team.id)}
                            className="w-fit rounded-full border border-gold/50 px-3 py-1 font-heading text-[11px] font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
                          >
                            {deadlineBusyHere ? "Saving…" : currentDeadline ? "Update" : "Set Deadline"}
                          </button>
                          {deadlineError && <span className="font-heading text-[11px] text-danger">{deadlineError}</span>}
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
    </div>
  );
}
