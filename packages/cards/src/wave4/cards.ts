/**
 * The wave 4 (cycle 4) card pool: every wave 3 playable card, plus the Nebula (`nebu`), War Machine (`warm`), Vision
 * (`vision`) and Valkyrie (`valk`) hero packs and The Mad Titan's Shadow (`mts`) box scripted so far
 * (docs/phase7-wave4.md). `@mc/content` does not fold a wave 4 pack into `PLAYABLE_CARDS` yet (wiring a new wave into
 * the shared playable pool happens once for the whole wave, not per pack), so this pool concatenates each pack itself
 * the same way `wave3/setup.ts`'s own docblock describes for `WAVE3_CARDS`: none of `NEBU_CARDS`/`WARM_CARDS`/
 * `VISION_CARDS`/`MTS_CARDS`/`VALK_CARDS` share a card with `WAVE3_CARDS` or each other, so nothing here is
 * double-counted.
 */
import {
  difficultySetChoiceErrors,
  HOOD_CARDS,
  HOOD_ENCOUNTER_SETS,
  MTS_CARDS,
  MTS_ENCOUNTER_SETS,
  NEBU_CARDS,
  PLAYABLE_CARDS,
  VALK_CARDS,
  VISION_CARDS,
  WARM_CARDS,
  type AnyCard,
  type DifficultySetChoice,
} from "@mc/content";

/** Every playable card through wave 3, plus Nebula, War Machine, Vision, The Mad Titan's Shadow, Valkyrie and The
 * Hood. */
export const WAVE4_CARDS: readonly AnyCard[] = [
  ...PLAYABLE_CARDS,
  ...NEBU_CARDS,
  ...WARM_CARDS,
  ...VISION_CARDS,
  ...MTS_CARDS,
  ...VALK_CARDS,
  ...HOOD_CARDS,
];

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
