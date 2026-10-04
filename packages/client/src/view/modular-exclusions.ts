/**
 * Scenario x modular set pairings Table setup must not offer (owner decision 2026-10-04: every modular set from an
 * unlocked pack is a candidate, so a pairing that cannot work has to be named here, and is shown disabled with its
 * short reason rather than hidden). Only rule-based exclusions are left after the matrix fixes
 * (docs/phase7-wave6-qa-modular-matrix.md section 6); `modular-candidates.test.ts` holds every entry to a real scenario,
 * a real set and a reason short enough for a tile. What a scenario already has (its own sets, Experimental Weapons at
 * Crossbones) or takes none of (Breakout, The Hood, The Sinister Six) never reaches this table: the candidate list
 * leaves those out.
 */
export interface ModularSetExclusion {
  readonly scenarioId: string;
  readonly setId: string;
  /** A few words, drawn on the tile ("Needs two villains"); the long explanation belongs in Inspect. */
  readonly reason: string;
}

export const MODULAR_SET_EXCLUSIONS: readonly ModularSetExclusion[] = [
  // MC21 p. 16: "If there is more than one villain (or no villain) in play at the start of the game, The Infinity
  // Gauntlet set cannot be used." Tower Defense starts with two (`EncounterSet.singleVillainOnly`).
  { scenarioId: "tower-defense", setId: "infinity_gauntlet", reason: "Needs one villain (MC21 p. 16)" },
];

/** The reason `setId` may not be used with `scenarioId`, or null when the pairing is allowed. */
export function modularExclusionReason(
  scenarioId: string,
  setId: string,
  table: readonly ModularSetExclusion[] = MODULAR_SET_EXCLUSIONS,
): string | null {
  return table.find((e) => e.scenarioId === scenarioId && e.setId === setId)?.reason ?? null;
}
