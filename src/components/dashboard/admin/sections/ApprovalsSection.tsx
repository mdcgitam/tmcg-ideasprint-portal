"use client";

import { Fragment, useMemo, useState } from "react";
import type { ApprovalRequestRow, ExitRequestRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { resolveApprovalRequest, resolveMemberExit, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { getSignedUrl } from "@/lib/dashboard/team-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "pending" | "by-team";

// Fields a Team Lead can put into an edit request (see ProfileSection's
// `toEditable`) plus the team-name field — mapped to human labels.
const MEMBER_FIELD_LABELS: Array<[string, string]> = [
  ["name", "Name"],
  ["phone", "Phone"],
  ["graduation", "Graduation"],
  ["program", "Program"],
  ["yearOfStudy", "Year of Study"],
  ["school", "School"],
  ["department", "Department"],
  ["branch", "Branch"],
  ["gender", "Gender"],
  ["stay", "Stay"],
];

interface FieldChange {
  label: string;
  from: string;
  to: string;
}
interface MemberDiff {
  profileId: string;
  changes: FieldChange[];
}
interface EditDiff {
  teamName: FieldChange | null;
  members: MemberDiff[];
  /** Only used when the request isn't the known {team, members} shape. */
  generic: FieldChange[];
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join(", ");
  }
  return String(v);
}

function prettifyKey(k: string): string {
  return k
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Turn a request's before/after snapshots into a field-level diff — the
 *  reviewer sees only what actually changes, not the whole record. */
function buildEditDiff(currentRaw: unknown, requestedRaw: unknown): EditDiff {
  const current = (currentRaw ?? {}) as Record<string, unknown>;
  const requested = (requestedRaw ?? {}) as Record<string, unknown>;

  const isKnownShape =
    "team" in requested || "members" in requested || "team" in current || "members" in current;

  if (isKnownShape) {
    const curTeam = (current.team ?? {}) as Record<string, unknown>;
    const reqTeam = (requested.team ?? {}) as Record<string, unknown>;
    const teamFrom = asText(curTeam.teamName);
    const teamTo = asText(reqTeam.teamName);
    const teamName: FieldChange | null =
      teamFrom !== teamTo ? { label: "Team Name", from: teamFrom, to: teamTo } : null;

    const curMembers = (Array.isArray(current.members) ? current.members : []) as Record<string, unknown>[];
    const reqMembers = (Array.isArray(requested.members) ? requested.members : []) as Record<string, unknown>[];

    const members: MemberDiff[] = [];
    reqMembers.forEach((rm, i) => {
      const cm =
        curMembers.find((m) => m.profileId === rm.profileId) ?? curMembers[i] ?? ({} as Record<string, unknown>);
      const changes: FieldChange[] = [];
      for (const [key, label] of MEMBER_FIELD_LABELS) {
        const from = asText(cm[key]);
        const to = asText(rm[key]);
        if (from !== to) changes.push({ label, from, to });
      }
      if (changes.length > 0) members.push({ profileId: String(rm.profileId ?? i), changes });
    });

    return { teamName, members, generic: [] };
  }

  const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(requested)]));
  const generic = keys
    .map((k) => ({ label: prettifyKey(k), from: asText(current[k]), to: asText(requested[k]) }))
    .filter((c) => c.from !== c.to);
  return { teamName: null, members: [], generic };
}

function DiffRow({ label, from, to }: FieldChange) {
  return (
    <div className="flex flex-wrap items-center gap-2 font-heading text-sm">
      <span className="min-w-[7.5rem] font-mono text-[11px] tracking-[0.15em] text-ink-muted uppercase">{label}</span>
      <span className="rounded bg-danger/10 px-2 py-0.5 text-danger line-through decoration-danger/50">
        {from || "—"}
      </span>
      <span aria-hidden className="text-ink-faint">
        →
      </span>
      <span className="rounded bg-gitam/10 px-2 py-0.5 text-gitam">{to || "—"}</span>
    </div>
  );
}

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
    const teamMembers = membersByTeam[req.team_id] ?? [];
    const diff = buildEditDiff(req.current_snapshot, req.requested_changes);
    const nothing = !diff.teamName && diff.members.length === 0 && diff.generic.length === 0;

    return (
      <div key={req.id} className="rounded-xl border border-gold/40 bg-gold/5 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-heading text-sm text-gold">{team?.team_name ?? "Unknown team"}</p>
          {team && <p className="font-mono text-xs text-ink-faint">{team.team_id}</p>}
        </div>
        <p className="mt-1 font-heading text-xs text-ink-muted">
          Team edit request · submitted{" "}
          {new Date(req.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </p>
        <p className="mt-3 font-heading text-xs text-ink-faint">
          <span className="text-danger">Previous</span> → <span className="text-gitam">Requested</span>
        </p>

        <div className="mt-3 flex flex-col gap-3">
          {nothing && (
            <p className="font-heading text-sm text-ink-muted">This request doesn&rsquo;t change any fields.</p>
          )}

          {diff.teamName && (
            <div className="rounded-lg border border-border bg-void/40 p-4">
              <p className="mb-2 font-mono text-[11px] tracking-[0.2em] text-ink-muted uppercase">Team</p>
              <DiffRow {...diff.teamName} />
            </div>
          )}

          {diff.members.map((md) => {
            const m = teamMembers.find((x) => x.id === md.profileId);
            return (
              <div key={md.profileId} className="rounded-lg border border-border bg-void/40 p-4">
                <p className="font-heading text-sm text-ink">
                  {m?.name ?? "Member"}
                  {m && <span className="text-ink-faint"> · {m.user_id}</span>}
                </p>
                {m && (
                  <p className="mt-0.5 font-heading text-xs text-ink-muted">
                    {m.gitam_email} · {m.reg_no}
                    {m.is_lead ? " · Team Lead" : ""}
                  </p>
                )}
                <div className="mt-3 flex flex-col gap-2">
                  {md.changes.map((c) => (
                    <DiffRow key={c.label} {...c} />
                  ))}
                </div>
              </div>
            );
          })}

          {diff.generic.length > 0 && (
            <div className="rounded-lg border border-border bg-void/40 p-4">
              <div className="flex flex-col gap-2">
                {diff.generic.map((c) => (
                  <DiffRow key={c.label} {...c} />
                ))}
              </div>
            </div>
          )}
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
