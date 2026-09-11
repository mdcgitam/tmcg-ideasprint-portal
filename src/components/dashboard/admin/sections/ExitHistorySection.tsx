"use client";

import { useMemo, useState } from "react";
import type { ExitRequestRow, ProfileRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { sortCampuses } from "@/lib/dashboard/campus-config";
import { downloadCsv } from "@/lib/csv";
import { getSignedUrl } from "@/lib/dashboard/team-actions";
import { FilterSelect } from "./TeamFormFields";

const POSITION_OPTIONS = ["Team Lead", "Member"];

/** Resolved exit requests only — a merged history with Profile Edit requests is planned separately. */
export function ExitHistorySection({
  teams,
  membersByTeam,
  exitRequests,
  staffAccounts,
  singleCampus = false,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  exitRequests: ExitRequestRow[];
  staffAccounts: ProfileRow[];
  singleCampus?: boolean;
}) {
  const [campusFilter, setCampusFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [reviewerFilter, setReviewerFilter] = useState("");
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
  function positionOf(profileId: string, teamId: string): "Team Lead" | "Member" | "—" {
    const member = (membersByTeam[teamId] ?? []).find((m) => m.id === profileId);
    return member ? (member.is_lead ? "Team Lead" : "Member") : "—";
  }
  function reviewerName(reviewedBy: string | null): string {
    return reviewedBy ? (staffAccounts.find((s) => s.id === reviewedBy)?.name ?? "Unknown") : "—";
  }
  async function handleView(filePath: string) {
    const url = await getSignedUrl("exit-requests", filePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  const resolvedRequests = useMemo(
    () => exitRequests.filter((r): r is ExitRequestRow & { status: "Approved" | "Rejected" } => r.status === "Approved" || r.status === "Rejected"),
    [exitRequests],
  );

  const campusOptions = useMemo(() => sortCampuses(Array.from(new Set(resolvedRequests.map((r) => campusOf(teamOf(r.team_id))).filter((c): c is NonNullable<typeof c> => Boolean(c))))), [resolvedRequests]); // eslint-disable-line react-hooks/exhaustive-deps
  const reviewerOptions = useMemo(
    () => Array.from(new Set(resolvedRequests.map((r) => r.reviewed_by).filter((id): id is string => Boolean(id)))),
    [resolvedRequests],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...resolvedRequests]
      .sort((a, b) => new Date(b.reviewed_at ?? b.requested_at).getTime() - new Date(a.reviewed_at ?? a.requested_at).getTime())
      .filter((r) => {
        const team = teamOf(r.team_id);
        if (campusFilter && campusOf(team) !== campusFilter) return false;
        if (positionFilter && positionOf(r.requested_by, r.team_id) !== positionFilter) return false;
        if (reviewerFilter && r.reviewed_by !== reviewerFilter) return false;
        if (q) {
          const haystack = `${r.id} ${team?.team_name ?? ""} ${personName(r.requested_by, r.team_id)}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedRequests, search, campusFilter, positionFilter, reviewerFilter]);

  if (resolvedRequests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">No resolved exit requests yet.</p>
      </div>
    );
  }

  const columnCount = 10 + (singleCampus ? 0 : 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!singleCampus && (
          <FilterSelect label="Campus" value={campusFilter} onChange={setCampusFilter} options={campusOptions} valueOptions={campusOptions} />
        )}
        <FilterSelect label="Position" value={positionFilter} onChange={setPositionFilter} options={POSITION_OPTIONS} valueOptions={POSITION_OPTIONS} />
        <FilterSelect
          label="Reviewed By"
          value={reviewerFilter}
          onChange={setReviewerFilter}
          options={reviewerOptions.map((id) => staffAccounts.find((s) => s.id === id)?.name ?? "Unknown")}
          valueOptions={reviewerOptions}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search request ID, team, or requester…"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "exit-request-history",
              filteredRows.map((r) => {
                const team = teamOf(r.team_id);
                return {
                  "Request ID": r.id,
                  ...(singleCampus ? {} : { Campus: campusOf(team) ?? "—" }),
                  "Team ID": team?.team_id ?? "—",
                  "Team Name": team?.team_name ?? "—",
                  "Requested By": personName(r.requested_by, r.team_id),
                  Position: positionOf(r.requested_by, r.team_id),
                  "Requested At": r.requested_at,
                  Status: r.status,
                  "Reviewed By": reviewerName(r.reviewed_by),
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

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                <th className="px-4 py-3">Request ID</th>
                {!singleCampus && <th className="px-4 py-3">Campus</th>}
                <th className="px-4 py-3">Team ID</th>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Requested At</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reviewed By</th>
                <th className="px-4 py-3">Reviewed At</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-8 text-center text-ink-muted">
                    No requests match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const team = teamOf(r.team_id);
                  return (
                    <tr key={r.id} className="border-b border-border align-top last:border-0">
                      <td className="px-4 py-3 text-ink-faint" title={r.id}>
                        {r.id.slice(0, 8)}
                      </td>
                      {!singleCampus && <td className="px-4 py-3 text-ink-muted">{campusOf(team) ?? "—"}</td>}
                      <td className="px-4 py-3 text-ink-muted">{team?.team_id ?? "—"}</td>
                      <td className="px-4 py-3 text-ink">{team?.team_name ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-ink-muted">{personName(r.requested_by, r.team_id)}</td>
                      <td className="px-4 py-3 text-ink-muted">{positionOf(r.requested_by, r.team_id)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                        {new Date(r.requested_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
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
                      <td className="px-4 py-3 text-ink-muted">{reviewerName(r.reviewed_by)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                        {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.file_path && (
                          <button type="button" onClick={() => handleView(r.file_path!)} className="font-heading text-xs text-gold underline">
                            View
                          </button>
                        )}
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
