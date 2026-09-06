"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { NocRow, ProfileRow, RoomRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import {
  deleteNoc,
  deleteNocFile,
  extendNocDeadline,
  getSignedUrl,
  recordNocMetadata,
  uploadNocFile,
  DashboardActionError,
} from "@/lib/dashboard/team-actions";
import { downloadCsv } from "@/lib/csv";
import { FilterSelect } from "./TeamFormFields";

const GENERAL_DEADLINE_KEY = "noc.general_deadline";

/** Same Completed/Pending vocabulary as the Teams tab's Status column — "Uploaded"/"Not Uploaded" stays the underlying stored value. */
function statusLabel(raw: "Uploaded" | "Not Uploaded" | "Verified" | "Missing"): "Completed" | "Pending" {
  return raw === "Uploaded" ? "Completed" : "Pending";
}

interface Row {
  member: TeamMemberProfile;
  team: TeamRow;
}

/** "Individuals" view of the NOC page (NOC3/NOC4 reference) — one row per member. */
export function NocIndividualsView({
  teams,
  membersByTeam,
  nocs,
  rooms,
  staffAccounts,
  config,
  scope,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  nocs: NocRow[];
  rooms: RoomRow[];
  staffAccounts: ProfileRow[];
  config: Record<string, unknown>;
  scope: "spoc" | "admin";
}) {
  const rawGeneralDeadline = config[GENERAL_DEADLINE_KEY];
  const generalDeadline = typeof rawGeneralDeadline === "string" && rawGeneralDeadline ? rawGeneralDeadline : null;

  const router = useRouter();
  const [localNocs, setLocalNocs] = useState(nocs);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeadline, setBulkDeadline] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [rowDeadlines, setRowDeadlines] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const uploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [campusFilter, setCampusFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState(""); // "" | "lead" | "member"
  const [venueFilter, setVenueFilter] = useState("");
  const [spocFilter, setSpocFilter] = useState("");
  const [fileStatusFilter, setFileStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;

  function toDatetimeLocal(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const nocOf = (profileId: string) => localNocs.find((n) => n.profile_id === profileId);

  const allRows: Row[] = useMemo(
    () => teams.flatMap((team) => (membersByTeam[team.id] ?? []).map((member) => ({ member, team }))),
    [teams, membersByTeam],
  );

  const campusOptions = useMemo(
    () => Array.from(new Set(allRows.map(({ member }) => member.campus).filter((c): c is NonNullable<typeof c> => Boolean(c)))),
    [allRows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(({ member, team }) => {
      if (q) {
        const haystack =
          `${team.team_name} ${member.name} ${member.reg_no} ${member.gitam_email} ${member.phone}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (campusFilter && member.campus !== campusFilter) return false;
      if (positionFilter && (positionFilter === "lead") !== member.is_lead) return false;
      if (venueFilter && team.room_id !== venueFilter) return false;
      if (spocFilter && team.spoc_profile_id !== spocFilter) return false;
      if (fileStatusFilter && (nocOf(member.id)?.status ?? "Not Uploaded") !== fileStatusFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, search, campusFilter, positionFilter, venueFilter, spocFilter, fileStatusFilter, localNocs]);

  function toggleSelected(profileId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  async function handleBulkExtend() {
    if (!bulkDeadline || selected.size === 0) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      const deadlineIso = new Date(bulkDeadline).toISOString();
      await Promise.all(Array.from(selected).map((id) => extendNocDeadline(id, deadlineIso)));
      setLocalNocs((prev) =>
        prev.map((n) => (selected.has(n.profile_id) ? { ...n, deadline: deadlineIso } : n)),
      );
      setSelected(new Set());
      setBulkDeadline("");
    } catch (err) {
      setBulkError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleRowExtend(profileId: string) {
    const value = rowDeadlines[profileId] ?? toDatetimeLocal(nocOf(profileId)?.deadline ?? generalDeadline);
    if (!value) return;
    setRowBusy(profileId);
    setRowErrors((prev) => ({ ...prev, [profileId]: "" }));
    try {
      const deadlineIso = new Date(value).toISOString();
      await extendNocDeadline(profileId, deadlineIso);
      setLocalNocs((prev) => {
        const exists = prev.find((n) => n.profile_id === profileId);
        return exists
          ? prev.map((n) => (n.profile_id === profileId ? { ...n, deadline: deadlineIso } : n))
          : [...prev, { profile_id: profileId, status: "Not Uploaded", file_path: null, deadline: deadlineIso } as NocRow];
      });
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [profileId]: err instanceof DashboardActionError ? err.message : "Something went wrong.",
      }));
    } finally {
      setRowBusy(null);
    }
  }

  async function handleAdminUpload(profileId: string, file: File) {
    if (file.type !== "application/pdf") {
      setRowErrors((prev) => ({ ...prev, [profileId]: "Only PDF files are allowed." }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setRowErrors((prev) => ({ ...prev, [profileId]: "File exceeds the 2MB limit." }));
      return;
    }
    setRowBusy(profileId);
    setRowErrors((prev) => ({ ...prev, [profileId]: "" }));
    try {
      const path = await uploadNocFile(profileId, file);
      try {
        await recordNocMetadata(profileId, path);
      } catch (e) {
        // The file bytes are already in storage — don't leave an orphan if the
        // metadata write is rejected (deleted member, deadline, campus, …).
        await deleteNocFile(path).catch(() => {});
        throw e;
      }
      setLocalNocs((prev) => {
        const exists = prev.find((n) => n.profile_id === profileId);
        return exists
          ? prev.map((n) => (n.profile_id === profileId ? { ...n, status: "Uploaded", file_path: path } : n))
          : [...prev, { profile_id: profileId, status: "Uploaded", file_path: path, deadline: null } as NocRow];
      });
      router.refresh(); // reconcile with server truth so the row can't silently drift
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [profileId]: err instanceof DashboardActionError ? err.message : "Something went wrong.",
      }));
    } finally {
      setRowBusy(null);
    }
  }

  async function handleView(profileId: string) {
    const noc = nocOf(profileId);
    if (!noc?.file_path) return;
    const url = await getSignedUrl("noc-uploads", noc.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(profileId: string) {
    const noc = nocOf(profileId);
    if (!noc?.file_path) return;
    if (!window.confirm("Delete this NOC file?")) return;
    setRowBusy(profileId);
    try {
      await deleteNocFile(noc.file_path);
      await deleteNoc(profileId);
      setLocalNocs((prev) =>
        prev.map((n) => (n.profile_id === profileId ? { ...n, status: "Not Uploaded", file_path: null } : n)),
      );
      router.refresh();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [profileId]: err instanceof DashboardActionError ? err.message : "Something went wrong.",
      }));
    } finally {
      setRowBusy(null);
    }
  }

  function handleExportCsv() {
    downloadCsv(
      "noc-individuals",
      filteredRows.map(({ member, team }) => ({
        Campus: member.campus ?? "—",
        "Team Name": team.team_name,
        "Participant Name": member.name,
        Position: member.is_lead ? "Team Lead" : "Member",
        "Reg No": member.reg_no,
        Email: member.gitam_email,
        Phone: member.phone,
        Venue: roomOf(team)?.name ?? "Unassigned",
        SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
        "File Status": statusLabel(nocOf(member.id)?.status ?? "Not Uploaded"),
      })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">
          Bulk Extend For Selected Individuals
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
          <span className="font-heading text-xs text-ink-muted">Selected: {selected.size} individual(s)</span>
        </div>
        {bulkError && <p className="font-heading text-xs text-danger">{bulkError}</p>}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by team name, participant name, reg no, email, or phone…"
          className="min-w-[180px] w-full rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Campus" value={campusFilter} onChange={setCampusFilter} options={campusOptions} />
          <FilterSelect
            label="Position"
            value={positionFilter}
            onChange={setPositionFilter}
            options={["Team Lead", "Member"]}
            valueOptions={["lead", "member"]}
          />
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
            label="File Status"
            value={fileStatusFilter}
            onChange={setFileStatusFilter}
            options={["Completed", "Pending"]}
            valueOptions={["Uploaded", "Not Uploaded"]}
          />
        </div>
      </div>

      <p className="font-heading text-xs text-ink-muted">Showing {filteredRows.length} individuals</p>

      {filteredRows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No individuals match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                <th className="px-4 py-3" />
                <th className="px-4 py-3">Campus</th>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-4 py-3">Participant Name</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Reg No</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone No</th>
                <th className="px-4 py-3">Venue</th>
                <th className="px-4 py-3">SPOC</th>
                <th className="px-4 py-3">File Status</th>
                <th className="px-4 py-3">File</th>
                {scope === "admin" && <th className="px-4 py-3">Admin Upload</th>}
                <th className="px-4 py-3">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ member, team }) => {
                const noc = nocOf(member.id);
                const uploaded = noc?.status === "Uploaded" && noc.file_path;
                const busy = rowBusy === member.id;
                const rowError = rowErrors[member.id];
                return (
                  <tr key={member.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(member.id)}
                        onChange={() => toggleSelected(member.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{member.campus ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{team.team_name}</td>
                    <td className="px-4 py-3 text-ink">{member.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{member.is_lead ? "Team Lead" : "Member"}</td>
                    <td className="px-4 py-3 text-ink-muted">{member.reg_no}</td>
                    <td className="px-4 py-3 text-ink-muted">{member.gitam_email}</td>
                    <td className="px-4 py-3 text-ink-muted">{member.phone}</td>
                    <td className="px-4 py-3 text-ink-muted">{roomOf(team)?.name ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                    <td className="px-4 py-3">
                      <span className={uploaded ? "text-gitam" : "text-gold"}>{statusLabel(noc?.status ?? "Not Uploaded")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {uploaded && (
                          <>
                            <button type="button" onClick={() => handleView(member.id)} className="text-gold underline">
                              View
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDelete(member.id)}
                              className="text-danger underline disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    {scope === "admin" && (
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <input
                            ref={(el) => {
                              uploadInputRefs.current[member.id] = el;
                            }}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleAdminUpload(member.id, file);
                              e.target.value = "";
                            }}
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => uploadInputRefs.current[member.id]?.click()}
                            className="w-fit rounded-full bg-gold px-3 py-1 font-heading text-[11px] font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
                          >
                            {busy ? "Uploading…" : uploaded ? "Replace" : "Upload"}
                          </button>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {(() => {
                          const currentDeadline = noc?.deadline ?? generalDeadline;
                          const isGeneral = !noc?.deadline && !!generalDeadline;
                          const expired = !!currentDeadline && new Date(currentDeadline) < new Date();
                          return (
                            <span className={`font-heading text-[11px] ${expired ? "text-danger" : "text-ink-muted"}`}>
                              Current:{" "}
                              {currentDeadline
                                ? new Date(currentDeadline).toLocaleString("en-IN", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : "Not set"}
                              {isGeneral && " (General)"}
                              {expired && " — Time exceeded"}
                            </span>
                          );
                        })()}
                        <input
                          type="datetime-local"
                          value={rowDeadlines[member.id] ?? toDatetimeLocal(noc?.deadline ?? generalDeadline)}
                          onChange={(e) => setRowDeadlines((prev) => ({ ...prev, [member.id]: e.target.value }))}
                          className="rounded-lg border border-border bg-void px-2 py-1 font-heading text-xs text-ink outline-none focus:border-gold"
                        />
                        <button
                          type="button"
                          disabled={busy || !(rowDeadlines[member.id] ?? toDatetimeLocal(noc?.deadline ?? generalDeadline))}
                          onClick={() => handleRowExtend(member.id)}
                          className="w-fit rounded-full border border-gold/50 px-3 py-1 font-heading text-[11px] font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
                        >
                          {noc?.deadline ?? generalDeadline ? "Update" : "Extend"}
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
    </div>
  );
}
