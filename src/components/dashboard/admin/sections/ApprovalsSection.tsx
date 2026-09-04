"use client";

import { Fragment, useMemo, useState } from "react";
import type { ApprovalRequestRow, ExitRequestRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { resolveApprovalRequest, resolveMemberExit, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { getSignedUrl } from "@/lib/dashboard/team-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "pending" | "by-team";

export function ApprovalsSection({
  pendingApprovals,
  exitRequests,
  teams,
  membersByTeam,
}: {
  pendingApprovals: ApprovalRequestRow[];
  exitRequests: ExitRequestRow[];
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
}) {
  const [localRequests, setLocalRequests] = useState(pendingApprovals);
  const [localExitRequests, setLocalExitRequests] = useState(exitRequests.filter((r) => r.status === "Requested"));
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

  async function handleResolveExit(requestId: string, decision: "Approved" | "Rejected") {
    setBusyId(requestId);
    setError(null);
    try {
      await resolveMemberExit(requestId, decision);
      setLocalExitRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleViewExitFile(filePath: string) {
    const url = await getSignedUrl("exit-requests", filePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  const byTeam = useMemo(() => {
    const groups = new Map<string, { edits: ApprovalRequestRow[]; exits: ExitRequestRow[] }>();
    for (const req of localRequests) {
      const entry = groups.get(req.team_id) ?? { edits: [], exits: [] };
      entry.edits.push(req);
      groups.set(req.team_id, entry);
    }
    for (const req of localExitRequests) {
      const entry = groups.get(req.team_id) ?? { edits: [], exits: [] };
      entry.exits.push(req);
      groups.set(req.team_id, entry);
    }
    return groups;
  }, [localRequests, localExitRequests]);

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

  function renderExitRequest(req: ExitRequestRow) {
    const team = teams.find((t) => t.id === req.team_id);
    const member = (membersByTeam[req.team_id] ?? []).find((m) => m.id === req.profile_id);
    return (
      <div key={req.id} className="rounded-xl border border-danger/40 bg-danger/5 p-6">
        <p className="font-heading text-sm text-danger">Exit Request — {team?.team_name ?? "Unknown team"}</p>
        <p className="mt-2 font-heading text-sm text-ink">{member?.name ?? "Unknown member"}</p>
        {req.reason && <p className="mt-1 font-heading text-xs text-ink-muted">Reason: {req.reason}</p>}
        {req.file_path && (
          <button
            type="button"
            onClick={() => handleViewExitFile(req.file_path!)}
            className="mt-2 font-heading text-sm text-gold underline"
          >
            View Exit Form
          </button>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={busyId === req.id}
            onClick={() => handleResolveExit(req.id, "Approved")}
            className="rounded-full bg-gitam px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:opacity-90 disabled:opacity-60"
          >
            Approve Exit
          </button>
          <button
            type="button"
            disabled={busyId === req.id}
            onClick={() => handleResolveExit(req.id, "Rejected")}
            className="rounded-full border border-danger/40 px-6 py-2.5 font-heading text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (localRequests.length === 0 && localExitRequests.length === 0) {
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
          ? [...localRequests.map(renderRequest), ...localExitRequests.map(renderExitRequest)]
          : Array.from(byTeam.entries()).map(([teamId, { edits, exits }]) => {
              const team = teams.find((t) => t.id === teamId);
              return (
                <Fragment key={teamId}>
                  <p className="font-heading text-xs tracking-[0.2em] text-ink-muted uppercase">
                    {team?.team_name ?? "Unknown team"}
                  </p>
                  {edits.map(renderRequest)}
                  {exits.map(renderExitRequest)}
                </Fragment>
              );
            })}
      </div>
    </div>
  );
}
