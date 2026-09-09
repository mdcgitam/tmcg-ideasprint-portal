"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { IdCardCertItem, IdCardCertRecordRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { recordIdCardCertificate, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { FilterSelect } from "@/components/dashboard/admin/sections/TeamFormFields";
import { activeMemberCount, TEAM_MIN_ACTIVE } from "@/components/dashboard/admin/sections/ExitStatusBadge";
import { useTabFade } from "@/hooks/useTabFade";

type View = "teams" | "members";
type Status = "Completed" | "Pending" | "Not Marked";

const ITEMS: IdCardCertItem[] = ["ID Card", "Certificate"];

interface TeamFilters {
  search: string;
  campus: string;
  teamSize: string;
  zone: string;
  zoneManager: string;
  room: string;
  spoc: string;
  idCard: string;
  certificate: string;
}

const EMPTY_TEAM_FILTERS: TeamFilters = {
  search: "",
  campus: "",
  teamSize: "",
  zone: "",
  zoneManager: "",
  room: "",
  spoc: "",
  idCard: "",
  certificate: "",
};

interface MemberFilters {
  search: string;
  campus: string;
  teamSize: string;
  position: string; // "" | "lead" | "member"
  zone: string;
  zoneManager: string;
  room: string;
  spoc: string;
  idCard: string;
  certificate: string;
}

const EMPTY_MEMBER_FILTERS: MemberFilters = {
  search: "",
  campus: "",
  teamSize: "",
  position: "",
  zone: "",
  zoneManager: "",
  room: "",
  spoc: "",
  idCard: "",
  certificate: "",
};

