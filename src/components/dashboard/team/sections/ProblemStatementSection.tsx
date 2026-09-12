"use client";

import { useState } from "react";
import type { TeamRow, ProblemStatementRow } from "@/types/database";
import { selectProblemStatement, DashboardActionError } from "@/lib/dashboard/team-actions";
import { effectiveConfigValue } from "@/lib/dashboard/campus-config";

const SELECTION_START_KEY = "problem_statement.selection_start";
const SELECTION_END_KEY = "problem_statement.selection_end";

/**
 * SPEC §30-38: problem statements are browsed via an admin-provided
 * spreadsheet link (not an in-app catalog), and the Team Lead selects by
 * entering the PS number, not browse-and-click. The spreadsheet link stays
 * hidden until Go Live (problem_statement.live_at is set) — set on the
 * admin Problem Statements page, not shown here until then rather than
 * faking it.
 */
export function ProblemStatementSection({
  team,
  currentProblemStatement,
  config,
  isLead,
}: {
  team: TeamRow;
  currentProblemStatement: ProblemStatementRow | null;
  config: Record<string, unknown>;
  isLead: boolean;
}) {
  const [psNumber, setPsNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [selected, setSelected] = useState<{ number: string; title: string } | null>(
    currentProblemStatement ? { number: currentProblemStatement.number, title: currentProblemStatement.title } : null,
  );

  const liveAt = typeof config["problem_statement.live_at"] === "string" ? (config["problem_statement.live_at"] as string) : null;
  const spreadsheetUrl = liveAt && typeof config["problem_statement.spreadsheet_url"] === "string"
    ? (config["problem_statement.spreadsheet_url"] as string)
    : null;

  // Selection is frozen until both bounds are configured — select_problem_statement
  // already enforces this server-side (SELECTION_NOT_CONFIGURED, 0049); this just
  // surfaces it proactively instead of only after a failed submit.
  const selectionStart = effectiveConfigValue(config, SELECTION_START_KEY, team.campus);
  const selectionEnd = effectiveConfigValue(config, SELECTION_END_KEY, team.campus);
  const notConfigured = !selectionStart || !selectionEnd;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = psNumber.trim();
    const n = Number(trimmed);
    if (!trimmed || !Number.isInteger(n) || n < 1 || n > 50) {
      setMessage({ kind: "error", text: "Enter a number between 1 and 50, exactly as listed on the sheet." });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await selectProblemStatement(team.id, String(n));
      setSelected({ number: result.number, title: result.title });
      setMessage({ kind: "success", text: "Problem statement selected." });
      setPsNumber("");
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof DashboardActionError ? err.message : "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Browse Problem Statements</span>
        {spreadsheetUrl ? (
          <p className="mt-3 font-heading text-sm text-ink">
            <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="text-gold underline">
              Open the problem statement sheet ↗
            </a>
          </p>
        ) : (
          <p className="mt-3 font-heading text-sm text-ink-muted">The problem statement list hasn&rsquo;t gone live yet.</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Current Selection</span>
        {selected ? (
          <p className="mt-3 font-heading text-lg text-ink">
            #{selected.number} — {selected.title}
          </p>
        ) : (
          <p className="mt-3 font-heading text-sm text-ink-muted">Your team hasn&rsquo;t selected a problem statement yet.</p>
        )}
      </div>

      {isLead && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Select / Change</span>
          {notConfigured ? (
            <p className="mt-2 font-heading text-xs text-danger">
              Selection deadline not yet set — ask your Campus Admin or Super Admin to configure it before you can select.
            </p>
          ) : (
            <p className="mt-2 font-heading text-xs text-ink-muted">
              Pick a problem statement from the sheet above and enter its number (1–50) — you can change this any
              number of times until the selection window closes.
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <input
              type="number"
              min={1}
              max={50}
              value={psNumber}
              onChange={(e) => setPsNumber(e.target.value)}
              placeholder="1–50"
              required
              disabled={notConfigured}
              className="flex-1 rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={submitting || notConfigured}
              title={notConfigured ? "Selection deadline not yet set." : undefined}
              className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {submitting ? "Submitting…" : notConfigured ? "Deadline Not Set" : "Select"}
            </button>
          </div>
          {message && (
            <p className={`mt-3 font-heading text-sm ${message.kind === "error" ? "text-danger" : "text-gitam"}`}>
              {message.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
