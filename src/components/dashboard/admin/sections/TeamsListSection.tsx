"use client";

import { useMemo, useState } from "react";
import type { TeamRow, NocRow, ExitFormRow, ProfileRow, RoomRow, ZoneRow, ProblemStatementRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { deleteNoc, deleteNocFile, getSignedUrl, DashboardActionError } from "@/lib/dashboard/team-actions";
import {
  extendProblemStatementDeadline,
  deleteTeam,
  deleteMember,
  updateMember,
  updateTeamName,
  type UpdateMemberInput,
} from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

interface DownloadRow {
  [key: string]: string;
  "Member Name": string;
  "Reg./Roll No.": string;
  "Year of Study": string;
  "Team Name": string;
  "Team Lead": string;
  SPOC: string;
  "Room Number": string;
}

/**
 * Filters (item 10) + search (item 9 "Additional") + CSV export (item 9,
 * "downloads a must for every filter") + delete (item 11). Room/Zone/SPOC
 * (item 9) are all derived from the team's room, per the room-based
 * assignment model in RoomsZonesSection.
 */
export function TeamsListSection({
  teams,
  membersByTeam,
  nocs,
  exitForms,
  scope,
  staffAccounts,
  rooms,
  zones,
  problemStatements,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  nocs: NocRow[];
  exitForms: ExitFormRow[];
  scope: "spoc" | "admin";
  staffAccounts: ProfileRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  problemStatements: ProblemStatementRow[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [localNocs, setLocalNocs] = useState(nocs);
  const [localTeams, setLocalTeams] = useState(teams);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<UpdateMemberInput | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [editingTeamNameId, setEditingTeamNameId] = useState<string | null>(null);
  const [teamNameDraft, setTeamNameDraft] = useState("");
  const [savingTeamName, setSavingTeamName] = useState(false);
  const [teamNameError, setTeamNameError] = useState<string | null>(null);

  const [extendUntil, setExtendUntil] = useState<Record<string, string>>({});
  const [extendReason, setExtendReason] = useState<Record<string, string>>({});
  const [extending, setExtending] = useState<string | null>(null);
  const [extendMessage, setExtendMessage] = useState<Record<string, string>>({});

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [psFilter, setPsFilter] = useState("");
  const [teamSizeFilter, setTeamSizeFilter] = useState("");

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const psOf = (team: TeamRow) => problemStatements.find((p) => p.id === team.current_problem_statement_id) ?? null;

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return localTeams.filter((team) => {
      const members = membersByTeam[team.id] ?? [];
      const room = roomOf(team);
      const zone = zoneOf(room);

      if (q) {
        const haystack = [team.team_name, team.team_id, ...members.map((m) => `${m.name} ${m.user_id} ${m.reg_no}`)]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (yearFilter && !members.some((m) => m.year_of_study === yearFilter)) return false;
      if (genderFilter && !members.some((m) => m.gender === genderFilter)) return false;
      if (roomFilter && team.room_id !== roomFilter) return false;
      if (zoneFilter && zone?.id !== zoneFilter) return false;
      if (psFilter && team.current_problem_statement_id !== psFilter) return false;
      if (teamSizeFilter && String(team.member_count) !== teamSizeFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTeams, membersByTeam, search, yearFilter, genderFilter, roomFilter, zoneFilter, psFilter, teamSizeFilter, rooms, zones]);

  function teamToRows(team: TeamRow): DownloadRow[] {
    const members = membersByTeam[team.id] ?? [];
    const lead = members.find((m) => m.is_lead);
    const room = roomOf(team);
    return members.map((m) => ({
      "Member Name": m.name,
      "Reg./Roll No.": m.reg_no,
      "Year of Study": m.year_of_study,
      "Team Name": team.team_name,
      "Team Lead": lead?.name ?? "—",
      SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
      "Room Number": room?.name ?? "Unassigned",
    }));
  }

  function handleDownloadTeam(team: TeamRow) {
    downloadCsv(`${team.team_name}-roster`, teamToRows(team));
  }

  function handleDownloadAllMembers() {
    downloadCsv("all-members", filteredTeams.flatMap(teamToRows));
  }

  async function handleViewNoc(profileId: string) {
    const noc = localNocs.find((n) => n.profile_id === profileId);
    if (!noc?.file_path) return;
    const url = await getSignedUrl("noc-uploads", noc.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDeleteNoc(profileId: string) {
    const noc = localNocs.find((n) => n.profile_id === profileId);
    if (!noc?.file_path) return;
    setBusyProfileId(profileId);
    setError(null);
    try {
      await deleteNocFile(noc.file_path);
      await deleteNoc(profileId);
      setLocalNocs((prev) =>
        prev.map((n) => (n.profile_id === profileId ? { ...n, status: "Not Uploaded", file_path: null } : n)),
      );
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyProfileId(null);
    }
  }

  async function handleDeleteTeam(team: TeamRow) {
    if (!window.confirm(`Delete "${team.team_name}" and every member permanently? This can't be undone.`)) return;
    setBusyProfileId(team.id);
    setError(null);
    try {
      await deleteTeam(team.id);
      setLocalTeams((prev) => prev.filter((t) => t.id !== team.id));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyProfileId(null);
    }
  }

  async function handleDeleteMember(profileId: string, name: string) {
    if (!window.confirm(`Remove ${name} from their team permanently?`)) return;
    setBusyProfileId(profileId);
    setError(null);
    try {
      await deleteMember(profileId);
      // membersByTeam is server-derived (fetchAdminDashboardData) — reload rather than hand-maintaining a local copy.
      window.location.reload();
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
      setBusyProfileId(null);
    }
  }

  function startEditMember(m: TeamMemberProfile) {
    setEditingMemberId(m.id);
    setMemberError(null);
    setMemberForm({
      name: m.name,
      gitam_email: m.gitam_email,
      phone: m.phone,
      reg_no: m.reg_no,
      year_of_study: m.year_of_study,
      school: m.school,
      department: m.department,
      branch: m.branch,
      gender: m.gender,
      stay: m.stay,
    });
  }

  function cancelEditMember() {
    setEditingMemberId(null);
    setMemberForm(null);
    setMemberError(null);
  }

  async function handleSaveMember(profileId: string) {
    if (!memberForm) return;
    setSavingMember(true);
    setMemberError(null);
    try {
      await updateMember(profileId, memberForm);
      // membersByTeam is server-derived (fetchAdminDashboardData) — reload rather than hand-maintaining a local copy.
      window.location.reload();
    } catch (err) {
      setMemberError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
      setSavingMember(false);
    }
  }

  function startEditTeamName(team: TeamRow) {
    setEditingTeamNameId(team.id);
    setTeamNameDraft(team.team_name);
    setTeamNameError(null);
  }

  async function handleSaveTeamName(teamId: string) {
    if (!teamNameDraft.trim()) return;
    setSavingTeamName(true);
    setTeamNameError(null);
    try {
      await updateTeamName(teamId, teamNameDraft.trim());
      setLocalTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, team_name: teamNameDraft.trim() } : t)));
      setEditingTeamNameId(null);
    } catch (err) {
      setTeamNameError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSavingTeamName(false);
    }
  }

  async function handleExtend(teamId: string) {
    const until = extendUntil[teamId];
    if (!until) return;
    setExtending(teamId);
    setExtendMessage((m) => ({ ...m, [teamId]: "" }));
    try {
      await extendProblemStatementDeadline(teamId, new Date(until).toISOString(), extendReason[teamId] ?? "");
      setExtendMessage((m) => ({ ...m, [teamId]: "Deadline extended." }));
    } catch (err) {
      setExtendMessage((m) => ({
        ...m,
        [teamId]: err instanceof DashboardActionError ? err.message : "Something went wrong.",
      }));
    } finally {
      setExtending(null);
    }
  }

  if (localTeams.length === 0) {
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
      {error && <p className="font-heading text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by team, name, reg no, user ID…"
            className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            onClick={handleDownloadAllMembers}
            className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Download All Members (CSV)
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterSelect label="Year" value={yearFilter} onChange={setYearFilter} options={YEAR_OPTIONS} />
          <FilterSelect label="Gender" value={genderFilter} onChange={setGenderFilter} options={GENDER_OPTIONS} />
          <FilterSelect
            label="Room / SPOC"
            value={roomFilter}
            onChange={setRoomFilter}
            options={rooms.map((r) => r.name)}
            valueOptions={rooms.map((r) => r.id)}
          />
          <FilterSelect
            label="Zone"
            value={zoneFilter}
            onChange={setZoneFilter}
            options={zones.map((z) => z.name)}
            valueOptions={zones.map((z) => z.id)}
          />
          <FilterSelect
            label="Problem Statement"
            value={psFilter}
            onChange={setPsFilter}
            options={problemStatements.map((p) => p.number)}
            valueOptions={problemStatements.map((p) => p.id)}
          />
          <FilterSelect label="Team Size" value={teamSizeFilter} onChange={setTeamSizeFilter} options={["3", "4"]} />
        </div>
      </div>

      {filteredTeams.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No teams match the current filters.</p>
        </div>
      ) : (
        filteredTeams.map((team) => {
          const members = membersByTeam[team.id] ?? [];
          const lead = members.find((m) => m.is_lead);
          const isOpen = expanded === team.id;
          const exitForm = exitForms.find((e) => e.team_id === team.id);
          const room = roomOf(team);
          const zone = zoneOf(room);
          const ps = psOf(team);

          return (
            <div key={team.id} className="rounded-xl border border-border bg-surface">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : team.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div>
                  <p className="font-heading text-sm text-ink">
                    {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                  </p>
                  <p className="mt-1 font-heading text-xs text-ink-muted">
                    {lead?.name ?? "No lead"} · {members.length} members · {team.status}
                  </p>
                </div>
                <span className="font-mono text-xs text-gold">{isOpen ? "Hide" : "View"}</span>
              </button>

              {isOpen && (
                <div className="border-t border-border p-5">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadTeam(team)}
                      className="rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                    >
                      Download Roster (CSV)
                    </button>
                    {scope === "admin" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            editingTeamNameId === team.id ? setEditingTeamNameId(null) : startEditTeamName(team)
                          }
                          className="rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                        >
                          {editingTeamNameId === team.id ? "Cancel Rename" : "Rename Team"}
                        </button>
                        <button
                          type="button"
                          disabled={busyProfileId === team.id}
                          onClick={() => handleDeleteTeam(team)}
                          className="rounded-full border border-danger/50 px-4 py-1.5 font-heading text-xs font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                        >
                          Delete Team
                        </button>
                      </>
                    )}
                  </div>

                  {scope === "admin" && editingTeamNameId === team.id && (
                    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gold/30 p-3">
                      <input
                        value={teamNameDraft}
                        onChange={(e) => setTeamNameDraft(e.target.value)}
                        className="min-w-[200px] flex-1 rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
                      />
                      <button
                        type="button"
                        disabled={savingTeamName || !teamNameDraft.trim()}
                        onClick={() => handleSaveTeamName(team.id)}
                        className="rounded-full bg-gold px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
                      >
                        {savingTeamName ? "Saving…" : "Save"}
                      </button>
                      {teamNameError && <p className="w-full font-heading text-xs text-danger">{teamNameError}</p>}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    {members.map((m) => {
                      const noc = localNocs.find((n) => n.profile_id === m.id);
                      const uploaded = noc?.status === "Uploaded" && noc.file_path;
                      return (
                        <div key={m.id} className="rounded-lg border border-border p-3 font-heading text-sm">
                          <p className="text-ink">
                            {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                          </p>
                          <p className="mt-1 text-xs text-ink-muted">
                            {m.user_id} · {m.gitam_email}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                            NOC: {noc?.status ?? "Not Uploaded"}
                            {uploaded && (
                              <>
                                <button type="button" onClick={() => handleViewNoc(m.id)} className="text-gold underline">
                                  View
                                </button>
                                <button
                                  type="button"
                                  disabled={busyProfileId === m.id}
                                  onClick={() => handleDeleteNoc(m.id)}
                                  className="text-danger underline disabled:opacity-60"
                                >
                                  Delete NOC
                                </button>
                              </>
                            )}
                            {scope === "admin" && (
                              <button
                                type="button"
                                onClick={() =>
                                  editingMemberId === m.id ? cancelEditMember() : startEditMember(m)
                                }
                                className="text-gold underline"
                              >
                                {editingMemberId === m.id ? "Cancel" : "Edit"}
                              </button>
                            )}
                            {scope === "admin" && !m.is_lead && (
                              <button
                                type="button"
                                disabled={busyProfileId === m.id}
                                onClick={() => handleDeleteMember(m.id, m.name)}
                                className="text-danger underline disabled:opacity-60"
                              >
                                Remove Member
                              </button>
                            )}
                          </p>

                          {scope === "admin" && editingMemberId === m.id && memberForm && (
                            <MemberEditForm
                              form={memberForm}
                              onChange={setMemberForm}
                              onSave={() => handleSaveMember(m.id)}
                              onCancel={cancelEditMember}
                              saving={savingMember}
                              error={memberError}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="mt-4 font-heading text-xs text-ink-muted">
                    Exit Form: {exitForm?.status ?? "Not Submitted"}
                  </p>

                  <p className="mt-2 font-heading text-xs text-ink-muted">
                    Room: {room?.name ?? "Unassigned"} {zone && `· Zone: ${zone.name}`} · SPOC:{" "}
                    {spocName(team.spoc_profile_id) ?? "Unassigned"}
                    {scope === "admin" && <span className="text-ink-faint"> — change this from Rooms & Zones</span>}
                  </p>

                  {ps && <p className="mt-2 font-heading text-xs text-ink-muted">Problem Statement: {ps.number} — {ps.title}</p>}

                  <div className="mt-4 rounded-lg border border-border p-3">
                    <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">
                      Extend PS Selection Deadline
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="datetime-local"
                        value={extendUntil[team.id] ?? ""}
                        onChange={(e) => setExtendUntil((v) => ({ ...v, [team.id]: e.target.value }))}
                        className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
                      />
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={extendReason[team.id] ?? ""}
                        onChange={(e) => setExtendReason((v) => ({ ...v, [team.id]: e.target.value }))}
                        className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
                      />
                      <button
                        type="button"
                        disabled={extending === team.id || !extendUntil[team.id]}
                        onClick={() => handleExtend(team.id)}
                        className="rounded-full bg-gold px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
                      >
                        {extending === team.id ? "Extending…" : "Extend"}
                      </button>
                    </div>
                    {extendMessage[team.id] && (
                      <p className="mt-2 font-heading text-xs text-ink-muted">{extendMessage[team.id]}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function MemberEditForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
}: {
  form: UpdateMemberInput;
  onChange: (form: UpdateMemberInput) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-gold/30 bg-void p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <EditField label="Name" value={form.name} onChange={(v) => onChange({ ...form, name: v })} />
        <EditField label="Email" value={form.gitam_email} onChange={(v) => onChange({ ...form, gitam_email: v })} />
        <EditField label="Phone" value={form.phone} onChange={(v) => onChange({ ...form, phone: v })} />
        <EditField label="Reg./Roll No." value={form.reg_no} onChange={(v) => onChange({ ...form, reg_no: v })} />
        <EditSelect
          label="Year of Study"
          value={form.year_of_study}
          onChange={(v) => onChange({ ...form, year_of_study: v })}
          options={YEAR_OPTIONS}
        />
        <EditSelect
          label="Gender"
          value={form.gender}
          onChange={(v) => onChange({ ...form, gender: v })}
          options={GENDER_OPTIONS}
        />
        <EditField label="School" value={form.school} onChange={(v) => onChange({ ...form, school: v })} />
        <EditField label="Department" value={form.department} onChange={(v) => onChange({ ...form, department: v })} />
        <EditField label="Branch" value={form.branch} onChange={(v) => onChange({ ...form, branch: v })} />
        <EditField label="Stay" value={form.stay} onChange={(v) => onChange({ ...form, stay: v })} />
      </div>
      {error && <p className="font-heading text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-full bg-gold px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:bg-surface disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
      />
    </label>
  );
}

function EditSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  valueOptions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  valueOptions?: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-xs text-ink outline-none focus:border-gold"
    >
      <option value="">{label}: All</option>
      {options.map((opt, i) => (
        <option key={opt} value={valueOptions ? valueOptions[i] : opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
