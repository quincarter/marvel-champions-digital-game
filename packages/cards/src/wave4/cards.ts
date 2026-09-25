/**
 * The wave 4 (cycle 4) card pool: every wave 3 playable card, plus the Nebula (`nebu`), War Machine (`warm`), Vision
 * (`vision`) and Valkyrie (`valk`) hero packs and The Mad Titan's Shadow (`mts`) box scripted so far
 * (docs/phase7-wave4.md). `@mc/content` does not fold a wave 4 pack into `PLAYABLE_CARDS` yet (wiring a new wave into
 * the shared playable pool happens once for the whole wave, not per pack), so this pool concatenates each pack itself
 * the same way `wave3/setup.ts`'s own docblock describes for `WAVE3_CARDS`: none of `NEBU_CARDS`/`WARM_CARDS`/
 * `VISION_CARDS`/`MTS_CARDS`/`VALK_CARDS` share a card with `WAVE3_CARDS` or each other, so nothing here is
 * double-counted.
 */
import { MTS_CARDS, NEBU_CARDS, PLAYABLE_CARDS, VALK_CARDS, VISION_CARDS, WARM_CARDS, type AnyCard } from "@mc/content";

/** Every playable card through wave 3, plus Nebula, War Machine, Vision, The Mad Titan's Shadow and Valkyrie. */
export const WAVE4_CARDS: readonly AnyCard[] = [
  ...PLAYABLE_CARDS,
  ...NEBU_CARDS,
  ...WARM_CARDS,
  ...VISION_CARDS,
  ...MTS_CARDS,
  ...VALK_CARDS,
];
