"use client";

import { useMemo, useState } from "react";
import type { ApprovalRequestRow, ProfileRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { resolveApprovalRequest, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { buildEditDiff, summarizeDiff } from "@/lib/dashboard/approval-diff";
import { sortCampuses } from "@/lib/dashboard/campus-config";
import { downloadCsv } from "@/lib/csv";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";
import { FilterSelect } from "./TeamFormFields";

type View = "requests" | "history";

/** "Profile Requests" — a Team Lead's team/member edit requests, reviewed by SPOC/Zone Manager/Campus Admin/Super Admin. Two tabs: Requests (open, actionable) and History (resolved, read-only) — no separate "by team" view, since a request already carries its team's full context inline. */
export function ApprovalsSection({
  approvalRequests,
  teams,
  membersByTeam,
  staffAccounts,
  singleCampus = false,
}: {
  approvalRequests: ApprovalRequestRow[];
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  staffAccounts: ProfileRow[];
  singleCampus?: boolean;
}) {
  const [localRequests, setLocalRequests] = useState(approvalRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("requests");
  const fadeRef = useTabFade(view);

  const [campusFilter, setCampusFilter] = useState("");
  const [search, setSearch] = useState("");

  const leadOf = (team: TeamRow | undefined) => (team ? (membersByTeam[team.id] ?? []).find((m) => m.is_lead) : null) ?? null;
  const campusOf = (team: TeamRow | undefined) => leadOf(team)?.campus ?? team?.campus ?? null;
  const requesterName = (req: ApprovalRequestRow) =>
    (membersByTeam[req.team_id] ?? []).find((m) => m.id === req.requested_by)?.name ?? "Unknown";
  const reviewerName = (id: string | null) => (id ? (staffAccounts.find((s) => s.id === id)?.name ?? "Unknown") : "—");

  async function handleResolve(requestId: string, decision: "Approved" | "Rejected") {
    setBusyId(requestId);
    setError(null);
    try {
      await resolveApprovalRequest(requestId, decision);
      setLocalRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: decision, reviewed_at: new Date().toISOString() } : r)),
      );
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const campusOptions = useMemo(
    () => sortCampuses(Array.from(new Set(teams.map((t) => campusOf(t)).filter((c): c is NonNullable<typeof c> => Boolean(c))))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teams, membersByTeam],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = localRequests.filter((r) => {
      if (view === "requests" && r.status !== "Pending") return false;
      if (view === "history" && r.status === "Pending") return false;
      const team = teams.find((t) => t.id === r.team_id);
      if (campusFilter && campusOf(team) !== campusFilter) return false;
      if (q && !`${team?.team_name ?? ""} ${team?.team_id ?? ""} ${requesterName(r)}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return view === "requests"
      ? filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      : filtered.sort((a, b) => new Date(b.reviewed_at ?? b.created_at).getTime() - new Date(a.reviewed_at ?? a.created_at).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localRequests, view, teams, membersByTeam, campusFilter, search]);

  function handleExportCsv() {
    downloadCsv(view === "requests" ? "profile-requests" : "profile-requests-history", rows.map((r) => {
      const team = teams.find((t) => t.id === r.team_id);
      const diff = buildEditDiff(r.current_snapshot, r.requested_changes);
      return {
        "Request ID": r.id,
        ...(singleCampus ? {} : { Campus: campusOf(team) ?? "—" }),
        "Team ID": team?.team_id ?? "—",
        "Team Name": team?.team_name ?? "Unknown team",
        "Requested By": requesterName(r),
        "Requested At": r.created_at,
        ...(view === "history" ? { Status: r.status, "Reviewed By": reviewerName(r.reviewed_by), "Reviewed At": r.reviewed_at ?? "—" } : {}),
        Changes: summarizeDiff(diff, (id) => membersByTeam[r.team_id]?.find((m) => m.id === id)?.name ?? "Member"),
      };
    }));
  }

  const columnCount = (singleCampus ? 0 : 1) + 5 + (view === "history" ? 3 : 1);

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "requests", label: "Requests" },
          { value: "history", label: "History" },
        ]}
      />

      <div ref={fadeRef} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {!singleCampus && (
            <FilterSelect label="Campus" value={campusFilter} onChange={setCampusFilter} options={campusOptions} valueOptions={campusOptions} />
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team, team ID, or requester…"
            className="min-w-[200px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
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
                  <th className="px-4 py-3">Request ID</th>
                  {!singleCampus && <th className="px-4 py-3">Campus</th>}
                  <th className="px-4 py-3">Team ID</th>
                  <th className="px-4 py-3">Team Name</th>
                  <th className="px-4 py-3">Requested By</th>
                  <th className="px-4 py-3">Requested At</th>
                  {view === "history" && (
                    <>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Reviewed By</th>
                      <th className="px-4 py-3">Reviewed At</th>
                    </>
                  )}
                  <th className="px-4 py-3">Changes</th>
                  {view === "requests" && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-4 py-8 text-center text-ink-muted">
                      {view === "requests" ? "No pending requests." : "No resolved requests yet."}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const team = teams.find((t) => t.id === r.team_id);
                    const diff = buildEditDiff(r.current_snapshot, r.requested_changes);
                    const busy = busyId === r.id;
                    return (
                      <tr key={r.id} className="border-b border-border align-top last:border-0">
                        <td className="px-4 py-3 text-ink-faint" title={r.id}>
                          {r.id.slice(0, 8)}
                        </td>
                        {!singleCampus && <td className="px-4 py-3 text-ink-muted">{campusOf(team) ?? "—"}</td>}
                        <td className="px-4 py-3 text-ink-muted">{team?.team_id ?? "—"}</td>
                        <td className="px-4 py-3 text-ink">{team?.team_name ?? "Unknown team"}</td>
                        <td className="px-4 py-3 text-ink-muted">{requesterName(r)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                          {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        {view === "history" && (
                          <>
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
                          </>
                        )}
                        <td className="max-w-md px-4 py-3 text-ink-muted">{summarizeDiff(diff, (id) => membersByTeam[r.team_id]?.find((m) => m.id === id)?.name ?? "Member")}</td>
                        {view === "requests" && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleResolve(r.id, "Approved")}
                                className="rounded-full bg-gitam px-3 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:opacity-90 disabled:opacity-60"
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
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
