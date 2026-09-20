"use client";

import { useMemo } from "react";
import type { ProblemStatementRow, TeamRow } from "@/types/database";
import { CAMPUS_ORDER, parseProblemStatementCode, sortCampuses } from "@/lib/dashboard/campus-config";

/**
 * Read-only Problem Statement selection analytics — one table per campus,
 * since each campus numbers its problem statements independently (V1..,
 * H1.., B1..) so a single merged table would mix unrelated codes together.
 * Originally the Problem Statements module's own "Analytics" tab; moved
 * here so Overview can be the one place with every count (Summary,
 * Breakdown, Headcount, Analytics) instead of duplicating it in two places.
 */
export function ProblemStatementAnalytics({
  problemStatements,
  teams,
  singleCampus = false,
}: {
  problemStatements: ProblemStatementRow[];
  teams: TeamRow[];
  singleCampus?: boolean;
}) {
  const campusOptions = useMemo(() => sortCampuses(Array.from(new Set(teams.map((t) => t.campus)))), [teams]);
  const analyticsCampuses = singleCampus ? campusOptions : CAMPUS_ORDER;

  const analyticsByCampus = useMemo(() => {
    return analyticsCampuses.map((campus) => {
      const teamsInCampus = teams.filter((t) => t.campus === campus);
      const psInCampus = problemStatements.filter((p) => p.campus === campus);
      const counts = new Map<string, { number: string; count: number; teamNames: string[] }>();
      for (const ps of psInCampus) {
        counts.set(ps.id, { number: ps.number, count: 0, teamNames: [] });
      }
      for (const team of teamsInCampus) {
        if (!team.current_problem_statement_id) continue;
        const entry = counts.get(team.current_problem_statement_id);
        if (entry) {
          entry.count += 1;
          entry.teamNames.push(team.team_name);
        }
      }
      const rows = Array.from(counts.values()).sort((a, b) => {
        const pa = parseProblemStatementCode(a.number);
        const pb = parseProblemStatementCode(b.number);
        if (pa && pb) return pa.number - pb.number;
        return a.number.localeCompare(b.number);
      });
      const totalSelected = teamsInCampus.filter((t) => t.current_problem_statement_id).length;
      const totalReleased = psInCampus.filter((p) => p.status === "Released").length;
      return { campus, rows, totalSelected, totalTeams: teamsInCampus.length, totalReleased };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemStatements, teams, singleCampus, campusOptions]);

  const analyticsTotals = {
    totalSelected: analyticsByCampus.reduce((sum, c) => sum + c.totalSelected, 0),
    totalTeams: analyticsByCampus.reduce((sum, c) => sum + c.totalTeams, 0),
    totalReleased: analyticsByCampus.reduce((sum, c) => sum + c.totalReleased, 0),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Teams Selected</span>
          <p className="mt-2 font-display text-3xl text-ink">
            {analyticsTotals.totalSelected}
            <span className="ml-2 font-heading text-sm text-ink-muted">of {analyticsTotals.totalTeams}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Problem Statements Live</span>
          <p className="mt-2 font-display text-3xl text-ink">{analyticsTotals.totalReleased}</p>
        </div>
      </div>

      {analyticsByCampus.map(({ campus, rows, totalSelected, totalTeams }) => (
        <div key={campus} className="flex flex-col gap-2">
          {!singleCampus && (
            <span className="font-mono text-xs tracking-[0.2em] text-gold uppercase">
              {campus} - {totalSelected} of {totalTeams} selected
            </span>
          )}
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left font-heading text-sm">
              <thead>
                <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                  <th className="px-4 py-3">PS Code</th>
                  <th className="px-4 py-3">No. of Teams</th>
                  <th className="px-4 py-3">Teams</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-ink-muted">
                      No problem statements released for {campus} yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.number} className="border-b border-border align-top last:border-0">
                      <td className="px-4 py-3 text-ink">{row.number}</td>
                      <td className="px-4 py-3 text-ink-muted">{row.count}</td>
                      <td className="px-4 py-3 text-ink-muted">{row.teamNames.length === 0 ? "-" : row.teamNames.join(", ")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
