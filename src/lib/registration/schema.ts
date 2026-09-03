import { z } from "zod";

// GITAM email restriction is a permanent business rule (SPEC.md §12, §16).
// This is UX-layer validation only — the authoritative check happens server-side at auth time.
const GITAM_EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@(student\.gitam\.edu|gitam\.in)$/i;

export const YEAR_OF_STUDY_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
export const GENDER_OPTIONS = ["Male", "Female"] as const;
export const STAY_OPTIONS = ["Hosteller", "Day Scholar"] as const;

// CSE and its allied branches. "Other" lets a member outside this list type
// their branch manually — see MemberDetailsStep's custom-branch toggle.
export const BRANCH_OPTIONS = [
  "CSE",
  "AIML",
  "DS",
  "CS",
  "IOT",
  "CSBS",
  "Biotech",
  "ECE",
  "ECE-AIML",
  "ECE-VLSI",
] as const;

export const SCHOOL_VALUES = ["GSCSE", "GSCE"] as const;
export const SCHOOL_LABELS: Record<(typeof SCHOOL_VALUES)[number], string> = {
  GSCSE: "GSCSE — Gitam School of Computers and System Engineering (CSE & Allied Branches)",
  GSCE: "GSCE — Gitam School of Core Engineering (ECE, EEE, MECH, CIVIL)",
};

// SPEC.md §11 — permanent business rule, never configurable.
export const MIN_TEAM_SIZE = 3;
export const MAX_TEAM_SIZE = 4;

export const memberSchema = z.object({
  name: z.string().trim().min(2, "Enter the participant's full name"),
  regNo: z.string().trim().min(3, "Enter a valid registration number"),
  gitamEmail: z
    .string()
    .trim()
    .toLowerCase()
    .refine((val) => GITAM_EMAIL_PATTERN.test(val), "Must be a valid @student.gitam.edu or gitam.in address"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  yearOfStudy: z.enum(YEAR_OF_STUDY_OPTIONS, { error: "Select a year of study" }),
  school: z.enum(SCHOOL_VALUES, { error: "Select a school" }),
  branch: z.string().trim().min(2, "Enter the participant's branch"),
  gender: z.enum(GENDER_OPTIONS, { error: "Select a gender" }),
  stay: z.enum(STAY_OPTIONS, { error: "Select hosteller or day scholar" }),
});

export type MemberFormValues = z.infer<typeof memberSchema>;

export const teamDetailsSchema = z.object({
  teamName: z.string().trim().min(3, "Team name must be at least 3 characters"),
  memberCount: z.union([z.literal(MIN_TEAM_SIZE), z.literal(MAX_TEAM_SIZE)]),
});

export type TeamDetailsFormValues = z.infer<typeof teamDetailsSchema>;

export const registrationSchema = z.object({
  guidelinesAcknowledged: z
    .boolean()
    .refine((val) => val === true, { error: "You must acknowledge the guidelines to continue" }),
  team: teamDetailsSchema,
  members: z.array(memberSchema).min(MIN_TEAM_SIZE).max(MAX_TEAM_SIZE),
});

export type RegistrationFormValues = z.infer<typeof registrationSchema>;

export function emptyMember(): MemberFormValues {
  return {
    name: "",
    regNo: "",
    gitamEmail: "",
    phone: "",
    yearOfStudy: "1st Year",
    school: SCHOOL_VALUES[0],
    branch: "",
    gender: "Male",
    stay: "Hosteller",
  };
}