function uniqueValues(values: (string | undefined | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

/**
 * ID Cards & Certificates — same "mark a status per participant, roll it up
 * per team" mechanic as Attendance, but the item list is the fixed pair
 * ("ID Card", "Certificate") instead of an admin-managed session list, so
 * there's no "Add Session" equivalent here.
 */
export function IdCardsSection({
  teams,
  membersByTeam,
  records,
  scope,
  staffAccounts,
  spocs,
  rooms,
  zones,
  singleCampus = false,
  hideZoneFilters = false,
  hideVenueFilter = false,
  hideSpocFilter = false,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  records: IdCardCertRecordRow[];
  scope: "spoc" | "admin";
  staffAccounts: ProfileRow[];
  spocs: ProfileRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  singleCampus?: boolean;
  hideZoneFilters?: boolean;
  hideVenueFilter?: boolean;
  hideSpocFilter?: boolean;
}) {
  const [localRecords, setLocalRecords] = useState(records);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("teams");
  const fadeRef = useTabFade(view);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());

  const [teamFilters, setTeamFilters] = useState<TeamFilters>(EMPTY_TEAM_FILTERS);
  const [memberFilters, setMemberFilters] = useState<MemberFilters>(EMPTY_MEMBER_FILTERS);

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const zoneManagerName = (zone: ZoneRow | null) =>
    zone?.zone_manager_profile_id ? (staffAccounts.find((s) => s.id === zone.zone_manager_profile_id)?.name ?? null) : null;
  // Displayed team size = active members only (an approved exit deactivates the profile).
  const teamSize = (team: TeamRow) => (membersByTeam[team.id] ?? []).filter((m) => m.is_active).length || team.member_count;

  function toggleExpanded(teamId: string) {
    setExpandedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function applyLocalStatus(item: IdCardCertItem, profileId: string, teamId: string, status: "Completed" | "Pending") {
    setLocalRecords((prev) => {
      const existing = prev.find((r) => r.item === item && r.profile_id === profileId);
      if (existing) {
        return prev.map((r) => (r === existing ? { ...r, status } : r));
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          item,
          profile_id: profileId,
          team_id: teamId,
          status,
          recorded_by: "",
          recorded_at: new Date().toISOString(),
        },
      ];
    });
  }

  async function handleToggleMember(item: IdCardCertItem, profileId: string, teamId: string, current: Status) {
    const next: "Completed" | "Pending" = current === "Completed" ? "Pending" : "Completed";
    const key = `member:${item}:${profileId}`;
    setBusyKey(key);
    setError(null);
    try {
      await recordIdCardCertificate(item, profileId, next);
      applyLocalStatus(item, profileId, teamId, next);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleMarkTeam(teamId: string, item: IdCardCertItem, status: "Completed" | "Pending") {
    const members = (membersByTeam[teamId] ?? []).filter((m) => m.is_active);
    if (members.length === 0) return;
    const key = `team:${teamId}:${item}`;
    setBusyKey(key);
    setError(null);
    try {
      await Promise.all(members.map((m) => recordIdCardCertificate(item, m.id, status)));
      members.forEach((m) => applyLocalStatus(item, m.id, teamId, status));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyKey(null);
    }
  }

  function memberStatus(profileId: string, item: IdCardCertItem): Status {
    const record = localRecords.find((r) => r.item === item && r.profile_id === profileId);
    return record?.status ?? "Not Marked";
  }

  /** A team is "Completed" only if every member has a Completed record for that item; any explicit Pending or unmarked member (once at least one member has been touched) makes it "Pending". Zero records at all = "Not Marked". */
  function teamStatus(team: TeamRow, item: IdCardCertItem): Status {
    const members = (membersByTeam[team.id] ?? []).filter((m) => m.is_active);
    if (members.length === 0) return "Not Marked";
    const records = members.map((m) => localRecords.find((r) => r.item === item && r.profile_id === m.id));
    if (records.every((r) => r?.status === "Completed")) return "Completed";
    if (records.some((r) => r)) return "Pending";
    return "Not Marked";
  }

  function statusClassName(status: Status) {
    return status === "Completed"
      ? "border-gitam/40 bg-gitam/10 text-gitam"
      : status === "Pending"
        ? "border-danger/40 bg-danger/10 text-danger"
        : "border-border text-ink-faint";
  }

  // ── Teams tab ────────────────────────────────────────────────────────

  const teamCampusOptions = useMemo(
    () => uniqueValues(teams.map((t) => (membersByTeam[t.id] ?? []).find((m) => m.is_lead)?.campus)),
    [teams, membersByTeam],
  );

  const filteredTeams = useMemo(() => {
    const q = teamFilters.search.trim().toLowerCase();
    return teams.filter((team) => {
      const members = membersByTeam[team.id] ?? [];
      const lead = members.find((m) => m.is_lead);

      // Inactive teams (fewer than 3 active members) are not part of this tracker.
      if (activeMemberCount(members) < TEAM_MIN_ACTIVE) return false;
      if (q) {
        const haystack = `${team.team_name} ${lead?.name ?? ""} ${lead?.phone ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (teamFilters.campus && lead?.campus !== teamFilters.campus) return false;
      if (teamFilters.teamSize && String(teamSize(team)) !== teamFilters.teamSize) return false;
      if (teamFilters.zone) {
        const room = roomOf(team);
        if (zoneOf(room)?.id !== teamFilters.zone) return false;
      }
      if (teamFilters.zoneManager) {
        const zone = zoneOf(roomOf(team));
        if (zone?.zone_manager_profile_id !== teamFilters.zoneManager) return false;
      }
      if (teamFilters.room && team.room_id !== teamFilters.room) return false;
      if (teamFilters.spoc && team.spoc_profile_id !== teamFilters.spoc) return false;
      if (teamFilters.idCard && teamStatus(team, "ID Card") !== teamFilters.idCard) return false;
      if (teamFilters.certificate && teamStatus(team, "Certificate") !== teamFilters.certificate) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, membersByTeam, teamFilters, localRecords]);

  function handleExportTeams() {
    downloadCsv(
      "id-cards-certificates-by-team",
      filteredTeams.map((team) => {
        const lead = (membersByTeam[team.id] ?? []).find((m) => m.is_lead);
        const zone = zoneOf(roomOf(team));
        return {
          ...(singleCampus ? {} : { Campus: lead?.campus ?? "—" }),
          "Team Name": team.team_name,
          "Team Lead": lead?.name ?? "—",
          "Lead Phone No": lead?.phone ?? "—",
          "Team Size": String(teamSize(team)),
          Zone: zone?.name ?? "Unassigned",
          "Zone Manager": zoneManagerName(zone) ?? "Unassigned",
          Venue: roomOf(team)?.name ?? "Unassigned",
          SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
          "ID Card": teamStatus(team, "ID Card"),
          Certificate: teamStatus(team, "Certificate"),
        };
      }),
    );
  }

  // ── Members tab ──────────────────────────────────────────────────────

  const allMembers = useMemo(() => teams.flatMap((t) => membersByTeam[t.id] ?? []), [teams, membersByTeam]);
  const memberCampusOptions = useMemo(() => uniqueValues(allMembers.map((m) => m.campus)), [allMembers]);

  const filteredMembers = useMemo(() => {
    const q = memberFilters.search.trim().toLowerCase();
    return teams.flatMap((team) => {
      const members = membersByTeam[team.id] ?? [];
      // Inactive teams (fewer than 3 active members) are not part of this tracker.
      if (activeMemberCount(members) < TEAM_MIN_ACTIVE) return [];
      return members
        .filter((m) => {
          if (q) {
            const haystack = `${team.team_name} ${m.name} ${m.phone}`.toLowerCase();
            if (!haystack.includes(q)) return false;
          }
          if (memberFilters.campus && m.campus !== memberFilters.campus) return false;
          if (memberFilters.teamSize && String(teamSize(team)) !== memberFilters.teamSize) return false;
          if (memberFilters.position && (memberFilters.position === "lead") !== m.is_lead) return false;
          if (memberFilters.zone) {
            const room = roomOf(team);
            if (zoneOf(room)?.id !== memberFilters.zone) return false;
          }
          if (memberFilters.zoneManager) {
            const zone = zoneOf(roomOf(team));
            if (zone?.zone_manager_profile_id !== memberFilters.zoneManager) return false;
          }
          if (memberFilters.room && team.room_id !== memberFilters.room) return false;
          if (memberFilters.spoc && team.spoc_profile_id !== memberFilters.spoc) return false;
          if (memberFilters.idCard && memberStatus(m.id, "ID Card") !== memberFilters.idCard) return false;
          if (memberFilters.certificate && memberStatus(m.id, "Certificate") !== memberFilters.certificate) return false;
          return true;
        })
        .map((member) => ({ member, team }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, membersByTeam, memberFilters, localRecords]);

  function handleExportMembers() {
    downloadCsv(
      "id-cards-certificates-by-member",
      filteredMembers.map(({ member: m, team }) => {
        const zone = zoneOf(roomOf(team));
        return {
          ...(singleCampus ? {} : { Campus: m.campus }),
          "Team Name": team.team_name,
          "Team Size": String(teamSize(team)),
          "Participant Name": m.name,
          Position: m.is_lead ? "Team Lead" : "Member",
          "Phone No": m.phone,
          Zone: zone?.name ?? "Unassigned",
          "Zone Manager": zoneManagerName(zone) ?? "Unassigned",
          Venue: roomOf(team)?.name ?? "Unassigned",
          SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
          "ID Card": memberStatus(m.id, "ID Card"),
          Certificate: memberStatus(m.id, "Certificate"),
        };
      }),
    );
  }

  const TEAM_FIXED_COLS = singleCampus ? 9 : 10; // chevron, [Campus], Team Name, Team Lead, Lead Phone No, Team Size, Zone, Zone Manager, Venue, SPOC
  const MEMBER_FIXED_COLS = singleCampus ? 9 : 10; // [Campus], Team Name, Team Size, Participant Name, Position, Phone No, Zone, Zone Manager, Venue, SPOC

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
    <div className="flex flex-col gap-6">
      {error && <p className="font-heading text-sm text-danger">{error}</p>}

      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "teams", label: "View by Team" },
          { value: "members", label: "View by Participants" },
        ]}
      />

      <div ref={fadeRef}>
        {view === "teams" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={teamFilters.search}
                  onChange={(e) => setTeamFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Search by team name, team lead, or lead phone…"
                  className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
                />
                <button
                  type="button"
                  onClick={handleExportTeams}
                  className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                >
                  Download CSV
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {!singleCampus && (
                  <FilterSelect
                    label="Campus"
                    value={teamFilters.campus}
                    onChange={(v) => setTeamFilters((f) => ({ ...f, campus: v }))}
                    options={teamCampusOptions}
                  />
                )}
                <FilterSelect
                  label="Team Size"
                  value={teamFilters.teamSize}
                  onChange={(v) => setTeamFilters((f) => ({ ...f, teamSize: v }))}
                  options={["3", "4"]}
                />
                {!hideZoneFilters && (
                  <>
                    <FilterSelect
                      label="Zone"
                      value={teamFilters.zone}
                      onChange={(v) => setTeamFilters((f) => ({ ...f, zone: v }))}
                      options={zones.map((z) => z.name)}
                      valueOptions={zones.map((z) => z.id)}
                    />
                    <FilterSelect
                      label="Zone Manager"
                      value={teamFilters.zoneManager}
                      onChange={(v) => setTeamFilters((f) => ({ ...f, zoneManager: v }))}
                      options={staffAccounts.filter((s) => s.role === "Zone Manager").map((s) => s.name)}
                      valueOptions={staffAccounts.filter((s) => s.role === "Zone Manager").map((s) => s.id)}
                    />
                  </>
                )}
                {!hideVenueFilter && (
                  <FilterSelect
                    label="Venue"
                    value={teamFilters.room}
                    onChange={(v) => setTeamFilters((f) => ({ ...f, room: v }))}
                    options={rooms.map((r) => r.name)}
                    valueOptions={rooms.map((r) => r.id)}
                  />
                )}
                {!hideSpocFilter && (
                  <FilterSelect
                    label="SPOC"
                    value={teamFilters.spoc}
                    onChange={(v) => setTeamFilters((f) => ({ ...f, spoc: v }))}
                    options={spocs.map((s) => s.name)}
                    valueOptions={spocs.map((s) => s.id)}
                  />
                )}
                <FilterSelect
                  label="ID Card"
                  value={teamFilters.idCard}
                  onChange={(v) => setTeamFilters((f) => ({ ...f, idCard: v }))}
                  options={["Completed", "Pending"]}
                />
                <FilterSelect
                  label="Certificate"
                  value={teamFilters.certificate}
                  onChange={(v) => setTeamFilters((f) => ({ ...f, certificate: v }))}
                  options={["Completed", "Pending"]}
                />
              </div>
            </div>

            <p className="font-heading text-xs text-ink-muted">Showing {filteredTeams.length} teams</p>

            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-left font-heading text-sm">
                <thead>
                  <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                    <th className="px-2 py-3" />
                    {!singleCampus && <th className="px-4 py-3">Campus</th>}
                    <th className="px-4 py-3">Team Name</th>
                    <th className="px-4 py-3">Team Lead</th>
                    <th className="px-4 py-3">Lead Phone No</th>
                    <th className="px-4 py-3">Team Size</th>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Zone Manager</th>
                    <th className="px-4 py-3">Venue</th>
                    <th className="px-4 py-3">SPOC</th>
                    <th className="px-4 py-3">ID Card</th>
                    <th className="px-4 py-3">Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.length === 0 ? (
                    <tr>
                      <td colSpan={TEAM_FIXED_COLS + ITEMS.length} className="px-4 py-8 text-center text-ink-muted">
                        No teams match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTeams.map((team) => {
                      const lead = (membersByTeam[team.id] ?? []).find((m) => m.is_lead);
                      const members = membersByTeam[team.id] ?? [];
                      const expanded = expandedTeamIds.has(team.id);
                      const room = roomOf(team);
                      return (
                        <Fragment key={team.id}>
                          <tr className="border-b border-border align-top last:border-0">
                            <td className="px-2 py-3">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(team.id)}
                                aria-label={expanded ? "Collapse members" : "Expand members"}
                                className="text-ink-muted transition-colors hover:text-gold"
                              >
                                {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                              </button>
                            </td>
                            {!singleCampus && <td className="px-4 py-3 text-ink-muted">{lead?.campus ?? "—"}</td>}
                            <td className="px-4 py-3 text-ink">{team.team_name}</td>
                            <td className="px-4 py-3 text-ink-muted">{lead?.name ?? "—"}</td>
                            <td className="px-4 py-3 text-ink-muted">{lead?.phone ?? "—"}</td>
                            <td className="px-4 py-3 text-ink-muted">{teamSize(team)}</td>
                            <td className="px-4 py-3 text-ink-muted">{zoneOf(room)?.name ?? "Unassigned"}</td>
                            <td className="px-4 py-3 text-ink-muted">{zoneManagerName(zoneOf(room)) ?? "Unassigned"}</td>
                            <td className="px-4 py-3 text-ink-muted">{room?.name ?? "Unassigned"}</td>
                            <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                            {ITEMS.map((item) => {
                              const status = teamStatus(team, item);
                              const busy = busyKey === `team:${team.id}:${item}`;
                              return (
                                <td key={item} className="px-4 py-3">
                                  <select
                                    value={status === "Not Marked" ? "" : status}
                                    disabled={busy}
                                    onChange={(e) => handleMarkTeam(team.id, item, e.target.value as "Completed" | "Pending")}
                                    className={`rounded-full border px-3 py-1.5 text-xs outline-none disabled:opacity-60 ${statusClassName(status)}`}
                                  >
                                    <option value="" disabled>
                                      Not Marked
                                    </option>
                                    <option value="Completed">Completed</option>
                                    <option value="Pending">Pending</option>
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                          {expanded && (
                            <tr className="border-b border-border bg-void/40">
                              <td colSpan={TEAM_FIXED_COLS + ITEMS.length} className="px-4 py-4">
                                <div className="overflow-x-auto rounded-lg border border-border">
                                  <table className="w-full text-left font-heading text-sm">
                                    <thead>
                                      <tr className="border-b border-border text-xs text-ink-muted uppercase">
                                        <th className="px-4 py-2">Participant Name</th>
                                        <th className="px-4 py-2">Email</th>
                                        <th className="px-4 py-2">Position</th>
                                        <th className="px-4 py-2">Phone No</th>
                                        <th className="px-4 py-2">ID Card</th>
                                        <th className="px-4 py-2">Certificate</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {members.map((m) => (
                                        <tr
                                          key={m.id}
                                          className={`border-b border-border last:border-0 ${m.is_active ? "" : "opacity-50"}`}
                                        >
                                          <td className="px-4 py-2 text-ink">
                                            {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                                            {!m.is_active && <span className="ml-1 text-xs text-danger">(Inactive)</span>}
                                          </td>
                                          <td className="px-4 py-2 text-ink-muted">{m.gitam_email}</td>
                                          <td className="px-4 py-2 text-ink-muted">{m.is_lead ? "Team Lead" : "Member"}</td>
                                          <td className="px-4 py-2 text-ink-muted">{m.phone}</td>
                                          {ITEMS.map((item) => {
                                            const mStatus = memberStatus(m.id, item);
                                            const mBusy = busyKey === `member:${item}:${m.id}`;
                                            return (
                                              <td key={item} className="px-4 py-2">
                                                <button
                                                  type="button"
                                                  disabled={mBusy || !m.is_active}
                                                  onClick={() => handleToggleMember(item, m.id, team.id, mStatus)}
                                                  className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${statusClassName(mStatus)}`}
                                                >
                                                  {m.is_active ? mStatus : "—"}
                                                </button>
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={memberFilters.search}
                  onChange={(e) => setMemberFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Search by team name, participant name, or phone…"
                  className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
                />
                <button
                  type="button"
                  onClick={handleExportMembers}
                  className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                >
                  Download CSV
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {!singleCampus && (
                  <FilterSelect
                    label="Campus"
                    value={memberFilters.campus}
                    onChange={(v) => setMemberFilters((f) => ({ ...f, campus: v }))}
                    options={memberCampusOptions}
                  />
                )}
                <FilterSelect
                  label="Team Size"
                  value={memberFilters.teamSize}
                  onChange={(v) => setMemberFilters((f) => ({ ...f, teamSize: v }))}
                  options={["3", "4"]}
                />
                <FilterSelect
                  label="Position"
                  value={memberFilters.position}
                  onChange={(v) => setMemberFilters((f) => ({ ...f, position: v }))}
                  options={["Team Lead", "Member"]}
                  valueOptions={["lead", "member"]}
                />
                {!hideZoneFilters && (
                  <>
                    <FilterSelect
                      label="Zone"
                      value={memberFilters.zone}
                      onChange={(v) => setMemberFilters((f) => ({ ...f, zone: v }))}
                      options={zones.map((z) => z.name)}
                      valueOptions={zones.map((z) => z.id)}
                    />
                    <FilterSelect
                      label="Zone Manager"
                      value={memberFilters.zoneManager}
                      onChange={(v) => setMemberFilters((f) => ({ ...f, zoneManager: v }))}
                      options={staffAccounts.filter((s) => s.role === "Zone Manager").map((s) => s.name)}
                      valueOptions={staffAccounts.filter((s) => s.role === "Zone Manager").map((s) => s.id)}
                    />
                  </>
                )}
                {!hideVenueFilter && (
                  <FilterSelect
                    label="Venue"
                    value={memberFilters.room}
                    onChange={(v) => setMemberFilters((f) => ({ ...f, room: v }))}
                    options={rooms.map((r) => r.name)}
                    valueOptions={rooms.map((r) => r.id)}
                  />
                )}
                {!hideSpocFilter && (
                  <FilterSelect
                    label="SPOC"
                    value={memberFilters.spoc}
                    onChange={(v) => setMemberFilters((f) => ({ ...f, spoc: v }))}
                    options={spocs.map((s) => s.name)}
                    valueOptions={spocs.map((s) => s.id)}
                  />
                )}
                <FilterSelect
                  label="ID Card"
                  value={memberFilters.idCard}
                  onChange={(v) => setMemberFilters((f) => ({ ...f, idCard: v }))}
                  options={["Completed", "Pending"]}
                />
                <FilterSelect
                  label="Certificate"
                  value={memberFilters.certificate}
                  onChange={(v) => setMemberFilters((f) => ({ ...f, certificate: v }))}
                  options={["Completed", "Pending"]}
                />
              </div>
            </div>

            <p className="font-heading text-xs text-ink-muted">Showing {filteredMembers.length} members</p>

            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-left font-heading text-sm">
                <thead>
                  <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                    {!singleCampus && <th className="px-4 py-3">Campus</th>}
                    <th className="px-4 py-3">Team Name</th>
                    <th className="px-4 py-3">Team Size</th>
                    <th className="px-4 py-3">Participant Name</th>
                    <th className="px-4 py-3">Position</th>
                    <th className="px-4 py-3">Phone No</th>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Zone Manager</th>
                    <th className="px-4 py-3">Venue</th>
                    <th className="px-4 py-3">SPOC</th>
                    <th className="px-4 py-3">ID Card</th>
                    <th className="px-4 py-3">Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={MEMBER_FIXED_COLS + ITEMS.length} className="px-4 py-8 text-center text-ink-muted">
                        No members match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map(({ member: m, team }) => (
                      <tr
                        key={m.id}
                        className={`border-b border-border align-top last:border-0 ${m.is_active ? "" : "opacity-50"}`}
                      >
                        {!singleCampus && <td className="px-4 py-3 text-ink-muted">{m.campus}</td>}
                        <td className="px-4 py-3 text-ink-muted">{team.team_name}</td>
                        <td className="px-4 py-3 text-ink-muted">{teamSize(team)}</td>
                        <td className="px-4 py-3 text-ink">
                          {m.name}
                          {!m.is_active && <span className="ml-1 text-xs text-danger">(Inactive)</span>}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{m.is_lead ? "Team Lead" : "Member"}</td>
                        <td className="px-4 py-3 text-ink-muted">{m.phone}</td>
                        <td className="px-4 py-3 text-ink-muted">{zoneOf(roomOf(team))?.name ?? "Unassigned"}</td>
                        <td className="px-4 py-3 text-ink-muted">{zoneManagerName(zoneOf(roomOf(team))) ?? "Unassigned"}</td>
                        <td className="px-4 py-3 text-ink-muted">{roomOf(team)?.name ?? "Unassigned"}</td>
                        <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                        {ITEMS.map((item) => {
                          const status = memberStatus(m.id, item);
                          const busy = busyKey === `member:${item}:${m.id}`;
                          return (
                            <td key={item} className="px-4 py-3">
                              <button
                                type="button"
                                disabled={busy || !m.is_active}
                                onClick={() => handleToggleMember(item, m.id, team.id, status)}
                                className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${statusClassName(status)}`}
                              >
                                {m.is_active ? status : "—"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
