"use client";

import { useState } from "react";
import type { PresentationRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { extendPresentationDeadline, DashboardActionError } from "@/lib/dashboard/team-actions";
import { PresentationStatus } from "./PresentationStatus";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "all" | "missing";

/** Presentation (PPT) tracker, grouped by team, matching the admin NOC page's format. Files must be a PDF under 16MB, uploaded by the Team Lead only. */
export function PptSection({
  teams,
  membersByTeam,
  presentations,
  rooms,
  zones,
  staffAccounts,
  scope,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  presentations: PresentationRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  scope: "spoc" | "admin";
}) {
  const [localPresentations, setLocalPresentations] = useState(presentations);
  const [view, setView] = useState<View>("all");
  const fadeRef = useTabFade(view);
  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<string, string>>({});
  const [deadlineBusy, setDeadlineBusy] = useState<string | null>(null);
  const [deadlineErrors, setDeadlineErrors] = useState<Record<string, string>>({});

  function toDatetimeLocal(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">
          {scope === "admin" ? "No teams registered yet." : "No teams assigned to you yet."}
        </p>
      </div>
    );
  }

  const visibleTeams =
    view === "all"
      ? teams
      : teams.filter((t) => localPresentations.find((p) => p.team_id === t.id)?.status !== "Uploaded");

  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;

  return (
    <div className="flex flex-col gap-4">
      <p className="font-heading text-xs text-ink-muted">
        PPT files must be a PDF under 16MB. Only the Team Lead can upload.
      </p>

      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "all", label: "All Teams" },
          { value: "missing", label: "Missing Only" },
        ]}
      />

      <div ref={fadeRef} className="flex flex-col gap-3">
        {visibleTeams.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-heading text-sm text-ink-muted">Every team&rsquo;s presentation is uploaded.</p>
          </div>
        ) : (
          visibleTeams.map((team) => {
            const members = membersByTeam[team.id] ?? [];
            const presentation = localPresentations.find((p) => p.team_id === team.id);
            const lead = members.find((m) => m.is_lead);
            const room = roomOf(team);
            const zone = zoneOf(room);
            const venue = room ? (zone ? `${room.name} (${zone.name})` : room.name) : "Unassigned";
            const currentDeadline = presentation?.deadline ?? null;
            const expired = !!currentDeadline && new Date(currentDeadline) < new Date();
            const deadlineBusyHere = deadlineBusy === team.id;
            const deadlineError = deadlineErrors[team.id];

            return (
              <div
                key={team.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
              >
                <div>
                  <p className="font-heading text-sm text-ink">
                    {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                  </p>
                  <p className="mt-1 font-heading text-xs text-ink-muted">Lead: {lead?.name ?? "—"}</p>
                  <p className="mt-1 font-heading text-xs text-ink-muted">Venue: {venue}</p>
                  {scope === "admin" && (
                    <p className="mt-1 font-heading text-xs text-ink-muted">
                      SPOC: {spocName(team.spoc_profile_id) ?? "Unassigned"}
                    </p>
                  )}
                  <p className={`mt-1 font-heading text-xs ${expired ? "text-danger" : "text-ink-faint"}`}>
                    Deadline:{" "}
                    {currentDeadline
                      ? new Date(currentDeadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                      : "Not set"}
                    {expired && " — Time exceeded"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
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
                      className="rounded-full border border-gold/50 px-3 py-1 font-heading text-[11px] font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
                    >
                      {deadlineBusyHere ? "Saving…" : currentDeadline ? "Update" : "Set Deadline"}
                    </button>
                  </div>
                  {deadlineError && <p className="mt-1 font-heading text-[11px] text-danger">{deadlineError}</p>}
                </div>
                <PresentationStatus
                  teamId={team.id}
                  presentation={presentation}
                  onDeleted={() =>
                    setLocalPresentations((prev) =>
                      prev.map((p) => (p.team_id === team.id ? { ...p, status: "Not Uploaded", file_path: null } : p)),
                    )
                  }
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
