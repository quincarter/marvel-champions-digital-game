import {
  coveredByEngineRule,
  defineAbilities,
  endGame,
  flipCard,
  forcedInterrupt,
  on,
  resolveSpecialsOf,
  self,
  theMainScheme,
} from "../../../dsl/index.js";

/**
 * Light at the End (`sm` 27102a Trap! / 27102b Chase!, MC27 p. 15): one permanent side scheme with two faces
 * (`otherFaceId` on both, docs/phase7-wave4.md §1.7's precedent). "Permanent" (RRG 1.8 p. 32) is why it needs its own
 * Forced Interrupt at zero threat rather than the ordinary side-scheme defeat: a permanent card "cannot be defeated,
 * leave play, ... except by card abilities in the same set", so `applySchemeDefeated`'s own leave step no-ops for it
 * (`permanent-leave-protection.test.ts`), but the `schemeDefeated` event it fires first still opens this interrupt
 * window (`on.schemeDefeated("self")`, the same event "Interrupt: When attached side scheme is defeated" reads —
 * `scheme-defeat-interrupt.test.ts`).
 *
 * "The players cannot win unless they escape." is the scenario's own `MultipleVillains.winCondition: "cardAbility"`
 * (data, `sm/scenarios.ts`): defeating every Sinister Six villain does not win by itself, so both faces' own
 * "-constant" ability is `coveredByEngineRule()`.
 */
export const SINISTER_SIX_SCENARIO_CARDS = defineAbilities({
  // Trap! (27102a) — "The players cannot win unless they escape." (data/config, see module docblock).
  "27102a.light-at-the-end-constant": coveredByEngineRule(),
  // Trap! (27102a) — Forced Interrupt: When the last threat is removed from this scheme, resolve the "Ambush!"
  // ability on the main scheme (whichever stage is showing — `resolveSpecialsOf` with no `abilities` resolves every
  // Special on it, and only one is ever printed at a time). Flip this card.
  "27102a.light-at-the-end-forced-interrupt": forcedInterrupt(
    on.schemeDefeated("self"),
    resolveSpecialsOf(theMainScheme),
    flipCard(self),
  ),

  // Chase! (27102b) — "The players cannot win unless they escape." (same config as the Trap! face).
  "27102b.light-at-the-end-constant": coveredByEngineRule(),
  // Chase! (27102b) — Forced Interrupt: When the last threat is removed from this scheme, the players escape and win
  // the game.
  "27102b.light-at-the-end-forced-interrupt": forcedInterrupt(on.schemeDefeated("self"), endGame("win")),
});
