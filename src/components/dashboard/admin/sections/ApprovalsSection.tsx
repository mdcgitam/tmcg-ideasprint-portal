"use client";

import { Fragment, useMemo, useState } from "react";
import type { ApprovalRequestRow, TeamRow } from "@/types/database";
import { resolveApprovalRequest, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "pending" | "by-team";

export function ApprovalsSection({
  pendingApprovals,
  teams,
}: {
  pendingApprovals: ApprovalRequestRow[];
  teams: TeamRow[];
}) {
  const [localRequests, setLocalRequests] = useState(pendingApprovals);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("pending");
  const fadeRef = useTabFade(view);

  async function handleResolve(requestId: string, decision: "Approved" | "Rejected") {
    setBusyId(requestId);
    setError(null);
    try {
      await resolveApprovalRequest(requestId, decision);
      setLocalRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const byTeam = useMemo(() => {
    const groups = new Map<string, ApprovalRequestRow[]>();
    for (const req of localRequests) {
      const list = groups.get(req.team_id) ?? [];
      list.push(req);
      groups.set(req.team_id, list);
    }
    return groups;
  }, [localRequests]);

  function renderRequest(req: ApprovalRequestRow) {
    const team = teams.find((t) => t.id === req.team_id);
    return (
      <div key={req.id} className="rounded-xl border border-gold/40 bg-gold/5 p-6">
        <p className="font-heading text-sm text-gold">{team?.team_name ?? "Unknown team"}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Current</span>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-void p-3 font-mono text-xs text-ink-muted">
              {JSON.stringify(req.current_snapshot, null, 2)}
            </pre>
          </div>
          <div>
            <span className="font-mono text-xs tracking-[0.2em] text-gold uppercase">Requested</span>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-void p-3 font-mono text-xs text-ink">
              {JSON.stringify(req.requested_changes, null, 2)}
            </pre>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={busyId === req.id}
            onClick={() => handleResolve(req.id, "Approved")}
            className="rounded-full bg-gitam px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:opacity-90 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busyId === req.id}
            onClick={() => handleResolve(req.id, "Rejected")}
            className="rounded-full border border-danger/40 px-6 py-2.5 font-heading text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (localRequests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">No pending approval requests.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "pending", label: "View by Request" },
          { value: "by-team", label: "View by Team" },
        ]}
      />

      {error && <p className="font-heading text-sm text-danger">{error}</p>}

      <div ref={fadeRef} className="flex flex-col gap-4">
        {view === "pending"
          ? localRequests.map(renderRequest)
          : Array.from(byTeam.entries()).map(([teamId, requests]) => {
              const team = teams.find((t) => t.id === teamId);
              return (
                <Fragment key={teamId}>
                  <p className="font-heading text-xs tracking-[0.2em] text-ink-muted uppercase">
                    {team?.team_name ?? "Unknown team"}
                  </p>
                  {requests.map(renderRequest)}
                </Fragment>
              );
            })}
      </div>
    </div>
  );
}
