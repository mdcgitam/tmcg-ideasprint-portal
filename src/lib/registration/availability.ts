import { createClient } from "@/lib/supabase/client";
import type { MemberFormValues } from "./schema";

/**
 * Uniqueness checks against SPEC.md §12 (team name, university email,
 * registration number, mobile number, existing-participant). These call
 * anon-safe RPCs (supabase/migrations/0001_init_schema.sql) that return a
 * boolean only — never raw table access, so no participant PII is exposed
 * via anon SELECT. Frontend checks here are UX only — the database's unique
 * constraints (enforced inside register_team) are the authoritative
 * enforcement (prompt.md §20).
 */

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
}

export async function checkTeamNameAvailable(teamName: string): Promise<AvailabilityResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("check_team_name_available", { p_team_name: teamName });
  if (error) return { available: true }; // fail open — the DB's unique constraint is the real gate
  return { available: (data as boolean | null) ?? true };
}

export async function checkParticipantAvailable(
  field: "gitamEmail" | "regNo" | "phone",
  value: string,
): Promise<AvailabilityResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("check_participant_available", { p_field: field, p_value: value });
  if (error) return { available: true };
  return { available: (data as boolean | null) ?? true };
}

/** Detects duplicates *within* the team being submitted, entirely client-side. */
export function findInTeamDuplicates(members: MemberFormValues[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen: Record<"gitamEmail" | "regNo" | "phone", Map<string, number>> = {
    gitamEmail: new Map(),
    regNo: new Map(),
    phone: new Map(),
  };

  members.forEach((member, index) => {
    (["gitamEmail", "regNo", "phone"] as const).forEach((field) => {
      const value = member[field].trim().toLowerCase();
      if (!value) return;
      const firstIndex = seen[field].get(value);
      if (firstIndex !== undefined) {
        errors[`members.${index}.${field}`] = `Already used by Member ${firstIndex + 1} in this team`;
      } else {
        seen[field].set(value, index);
      }
    });
  });

  return errors;
}

export { submitRegistration } from "./actions";
export type { SubmitRegistrationInput, SubmitRegistrationResult, SubmitRegistrationOutcome } from "./actions";
