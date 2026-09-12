"use client";

import { useState } from "react";
import type { TeamRow, ProblemStatementRow } from "@/types/database";
import { selectProblemStatement, DashboardActionError } from "@/lib/dashboard/team-actions";
import {
  campusOverrideBoolean,
  campusOverrideValue,
  effectiveConfigValue,
  parseProblemStatementCode,
  problemStatementMaxNumber,
  PROBLEM_STATEMENT_PREFIX,
} from "@/lib/dashboard/campus-config";

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

  // A campus-specific live_at (set by Super Admin going live for just this
  // campus) always wins over the global one, whichever was edited more
  // recently — see campusOverrideValue. The spreadsheet URL itself is one
  // shared value, not campus-specific.
  const liveAt = campusOverrideValue(config, "problem_statement.live_at", team.campus);
  // Super Admin can pause selection for this campus without un-releasing
  // anything — hides the sheet link here too, with a message that reads
  // as "temporary", not "never launched".
  const paused = campusOverrideBoolean(config, "problem_statement.hidden", team.campus);
  const spreadsheetUrl =
    liveAt && !paused && typeof config["problem_statement.spreadsheet_url"] === "string"
      ? (config["problem_statement.spreadsheet_url"] as string)
      : null;

  // Selection is frozen until both bounds are configured — select_problem_statement
  // already enforces this server-side (SELECTION_NOT_CONFIGURED, 0049); this just
  // surfaces it proactively instead of only after a failed submit.
  const selectionStart = effectiveConfigValue(config, SELECTION_START_KEY, team.campus);
  const selectionEnd = effectiveConfigValue(config, SELECTION_END_KEY, team.campus);
  const notConfigured = !selectionStart || !selectionEnd || paused;
  const psMax = problemStatementMaxNumber(config, team.campus);
  const psPrefix = PROBLEM_STATEMENT_PREFIX[team.campus];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = psNumber.trim();
    const parsed = parseProblemStatementCode(trimmed);
    if (!trimmed || !parsed || parsed.campus !== team.campus || parsed.number < 1 || parsed.number > psMax) {
      setMessage({ kind: "error", text: `Enter a code between ${psPrefix}1 and ${psPrefix}${psMax}, exactly as listed on your campus's sheet tab.` });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await selectProblemStatement(team.id, `${psPrefix}${parsed.number}`);
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
        ) : paused ? (
          <p className="mt-3 font-heading text-sm text-gold">Temporarily paused — check back shortly.</p>
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
          {paused ? (
            <p className="mt-2 font-heading text-xs text-gold">Selection is temporarily paused — check back shortly.</p>
          ) : notConfigured ? (
            <p className="mt-2 font-heading text-xs text-danger">
              Selection deadline not yet set — ask your Campus Admin or Super Admin to configure it before you can select.
            </p>
          ) : (
            <p className="mt-2 font-heading text-xs text-ink-muted">
              Pick a problem statement from your campus&rsquo;s tab in the sheet above and enter its code ({psPrefix}1–{psPrefix}
              {psMax}) — you can change this any number of times until the selection window closes.
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <input
              type="text"
              value={psNumber}
              onChange={(e) => setPsNumber(e.target.value)}
              placeholder={`${psPrefix}1–${psPrefix}${psMax}`}
              required
              disabled={notConfigured}
              className="flex-1 rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={submitting || notConfigured}
              title={paused ? "Selection is temporarily paused." : notConfigured ? "Selection deadline not yet set." : undefined}
              className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {submitting ? "Submitting…" : paused ? "Paused" : notConfigured ? "Deadline Not Set" : "Select"}
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
