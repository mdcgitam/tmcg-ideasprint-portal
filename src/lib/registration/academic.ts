/**
 * Single source of truth for the registration academic fields and their
 * dependent-option relationships (Registration Page Restructuring spec):
 *
 *   Graduation → Program → Year of Study
 *   School     → Department → Branch
 *
 * The SQL side mirrors these exact sets in
 * `public.validate_member_academics(...)` (supabase/migrations/0026). Keep the
 * two in lockstep — if you change a list here, change it there too.
 */

export const REGNO_PREFIXES = ["2023", "2024", "2025", "2026"] as const;
export const EMAIL_DOMAINS = ["gitam.in", "student.gitam.edu"] as const;

export const GRADUATION_OPTIONS = ["UG", "PG"] as const;
export type Graduation = (typeof GRADUATION_OPTIONS)[number];

export const PROGRAM_BY_GRADUATION: Record<Graduation, readonly string[]> = {
  UG: ["B.Tech"],
  PG: ["M.Tech"],
};

export const YEAR_BY_PROGRAM: Record<string, readonly string[]> = {
  "B.Tech": ["1st Year", "2nd Year", "3rd Year", "4th Year"],
  "M.Tech": ["1st Year", "2nd Year"],
};

export const SCHOOL_OPTIONS = ["GSCSE", "GSCE"] as const;
export type School = (typeof SCHOOL_OPTIONS)[number];

export const DEPARTMENT_BY_SCHOOL: Record<School, readonly string[]> = {
  GSCSE: ["CSSE", "AIDS"],
  GSCE: ["EECE", "MECH", "CIVIL", "BioTech", "Aerospace Engineering"],
};

// A department without multiple branches uses its own name as the sole branch.
export const BRANCH_BY_DEPARTMENT: Record<string, readonly string[]> = {
  CSSE: ["CSE", "CSBS"],
  AIDS: ["CSE-AIML", "CSE-CS", "CSE-DS", "CSE-IOT"],
  EECE: ["EECE"],
  MECH: ["MECH"],
  CIVIL: ["CIVIL"],
  BioTech: ["BioTech"],
  "Aerospace Engineering": ["Aerospace Engineering"],
};

export const GENDER_OPTIONS = ["Male", "Female"] as const;
export const STAY_OPTIONS = ["Day Scholar", "Hostel"] as const;

// Flattened lists — handy for filters / display that don't care about the parent.
export const ALL_PROGRAMS = ["B.Tech", "M.Tech"] as const;
export const ALL_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
export const ALL_DEPARTMENTS = [
  ...DEPARTMENT_BY_SCHOOL.GSCSE,
  ...DEPARTMENT_BY_SCHOOL.GSCE,
] as const;
export const ALL_BRANCHES = Array.from(
  new Set(Object.values(BRANCH_BY_DEPARTMENT).flat()),
);

export function programsFor(graduation: string): readonly string[] {
  return PROGRAM_BY_GRADUATION[graduation as Graduation] ?? [];
}
export function yearsFor(program: string): readonly string[] {
  return YEAR_BY_PROGRAM[program] ?? [];
}
export function departmentsFor(school: string): readonly string[] {
  return DEPARTMENT_BY_SCHOOL[school as School] ?? [];
}
export function branchesFor(department: string): readonly string[] {
  return BRANCH_BY_DEPARTMENT[department] ?? [];
}

export function regNoHasValidPrefix(value: string): boolean {
  return REGNO_PREFIXES.some((p) => value.startsWith(p));
}

export function isGitamEmail(value: string): boolean {
  return /^[a-z0-9._%+-]+@(student\.gitam\.edu|gitam\.in)$/i.test(value.trim());
}

/** Structural check of one member's academic block. Returns field→message issues (empty = valid). */
export function academicIssues(m: {
  graduation: string;
  program: string;
  yearOfStudy: string;
  school: string;
  department: string;
  branch: string;
}): Record<string, string> {
  const issues: Record<string, string> = {};
  if (m.graduation && !programsFor(m.graduation).includes(m.program)) {
    issues.program = "Select a valid program for the chosen graduation";
  }
  if (m.program && !yearsFor(m.program).includes(m.yearOfStudy)) {
    issues.yearOfStudy = "Select a valid year for the chosen program";
  }
  if (m.school && !departmentsFor(m.school).includes(m.department)) {
    issues.department = "Select a department that belongs to the chosen school";
  }
  if (m.department && !branchesFor(m.department).includes(m.branch)) {
    issues.branch = "Select a branch that belongs to the chosen department";
  }
  return issues;
}
