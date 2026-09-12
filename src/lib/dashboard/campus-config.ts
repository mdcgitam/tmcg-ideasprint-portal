import type { CampusCode, ConfigurationRow } from "@/types/database";

/** The key a campus-scoped override of `baseKey` is stored under (e.g. "noc.general_deadline.VSP"). */
export function campusConfigKey(baseKey: string, campus: CampusCode): string {
  return `${baseKey}.${campus}`;
}

/** Canonical display order for campus codes, everywhere one is listed — VSP, then HYD, then BLR. */
export const CAMPUS_ORDER: CampusCode[] = ["VSP", "HYD", "BLR"];

/** Sorts a list of campus codes (e.g. options derived from data, in whatever order they happened to appear) into CAMPUS_ORDER. Unrecognized values sort last, in their original relative order. */
export function sortCampuses<T extends string>(campuses: T[]): T[] {
  return [...campuses].sort((a, b) => {
    const ai = CAMPUS_ORDER.indexOf(a as CampusCode);
    const bi = CAMPUS_ORDER.indexOf(b as CampusCode);
    return (ai === -1 ? CAMPUS_ORDER.length : ai) - (bi === -1 ? CAMPUS_ORDER.length : bi);
  });
}

const UPDATED_AT_SUFFIX = "__updated_at";

/**
 * Builds the flat config map every dashboard passes around, plus a shadow
 * `<key>__updated_at` entry per row — the only thing effectiveConfigValue
 * needs to resolve "whichever of the global/campus value was edited most
 * recently wins" without changing the shape callers already read `config[key]`
 * from.
 */
export function buildConfigMap(rows: Pick<ConfigurationRow, "key" | "value" | "updated_at">[]): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const row of rows) {
    config[row.key] = row.value;
    config[row.key + UPDATED_AT_SUFFIX] = row.updated_at;
  }
  return config;
}

function stringValue(config: Record<string, unknown>, key: string): string | null {
  const raw = config[key];
  return typeof raw === "string" && raw ? raw : null;
}

function updatedAtOf(config: Record<string, unknown>, key: string): number {
  const raw = config[key + UPDATED_AT_SUFFIX];
  return typeof raw === "string" ? new Date(raw).getTime() : 0;
}

/**
 * Resolves a config value the same way the server RPCs do (record_noc_metadata /
 * record_presentation / select_problem_statement, see 0048/0049): between a
 * Campus Admin's campus-scoped override of `baseKey` and the Super-Admin-set
 * global default, whichever was saved most recently wins — not "campus always
 * wins". If only one of the two exists, that one is used. Also returns the
 * winning value's own updated_at (epoch ms, 0 if unset) so a caller with a
 * third candidate of its own (e.g. a per-member NOC deadline override) can
 * fold it into the same "latest edit wins" comparison — see
 * effectiveNocDeadline below.
 */
export function effectiveConfigValueWithTimestamp(
  config: Record<string, unknown>,
  baseKey: string,
  campus: CampusCode | null | undefined,
): { value: string | null; updatedAt: number } {
  const global = stringValue(config, baseKey);
  const globalUpdated = updatedAtOf(config, baseKey);
  if (!campus) return { value: global, updatedAt: globalUpdated };

  const scopedKey = campusConfigKey(baseKey, campus);
  const scoped = stringValue(config, scopedKey);
  const scopedUpdated = updatedAtOf(config, scopedKey);
  if (!scoped) return { value: global, updatedAt: globalUpdated };
  if (!global) return { value: scoped, updatedAt: scopedUpdated };

  return scopedUpdated >= globalUpdated ? { value: scoped, updatedAt: scopedUpdated } : { value: global, updatedAt: globalUpdated };
}

/**
 * Resolves a config value the same way the server RPCs do (record_noc_metadata /
 * record_presentation / select_problem_statement, see 0048/0049): between a
 * Campus Admin's campus-scoped override of `baseKey` and the Super-Admin-set
 * global default, whichever was saved most recently wins — not "campus always
 * wins". If only one of the two exists, that one is used.
 */
export function effectiveConfigValue(
  config: Record<string, unknown>,
  baseKey: string,
  campus: CampusCode | null | undefined,
): string | null {
  return effectiveConfigValueWithTimestamp(config, baseKey, campus).value;
}

/**
 * A person/team's actual deadline for a given general config key: whichever
 * of {global general default, campus-scoped general default, an
 * individual/per-team override} has the latest updated_at wins — same rule
 * effectiveConfigValue already uses between global/campus, extended with
 * the individual override as a third candidate. Mirrors the equivalent
 * Postgres effective_*_deadline helpers (0064/0066) so the UI never shows
 * something the backend wouldn't also enforce.
 */
