import { z } from "zod";
import {
  GENDER_OPTIONS,
  GRADUATION_OPTIONS,
  SCHOOL_OPTIONS,
  STAY_OPTIONS,
  academicIssues,
  regNoHasValidPrefix,
} from "./academic";

// Re-exported so existing importers can keep pulling academic constants from
// "@/lib/registration/schema".
export * from "./academic";

// GITAM email restriction is a permanent business rule (SPEC.md §12, §16).
// This is UX-layer validation only — the authoritative check happens server-side.
const GITAM_EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@(student\.gitam\.edu|gitam\.in)$/i;

// Display labels for the school codes (Registration Page Restructuring §9 — the
// UI shows the plain code).
export const SCHOOL_LABELS: Record<(typeof SCHOOL_OPTIONS)[number], string> = {
  GSCSE: "GSCSE",
  GSCE: "GSCE",
};

// SPEC.md §11 — permanent business rule, never configurable.
export const MIN_TEAM_SIZE = 3;
export const MAX_TEAM_SIZE = 4;

// The three GITAM campuses the portal now spans. Codes are what's stored/submitted;
// labels are display-only (registration UI).
export const CAMPUS_OPTIONS = [
  { code: "VSP", label: "Visakhapatnam" },
  { code: "BLR", label: "Bangalore" },
  { code: "HYD", label: "Hyderabad" },
] as const;

export type CampusCode = (typeof CAMPUS_OPTIONS)[number]["code"];

// Every select starts blank ("Select …") — the enum-ish fields are typed as
// plain strings so the empty state is representable; a refine gives the message.
export const memberSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the participant's full name"),
    regNo: z
      .string()
      .trim()
      .min(1, "Enter a registration number")
      .refine(regNoHasValidPrefix, "Registration number must start with 2023, 2024, 2025, or 2026"),
    gitamEmail: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => GITAM_EMAIL_PATTERN.test(v), "Must be a @gitam.in or @student.gitam.edu address"),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    graduation: z
      .string()
      .refine((v) => (GRADUATION_OPTIONS as readonly string[]).includes(v), "Select a graduation"),
    program: z.string().min(1, "Select a program"),
    yearOfStudy: z.string().min(1, "Select a year of study"),
    school: z
      .string()
      .refine((v) => (SCHOOL_OPTIONS as readonly string[]).includes(v), "Select a school"),
    department: z.string().min(1, "Select a department"),
    branch: z.string().min(1, "Select a branch"),
    gender: z
      .string()
      .refine((v) => (GENDER_OPTIONS as readonly string[]).includes(v), "Select a gender"),
    stay: z
      .string()
      .refine((v) => (STAY_OPTIONS as readonly string[]).includes(v), "Select day scholar or hostel"),
  })
  .superRefine((m, ctx) => {
    for (const [path, message] of Object.entries(academicIssues(m))) {
      ctx.addIssue({ code: "custom", path: [path], message });
    }
  });

export type MemberFormValues = z.infer<typeof memberSchema>;

export const teamDetailsSchema = z.object({
  campus: z.enum(["VSP", "BLR", "HYD"], { error: "Select a campus" }),
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
    graduation: "",
    program: "",
    yearOfStudy: "",
    school: "",
    department: "",
    branch: "",
    gender: "",
    stay: "",
  };
}
