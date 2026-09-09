import type { CampusCode } from "@/types/database";

/** The key a campus-scoped override of `baseKey` is stored under (e.g. "noc.general_deadline.VSP"). */
export function campusConfigKey(baseKey: string, campus: CampusCode): string {
  return `${baseKey}.${campus}`;
}

/**
 * Resolves a config value the same way the server RPCs do (record_noc_metadata /
 * record_presentation / select_problem_statement, see 0048): a Campus Admin's
 * campus-scoped override of `baseKey`, falling back to the Super-Admin-set
 * global default when no override exists for that campus.
 */
export function effectiveConfigValue(
  config: Record<string, unknown>,
  baseKey: string,
  campus: CampusCode | null | undefined,
): string | null {
  if (campus) {
    const scoped = config[campusConfigKey(baseKey, campus)];
    if (typeof scoped === "string" && scoped) return scoped;
  }
  const global = config[baseKey];
  return typeof global === "string" && global ? global : null;
}
