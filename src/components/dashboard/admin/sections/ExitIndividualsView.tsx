"use client";

import { useMemo, useState } from "react";
import type { ExitRequestRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { resolveMemberExit, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { getSignedUrl } from "@/lib/dashboard/team-actions";
import { sortCampuses } from "@/lib/dashboard/campus-config";
import { downloadCsv } from "@/lib/csv";
import { canApproveExit } from "@/lib/dashboard/exit-eligibility";
import { FilterSelect } from "./TeamFormFields";

const STATUS_OPTIONS = ["Requested", "Approved", "Rejected"];

/** "Participants" view of Exit Requests — one row per exit request, flat and filterable. */
export function ExitIndividualsView({
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
  const [statusFilter, setStatusFilter] = useState("Requested");
  const [search, setSearch] = useState("");

  function memberOf(req: ExitRequestRow): TeamMemberProfile | null {
    return (membersByTeam[req.team_id] ?? []).find((m) => m.id === req.profile_id) ?? null;
  }
  function teamOf(req: ExitRequestRow): TeamRow | null {
    return teams.find((t) => t.id === req.team_id) ?? null;
  }
  function roomOf(team: TeamRow | null) {
    return team?.room_id ? (rooms.find((r) => r.id === team.room_id) ?? null) : null;
  }
  function zoneOf(team: TeamRow | null) {
    const room = roomOf(team);
    return room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null;
  }
  function zoneManagerNameOf(team: TeamRow | null) {
    const zm = zoneOf(team)?.zone_manager_profile_id;
    return zm ? (staffAccounts.find((s) => s.id === zm)?.name ?? null) : null;
  }
  function spocNameOf(team: TeamRow | null) {
    return team?.spoc_profile_id ? (staffAccounts.find((s) => s.id === team.spoc_profile_id)?.name ?? null) : null;
  }
  /** Most recent request for a profile (open or resolved), same recency rule as everywhere else in this module. */
  function currentRequestFor(profileId: string): ExitRequestRow | null {
    return (
      localRequests
        .filter((r) => r.profile_id === profileId)
        .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())[0] ?? null
    );
  }

  const campusOptions = useMemo(
    () => sortCampuses(Array.from(new Set(localRequests.map((r) => memberOf(r)?.campus).filter((c): c is NonNullable<typeof c> => Boolean(c))))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localRequests, membersByTeam],
  );

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return localRequests.filter((r) => {
      const member = memberOf(r);
      const team = teamOf(r);
      if (statusFilter && r.status !== statusFilter) return false;
      if (q && !`${member?.name ?? ""} ${team?.team_name ?? ""} ${team?.team_id ?? ""}`.toLowerCase().includes(q)) return false;
      if (campusFilter && member?.campus !== campusFilter) return false;
      if (zoneFilter && zoneOf(team)?.id !== zoneFilter) return false;
      if (venueFilter && team?.room_id !== venueFilter) return false;
      if (spocFilter && team?.spoc_profile_id !== spocFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localRequests, search, statusFilter, campusFilter, zoneFilter, venueFilter, spocFilter]);

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

  if (localRequests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">No exit form activity yet.</p>
      </div>
    );
  }

  const columnCount = 6 + (singleCampus ? 0 : 1) + (hideZoneFilters ? 0 : 2) + (hideVenueFilter ? 0 : 1) + (hideSpocFilter ? 0 : 1) + 3;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!singleCampus && (
          <FilterSelect label="Campus" value={campusFilter} onChange={setCampusFilter} options={campusOptions} valueOptions={campusOptions} />
        )}
        {!hideZoneFilters && (
          <FilterSelect label="Zone" value={zoneFilter} onChange={setZoneFilter} options={zones.map((z) => z.name)} valueOptions={zones.map((z) => z.id)} />
        )}
        {!hideVenueFilter && (
          <FilterSelect label="Venue" value={venueFilter} onChange={setVenueFilter} options={rooms.map((r) => r.name)} valueOptions={rooms.map((r) => r.id)} />
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
        <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} valueOptions={STATUS_OPTIONS} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or team…"
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "exit-requests",
              filteredRequests.map((r) => {
                const member = memberOf(r);
                const team = teamOf(r);
                return {
                  Campus: member?.campus ?? "—",
                  Team: team?.team_name ?? "—",
                  Participant: member?.name ?? "—",
                  Position: member?.is_lead ? "Team Lead" : "Member",
                  "Reg No": member?.reg_no ?? "—",
                  Email: member?.gitam_email ?? "—",
                  Phone: member?.phone ?? "—",
                  Zone: zoneOf(team)?.name ?? "—",
                  "Zone Manager": zoneManagerNameOf(team) ?? "—",
                  Venue: roomOf(team)?.name ?? "—",
                  SPOC: spocNameOf(team) ?? "—",
                  Status: r.status,
                  "Requested At": r.requested_at,
                  "Reviewed At": r.reviewed_at ?? "—",
                };
              }),
            )
          }
          className="w-fit rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
        >
          Download CSV
        </button>
      </div>

      {error && <p className="font-heading text-sm text-danger">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                {!singleCampus && <th className="px-4 py-3">Campus</th>}
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Reg No</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                {!hideZoneFilters && (
                  <>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Zone Manager</th>
                  </>
                )}
                {!hideVenueFilter && <th className="px-4 py-3">Venue</th>}
                {!hideSpocFilter && <th className="px-4 py-3">SPOC</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested At</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-8 text-center text-ink-muted">
                    No requests match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => {
                  const member = memberOf(r);
                  const team = teamOf(r);
                  const busy = busyId === r.id;
                  const activeMemberIds = (membersByTeam[r.team_id] ?? []).filter((m) => m.is_active).map((m) => m.id);
                  const currentStatusByProfileId = Object.fromEntries(
                    (membersByTeam[r.team_id] ?? []).map((m) => [m.id, currentRequestFor(m.id)?.status]),
                  );
                  const eligible = !!member?.is_active && canApproveExit(r.profile_id, activeMemberIds, currentStatusByProfileId);
                  return (
                    <tr key={r.id} className="border-b border-border align-top last:border-0">
                      {!singleCampus && <td className="px-4 py-3 text-ink-muted">{member?.campus ?? "—"}</td>}
                      <td className="px-4 py-3 text-ink-muted">{team?.team_name ?? "—"}</td>
                      <td className="px-4 py-3 text-ink">
                        {member?.name ?? "Unknown"} {member?.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{member?.is_lead ? "Team Lead" : "Member"}</td>
                      <td className="px-4 py-3 text-ink-muted">{member?.reg_no ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-muted">{member?.gitam_email ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-muted">{member?.phone ?? "—"}</td>
                      {!hideZoneFilters && (
                        <>
                          <td className="px-4 py-3 text-ink-muted">{zoneOf(team)?.name ?? "Unassigned"}</td>
                          <td className="px-4 py-3 text-ink-muted">{zoneManagerNameOf(team) ?? "Unassigned"}</td>
                        </>
                      )}
                      {!hideVenueFilter && <td className="px-4 py-3 text-ink-muted">{roomOf(team)?.name ?? "Unassigned"}</td>}
                      {!hideSpocFilter && <td className="px-4 py-3 text-ink-muted">{spocNameOf(team) ?? "Unassigned"}</td>}
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            r.status === "Approved"
                              ? "border-danger/40 bg-danger/10 text-danger"
                              : r.status === "Requested"
                                ? "border-gold/40 bg-gold/10 text-gold"
                                : "border-border text-ink-muted"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                        {new Date(r.requested_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.file_path && (
                            <button type="button" onClick={() => handleView(r.file_path!)} className="font-heading text-xs text-gold underline">
                              View
                            </button>
                          )}
                          {r.status === "Requested" && (
                            <>
                              <button
                                type="button"
                                disabled={busy || !eligible}
                                title={!eligible ? "This team is at the 3-member minimum — every other active member must also be exiting first." : undefined}
                                onClick={() => handleResolve(r.id, "Approved")}
                                className="rounded-full bg-gitam px-3 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:opacity-90 disabled:opacity-40"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleResolve(r.id, "Rejected")}
                                className="rounded-full border border-danger/40 px-3 py-1.5 font-heading text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
