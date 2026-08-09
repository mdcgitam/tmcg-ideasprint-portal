"use client";

import { useState } from "react";
import type { TeamRow, NocRow, ExitFormRow, ProfileRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { deleteNoc, deleteNocFile, getSignedUrl, DashboardActionError } from "@/lib/dashboard/team-actions";
import { extendProblemStatementDeadline } from "@/lib/dashboard/admin-actions";

export function TeamsListSection({
  teams,
  membersByTeam,
  nocs,
  exitForms,
  scope,
  spocs,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  nocs: NocRow[];
  exitForms: ExitFormRow[];
  scope: "spoc" | "admin";
  spocs: ProfileRow[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [localNocs, setLocalNocs] = useState(nocs);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [extendUntil, setExtendUntil] = useState<Record<string, string>>({});
  const [extendReason, setExtendReason] = useState<Record<string, string>>({});
  const [extending, setExtending] = useState<string | null>(null);
  const [extendMessage, setExtendMessage] = useState<Record<string, string>>({});

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
    <div className="flex flex-col gap-3">
      {error && <p className="font-heading text-sm text-danger">{error}</p>}
      {teams.map((team) => {
        const members = membersByTeam[team.id] ?? [];
        const lead = members.find((m) => m.is_lead);
        const isOpen = expanded === team.id;
        const exitForm = exitForms.find((e) => e.team_id === team.id);
        const spocName = spocs.find((s) => s.id === team.spoc_profile_id)?.name;

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
                                Delete
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-4 font-heading text-xs text-ink-muted">
                  Exit Form: {exitForm?.status ?? "Not Submitted"}
                </p>

                {scope === "admin" && (
                  <p className="mt-2 font-heading text-xs text-ink-muted">
                    Assigned SPOC: {spocName ?? "Unassigned"}{" "}
                    <span className="text-ink-faint">— change this from the SPOC Assignment tab</span>
                  </p>
                )}

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
      })}
    </div>
  );
}
