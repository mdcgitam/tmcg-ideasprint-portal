"use client";

import { useMemo, useState } from "react";
import type { ExitRequestRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { resolveMemberExit, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { getSignedUrl } from "@/lib/dashboard/team-actions";
import { sortCampuses } from "@/lib/dashboard/campus-config";
import { FilterSelect } from "./TeamFormFields";

/** "Teams" view of Exit Requests — one card per team that has any exit-request activity, every member's status inline. */
export function ExitTeamsView({
  teams,
  membersByTeam,
  exitRequests,
  rooms,
  zones,
  staffAccounts,
  singleCampus = false,
  hideZoneFilters = false,
  hideVenueFilter = false,
  hideSpocFilter = false,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  exitRequests: ExitRequestRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  singleCampus?: boolean;
  hideZoneFilters?: boolean;
  hideVenueFilter?: boolean;
  hideSpocFilter?: boolean;
}) {
  const [localRequests, setLocalRequests] = useState(exitRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [campusFilter, setCampusFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [venueFilter, setVenueFilter] = useState("");
  const [spocFilter, setSpocFilter] = useState("");
  const [search, setSearch] = useState("");

  const leadOf = (team: TeamRow) => (membersByTeam[team.id] ?? []).find((m) => m.is_lead) ?? null;
  const campusOf = (team: TeamRow) => leadOf(team)?.campus ?? team.campus;
  const roomOf = (team: TeamRow) => (team.room_id ? (rooms.find((r) => r.id === team.room_id) ?? null) : null);
  const zoneOf = (team: TeamRow) => {
    const room = roomOf(team);
    return room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null;
  };
  const spocName = (team: TeamRow) => (team.spoc_profile_id ? (staffAccounts.find((s) => s.id === team.spoc_profile_id)?.name ?? null) : null);

  const teamsWithActivity = useMemo(() => {
    const teamIds = new Set(localRequests.map((r) => r.team_id));
    return teams.filter((t) => teamIds.has(t.id));
  }, [teams, localRequests]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const campusOptions = useMemo(() => sortCampuses(Array.from(new Set(teamsWithActivity.map(campusOf)))), [teamsWithActivity]);

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teamsWithActivity.filter((t) => {
      if (q && !`${t.team_name} ${t.team_id}`.toLowerCase().includes(q)) return false;
      if (campusFilter && campusOf(t) !== campusFilter) return false;
      if (zoneFilter && zoneOf(t)?.id !== zoneFilter) return false;
      if (venueFilter && t.room_id !== venueFilter) return false;
      if (spocFilter && t.spoc_profile_id !== spocFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsWithActivity, search, campusFilter, zoneFilter, venueFilter, spocFilter]);

  async function handleResolve(requestId: string, decision: "Approved" | "Rejected") {
    setBusyId(requestId);
    setError(null);
    try {
      await resolveMemberExit(requestId, decision);
      setLocalRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: decision, reviewed_at: new Date().toISOString() } : r)),
      );
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleView(filePath: string) {
    const url = await getSignedUrl("exit-requests", filePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  if (teamsWithActivity.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">No exit form activity yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!singleCampus && (
          <FilterSelect label="Campus" value={campusFilter} onChange={setCampusFilter} options={campusOptions} valueOptions={campusOptions} />
        )}
        {!hideZoneFilters && (
          <FilterSelect
            label="Zone"
            value={zoneFilter}
            onChange={setZoneFilter}
            options={zones.map((z) => z.name)}
            valueOptions={zones.map((z) => z.id)}
          />
        )}
        {!hideVenueFilter && (
          <FilterSelect
            label="Venue"
            value={venueFilter}
            onChange={setVenueFilter}
            options={rooms.map((r) => r.name)}
            valueOptions={rooms.map((r) => r.id)}
          />
        )}
        {!hideSpocFilter && (
          <FilterSelect
            label="SPOC"
            value={spocFilter}
            onChange={setSpocFilter}
            options={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.name)}
            valueOptions={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.id)}
          />
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team…"
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
      </div>

      {error && <p className="font-heading text-sm text-danger">{error}</p>}

      {filteredTeams.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No teams match the current filters.</p>
        </div>
      ) : (
        filteredTeams.map((team) => {
          const members = membersByTeam[team.id] ?? [];
          const activeMembers = members.filter((m) => m.is_active);
          const requestFor = (profileId: string) =>
            localRequests
              .filter((r) => r.profile_id === profileId)
              .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())[0] ?? null;
          const exitingCount = activeMembers.filter((m) => {
            const r = requestFor(m.id);
            return r && (r.status === "Requested" || r.status === "Approved");
          }).length;
          const dissolving = activeMembers.length <= 3 && exitingCount > 0;

          return (
            <div key={team.id} className="rounded-xl border border-border bg-surface p-6">
              <div className="flex flex-col gap-1">
                <p className="font-heading text-sm text-gold">{team.team_name}</p>
                <p className="font-heading text-xs text-ink-muted">
                  Campus: {campusOf(team)} · Zone: {zoneOf(team)?.name ?? "Unassigned"} · Venue:{" "}
                  {roomOf(team)?.name ?? "Unassigned"} · SPOC: {spocName(team) ?? "Unassigned"} · Team Lead:{" "}
                  {leadOf(team)?.name ?? "—"}
                </p>
              </div>

              {dissolving && (
                <p className="mt-3 rounded-lg border border-gold/40 bg-gold/5 px-4 py-2 font-heading text-xs text-gold">
                  {exitingCount} of {activeMembers.length} active members have an exit request in progress —
                  approving any one of them requires every active member to also be exiting.
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2">
                {members.map((m) => {
                  const req = requestFor(m.id);
                  const busy = req ? busyId === req.id : false;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-void/40 px-4 py-3 ${m.is_active ? "" : "opacity-60"}`}
                    >
                      <div>
                        <p className="font-heading text-sm text-ink">
                          {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                          {!m.is_active && <span className="ml-1 text-xs text-danger">(Inactive)</span>}
                        </p>
                        <p
                          className={`mt-0.5 font-heading text-xs ${
                            req?.status === "Approved" ? "text-danger" : req?.status === "Requested" ? "text-gold" : "text-ink-faint"
                          }`}
                        >
                          {req?.status ?? "No Request"}
                          {req?.reason && ` · ${req.reason}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {req?.file_path && (
                          <button type="button" onClick={() => handleView(req.file_path!)} className="font-heading text-xs text-gold underline">
                            View Form
                          </button>
                        )}
                        {req?.status === "Requested" && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleResolve(req.id, "Approved")}
                              className="rounded-full bg-gitam px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:opacity-90 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleResolve(req.id, "Rejected")}
                              className="rounded-full border border-danger/40 px-4 py-1.5 font-heading text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
