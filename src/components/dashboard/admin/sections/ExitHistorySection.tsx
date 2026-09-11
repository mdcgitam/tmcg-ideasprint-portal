"use client";

import { useMemo, useState } from "react";
import type { ApprovalRequestRow, ExitRequestRow, ProfileRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { sortCampuses } from "@/lib/dashboard/campus-config";
import { downloadCsv } from "@/lib/csv";
import { FilterSelect } from "./TeamFormFields";

interface HistoryRow {
  id: string;
  type: "Exit" | "Profile Edit";
  team: TeamRow | null;
  requestedByProfileId: string;
  sentAt: string;
  status: "Approved" | "Rejected";
  reviewedBy: string | null;
  reviewedAt: string | null;
}

const TYPE_OPTIONS = ["Exit", "Profile Edit"];
const STATUS_OPTIONS = ["Approved", "Rejected"];

/**
 * Combined History — resolved Exit requests and resolved Profile Edit
 * (approval_requests) requests in one chronological timeline. Read-only;
 * the live Teams/Participants tabs (exit) and Approvals module (edit) are
 * where an open request actually gets acted on.
 */
export function ExitHistorySection({
  teams,
  membersByTeam,
  exitRequests,
  approvalRequests,
  staffAccounts,
  singleCampus = false,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  exitRequests: ExitRequestRow[];
  approvalRequests: ApprovalRequestRow[];
  staffAccounts: ProfileRow[];
  singleCampus?: boolean;
}) {
  const [campusFilter, setCampusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const teamOf = (teamId: string) => teams.find((t) => t.id === teamId) ?? null;
  const leadOf = (team: TeamRow | null) => (team ? (membersByTeam[team.id] ?? []).find((m) => m.is_lead) ?? null : null);
  const campusOf = (team: TeamRow | null) => leadOf(team)?.campus ?? team?.campus ?? null;

  function personName(profileId: string, teamId: string): string {
    return (
      (membersByTeam[teamId] ?? []).find((m) => m.id === profileId)?.name ??
      staffAccounts.find((s) => s.id === profileId)?.name ??
      "Unknown"
    );
  }
  function positionOf(profileId: string, teamId: string): string {
    const member = (membersByTeam[teamId] ?? []).find((m) => m.id === profileId);
    if (member) return member.is_lead ? "Team Lead" : "Member";
    const staff = staffAccounts.find((s) => s.id === profileId);
    return staff?.role ?? "—";
  }

  const rows: HistoryRow[] = useMemo(() => {
    const exitRows: HistoryRow[] = exitRequests
      .filter((r): r is ExitRequestRow & { status: "Approved" | "Rejected" } => r.status === "Approved" || r.status === "Rejected")
      .map((r) => ({
        id: r.id,
        type: "Exit",
        team: teamOf(r.team_id),
        requestedByProfileId: r.requested_by,
        sentAt: r.requested_at,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
      }));

    const editRows: HistoryRow[] = approvalRequests
      .filter((r): r is ApprovalRequestRow & { status: "Approved" | "Rejected" } => r.status === "Approved" || r.status === "Rejected")
      .map((r) => ({
        id: r.id,
        type: "Profile Edit",
        team: teamOf(r.team_id),
        requestedByProfileId: r.requested_by,
        sentAt: r.created_at,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
      }));

    return [...exitRows, ...editRows].sort(
      (a, b) => new Date(b.reviewedAt ?? b.sentAt).getTime() - new Date(a.reviewedAt ?? a.sentAt).getTime(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitRequests, approvalRequests, teams, membersByTeam]);

  const campusOptions = useMemo(() => sortCampuses(Array.from(new Set(rows.map((r) => campusOf(r.team)).filter((c): c is NonNullable<typeof c> => Boolean(c))))), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (campusFilter && campusOf(r.team) !== campusFilter) return false;
      if (q) {
        const haystack = `${r.team?.team_name ?? ""} ${r.team?.team_id ?? ""} ${personName(r.requestedByProfileId, r.team?.id ?? "")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, typeFilter, statusFilter, campusFilter]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">No resolved requests yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!singleCampus && (
          <FilterSelect label="Campus" value={campusFilter} onChange={setCampusFilter} options={campusOptions} valueOptions={campusOptions} />
        )}
        <FilterSelect label="Type" value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} valueOptions={TYPE_OPTIONS} />
        <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} valueOptions={STATUS_OPTIONS} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team or requester…"
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "request-history",
              filteredRows.map((r) => ({
                "Request ID": r.id,
                ...(singleCampus ? {} : { Campus: campusOf(r.team) ?? "—" }),
                "Team ID": r.team?.team_id ?? "—",
                "Team Name": r.team?.team_name ?? "—",
                "Team Lead": leadOf(r.team)?.name ?? "—",
                "Requested By": personName(r.requestedByProfileId, r.team?.id ?? ""),
                Position: positionOf(r.requestedByProfileId, r.team?.id ?? ""),
                Type: r.type,
                "Sent At": r.sentAt,
                Status: r.status,
                "Reviewed By": r.reviewedBy ? (staffAccounts.find((s) => s.id === r.reviewedBy)?.name ?? "—") : "—",
                "Reviewed At": r.reviewedAt ?? "—",
              })),
            )
          }
          className="w-fit rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
        >
          Download CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                <th className="px-4 py-3">Request ID</th>
                {!singleCampus && <th className="px-4 py-3">Campus</th>}
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Team Lead</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Sent At</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reviewed By</th>
                <th className="px-4 py-3">Reviewed At</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={singleCampus ? 10 : 11} className="px-4 py-8 text-center text-ink-muted">
                    No requests match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={`${r.type}-${r.id}`} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-3 text-ink-faint" title={r.id}>
                      {r.id.slice(0, 8)}
                    </td>
                    {!singleCampus && <td className="px-4 py-3 text-ink-muted">{campusOf(r.team) ?? "—"}</td>}
                    <td className="px-4 py-3 text-ink">
                      {r.team?.team_name ?? "Unknown"} <span className="text-ink-faint">· {r.team?.team_id ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{leadOf(r.team)?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{personName(r.requestedByProfileId, r.team?.id ?? "")}</td>
                    <td className="px-4 py-3 text-ink-muted">{positionOf(r.requestedByProfileId, r.team?.id ?? "")}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.type}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                      {new Date(r.sentAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${
                          r.status === "Approved" ? "border-gitam/40 bg-gitam/10 text-gitam" : "border-danger/40 bg-danger/10 text-danger"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{r.reviewedBy ? (staffAccounts.find((s) => s.id === r.reviewedBy)?.name ?? "—") : "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                      {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
