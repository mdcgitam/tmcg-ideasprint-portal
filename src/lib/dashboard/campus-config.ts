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
 * wins". If only one of the two exists, that one is used.
 */
export function effectiveConfigValue(
  config: Record<string, unknown>,
  baseKey: string,
  campus: CampusCode | null | undefined,
): string | null {
  const global = stringValue(config, baseKey);
  if (!campus) return global;

  const scopedKey = campusConfigKey(baseKey, campus);
  const scoped = stringValue(config, scopedKey);
  if (!scoped) return global;
  if (!global) return scoped;

  return updatedAtOf(config, scopedKey) >= updatedAtOf(config, baseKey) ? scoped : global;
}
