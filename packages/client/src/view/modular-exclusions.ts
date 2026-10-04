/**
 * Scenario x modular set pairings Table setup must not offer (owner decision 2026-10-04: every modular set from an
 * unlocked pack is a candidate, so a pairing that cannot work has to be named here, and is shown disabled with its
 * short reason rather than hidden). Empty until rules QA reports one; `modular-exclusions.test.ts` holds every entry to
 * a real scenario, a real set and a reason short enough for a tile.
 */
export interface ModularSetExclusion {
  readonly scenarioId: string;
  readonly setId: string;
  /** A few words, drawn on the tile ("Needs two villains"); the long explanation belongs in Inspect. */
  readonly reason: string;
}

export const MODULAR_SET_EXCLUSIONS: readonly ModularSetExclusion[] = [];

/** The reason `setId` may not be used with `scenarioId`, or null when the pairing is allowed. */
export function modularExclusionReason(
  scenarioId: string,
  setId: string,
  table: readonly ModularSetExclusion[] = MODULAR_SET_EXCLUSIONS,
): string | null {
  return table.find((e) => e.scenarioId === scenarioId && e.setId === setId)?.reason ?? null;
}
