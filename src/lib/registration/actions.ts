"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { RegistrationError } from "./errors";
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
  return "Something went wrong while submitting your registration. Please try again.";
}

/**
 * Runs the whole registration transaction (uniqueness re-check, Team ID +
 * per-participant User ID generation, Team/Profile/TeamMember inserts)
 * atomically via the register_team Postgres function (supabase/migrations/
 * 0001_init_schema.sql) — a service-role call since this happens before any
 * auth session exists and register_team is revoked from anon/authenticated.
 */
export async function submitRegistration(input: SubmitRegistrationInput): Promise<SubmitRegistrationResult> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("register_team", { p_payload: input });

  if (error) {
    const known = /^DUPLICATE_(TEAM_NAME|EMAIL|REGNO|PHONE|ENTRY)/.test(error.message);
    if (!known) {
      // Recognized duplicate errors are routine user input, not worth logging —
      // anything else is unexpected and worth keeping visible server-side.
      console.error("register_team RPC error:", error.message);
    }
    throw new RegistrationError(friendlyMessage(error.message));
  }
  if (!data) {
    throw new RegistrationError("Something went wrong while submitting your registration. Please try again.");
  }

  const result = data as RegisterTeamResult;
  return { teamId: result.team_id, userIds: result.user_ids };
}