function effectiveDeadlineWithOverrideDetailed(
  config: Record<string, unknown>,
  generalBaseKey: string,
  campus: CampusCode | null | undefined,
  individualDeadline: string | null | undefined,
  individualDeadlineUpdatedAt: string | null | undefined,
): { value: string | null; fromIndividualOverride: boolean } {
  const general = effectiveConfigValueWithTimestamp(config, generalBaseKey, campus);
  if (!individualDeadline) return { value: general.value, fromIndividualOverride: false };

  const individualUpdated = individualDeadlineUpdatedAt ? new Date(individualDeadlineUpdatedAt).getTime() : 0;
  if (!general.value || individualUpdated >= general.updatedAt) {
    return { value: individualDeadline, fromIndividualOverride: true };
  }
  return { value: general.value, fromIndividualOverride: false };
}

/** A person's actual NOC deadline — see effectiveDeadlineWithOverrideDetailed. */
export function effectiveNocDeadline(
  config: Record<string, unknown>,
  campus: CampusCode | null | undefined,
  individualDeadline: string | null | undefined,
  individualDeadlineUpdatedAt: string | null | undefined,
): string | null {
  return effectiveNocDeadlineDetailed(config, campus, individualDeadline, individualDeadlineUpdatedAt).value;
}

/** Same resolution as effectiveNocDeadline, plus which source actually won — for UI that needs to say "this is the general default" vs "this is an individual override". */
export function effectiveNocDeadlineDetailed(
  config: Record<string, unknown>,
  campus: CampusCode | null | undefined,
  individualDeadline: string | null | undefined,
  individualDeadlineUpdatedAt: string | null | undefined,
): { value: string | null; fromIndividualOverride: boolean } {
  return effectiveDeadlineWithOverrideDetailed(config, "noc.general_deadline", campus, individualDeadline, individualDeadlineUpdatedAt);
}

/** A team's actual PPT deadline — see effectiveDeadlineWithOverrideDetailed. */
export function effectivePresentationDeadline(
  config: Record<string, unknown>,
  campus: CampusCode | null | undefined,
  individualDeadline: string | null | undefined,
  individualDeadlineUpdatedAt: string | null | undefined,
): string | null {
  return effectivePresentationDeadlineDetailed(config, campus, individualDeadline, individualDeadlineUpdatedAt).value;
}

/** Same resolution as effectivePresentationDeadline, plus which source actually won. */
export function effectivePresentationDeadlineDetailed(
  config: Record<string, unknown>,
  campus: CampusCode | null | undefined,
  individualDeadline: string | null | undefined,
  individualDeadlineUpdatedAt: string | null | undefined,
): { value: string | null; fromIndividualOverride: boolean } {
  return effectiveDeadlineWithOverrideDetailed(config, "ppt.general_deadline", campus, individualDeadline, individualDeadlineUpdatedAt);
}

/** A team's actual Problem Statement selection end — see effectiveDeadlineWithOverrideDetailed; the "individual override" here is the team's extension (problem_statement_extensions), timestamped by granted_at. */
export function effectiveProblemStatementEnd(
  config: Record<string, unknown>,
  campus: CampusCode | null | undefined,
  extendedUntil: string | null | undefined,
  extendedUntilGrantedAt: string | null | undefined,
): string | null {
  return effectiveProblemStatementEndDetailed(config, campus, extendedUntil, extendedUntilGrantedAt).value;
}

/** Same resolution as effectiveProblemStatementEnd, plus which source actually won. */
export function effectiveProblemStatementEndDetailed(
  config: Record<string, unknown>,
  campus: CampusCode | null | undefined,
  extendedUntil: string | null | undefined,
  extendedUntilGrantedAt: string | null | undefined,
): { value: string | null; fromIndividualOverride: boolean } {
  return effectiveDeadlineWithOverrideDetailed(config, "problem_statement.selection_end", campus, extendedUntil, extendedUntilGrantedAt);
}

/** Current local datetime in the format a `<input type="datetime-local">` expects, for use as its `min` so a picker can't select an already-past date/time. */
export function nowDatetimeLocalValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DEFAULT_PROBLEM_STATEMENT_MAX = 50;

/**
 * The highest problem statement number in the catalog (numbering always
 * starts at 1) — set by the Super Admin via "problem_statement.max_number",
 * global only (not campus-overridable: the PS catalog itself isn't
 * campus-specific). Falls back to 50 until explicitly configured.
 */
export function problemStatementMaxNumber(config: Record<string, unknown>): number {
  const raw = config["problem_statement.max_number"];
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_PROBLEM_STATEMENT_MAX;
}
