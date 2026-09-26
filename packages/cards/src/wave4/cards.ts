/**
 * The wave 4 (cycle 3) card pool: every earlier playable card plus the six cycle 3 packs.
 *
 * `@mc/content` now wires cycle 3 into its own `PLAYABLE_CARDS` directly (`card-data-pipeline`, wave 4 content
 * pass, docs/phase7-wave4.md), the same way wave 1/cycle 1/cycle 2 already were — so `PLAYABLE_CARDS` alone is the
 * full pool here. **Do not also append `NEBU_CARDS`/`WARM_CARDS`/`VISION_CARDS`/`MTS_CARDS`/`VALK_CARDS`/
 * `HOOD_CARDS`**: that was this file's own historical shape (before `@mc/content` grew a `WAVE4_CARDS` of its own),
 * and doing so now double-counts every cycle 3 card, exactly the `wave3/cards.ts` regression its own docblock
 * warns about (duplicate instances placed at setup, `engagedWith`/`attachedTo` reads returning the wrong
 * duplicate, duplicate ability ids at reprint-generation time, etc.) the moment `PLAYABLE_CARDS` grew cycle 3.
 * `reprints.ts`, `setup.ts` and `names.ts` all import this rather than assembling their own copy.
 */
import {
  difficultySetChoiceErrors,
  HOOD_ENCOUNTER_SETS,
  MTS_ENCOUNTER_SETS,
  PLAYABLE_CARDS,
  type AnyCard,
  type DifficultySetChoice,
} from "@mc/content";

/** Every playable card: Core, wave 1, cycle 1, cycle 2, and cycle 3, in release order. */
export const WAVE4_CARDS: readonly AnyCard[] = PLAYABLE_CARDS;

/**
 * Refuses a Standard II / Expert II choice (docs/phase7-wave4.md §4 Q5) that names no set of the matching
 * classification among the wave 4 pool's encounter sets. Every wave 4 builder calls it before building, so a typo or a
 * modular set passed as "Standard" fails loudly instead of building a deck without its Standard set.
 */
export function checkWave4DifficultySets(choice: DifficultySetChoice | undefined): void {
  if (!choice) return;
  const errors = difficultySetChoiceErrors(choice, [...HOOD_ENCOUNTER_SETS, ...MTS_ENCOUNTER_SETS]);
  if (errors.length > 0) throw new Error(`difficultySets: ${errors.join("; ")}`);
}
