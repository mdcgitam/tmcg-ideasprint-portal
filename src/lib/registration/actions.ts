"use server";

import { createServiceClient } from "@/lib/supabase/service";
import type { RegisterTeamResult } from "@/types/database";
import type { MemberFormValues, TeamDetailsFormValues } from "./schema";

export interface SubmitRegistrationInput {
  team: TeamDetailsFormValues;
  members: MemberFormValues[];
}

export interface SubmitRegistrationResult {
  teamId: string;
  userIds: string[];
}

// A discriminated return value, not a thrown error — Server Functions don't
// preserve custom Error subclasses across the server/client boundary (thrown
// errors arrive client-side as a plain Error), so `instanceof RegistrationError`
// on the client can never distinguish a friendly duplicate message from an
// unexpected failure. See node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md.
export type SubmitRegistrationOutcome = ({ success: true } & SubmitRegistrationResult) | { success: false; message: string };

function friendlyMessage(raw: string): string {
  if (raw.startsWith("DUPLICATE_TEAM_NAME")) {
    return "This team name is already taken — please choose another.";
  }
  if (raw.startsWith("DUPLICATE_EMAIL")) {
    const email = raw.split(":").slice(1).join(":").trim();
    return email
      ? `${email} is already registered with another team.`
      : "One of the emails you entered is already registered with another team.";
  }
  if (raw.startsWith("DUPLICATE_REGNO")) {
    const regNo = raw.split(":").slice(1).join(":").trim();
    return regNo
      ? `Registration number ${regNo} is already registered with another team.`
      : "One of the registration numbers you entered is already registered with another team.";
  }
  if (raw.startsWith("DUPLICATE_PHONE")) {
    const phone = raw.split(":").slice(1).join(":").trim();
    return phone
      ? `Phone number ${phone} is already registered with another team.`
      : "One of the phone numbers you entered is already registered with another team.";
  }
  if (raw.startsWith("DUPLICATE_ENTRY")) {
    return "Some of the details you entered are already registered. Please check and try again.";
  }
  if (raw.startsWith("INVALID_CAMPUS")) {
    return "Please choose a valid campus for your team.";
  }
  // validate_member_academics (supabase/migrations/0026) raises
  // `CODE: <member> — <field-specific sentence>` — surface the sentence as-is.
  const academic = raw.match(
    /^(?:MISSING_FIELD|INVALID_NAME|INVALID_REGNO_PREFIX|INVALID_EMAIL_DOMAIN|INVALID_PHONE|INVALID_GRADUATION|INVALID_PROGRAM_FOR_GRADUATION|INVALID_YEAR_FOR_PROGRAM|INVALID_SCHOOL|INVALID_DEPARTMENT_FOR_SCHOOL|INVALID_BRANCH_FOR_DEPARTMENT|INVALID_GENDER|INVALID_STAY):\s*([^]+)/,
  );
  if (academic) {
    const detail = academic[1].trim();
    return detail ? detail.charAt(0).toUpperCase() + detail.slice(1) : "Please review the highlighted fields and try again.";
  }
  return "Something went wrong while submitting your registration. Please try again.";
}

/**
 * Runs the whole registration transaction (uniqueness re-check, Team ID +
 * per-participant User ID generation, Team/Profile/TeamMember inserts)
 * atomically via the register_team Postgres function (supabase/migrations/
 * 0001_init_schema.sql) — a service-role call since this happens before any
 * auth session exists and register_team is revoked from anon/authenticated.
 */
export async function submitRegistration(input: SubmitRegistrationInput): Promise<SubmitRegistrationOutcome> {
  const supabase = createServiceClient();

  // The member objects already carry every field register_team reads
  // (name, regNo, gitamEmail, phone, graduation, program, yearOfStudy, school,
  // department, branch, gender, stay) — pass them straight through.
  const payload = { team: input.team, members: input.members };

  const { data, error } = await supabase.rpc("register_team", { p_payload: payload });

  if (error) {
    const known = /^DUPLICATE_(TEAM_NAME|EMAIL|REGNO|PHONE|ENTRY)/.test(error.message);
    if (!known) {
      // Recognized duplicate errors are routine user input, not worth logging —
      // anything else is unexpected and worth keeping visible server-side.
      console.error("register_team RPC error:", error.message);
    }
    return { success: false, message: friendlyMessage(error.message) };
  }
  if (!data) {
    return { success: false, message: "Something went wrong while submitting your registration. Please try again." };
  }

  const result = data as RegisterTeamResult;
  return { success: true, teamId: result.team_id, userIds: result.user_ids };
}
