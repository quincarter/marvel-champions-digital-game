import {
  coveredByEngineRule,
  defineAbilities,
  endGame,
  flipCard,
  forcedResponse,
  on,
  resolveSpecialsOf,
  self,
  theMainScheme,
} from "../../../dsl/index.js";

/**
 * Light at the End (`sm` 27102a Trap! / 27102b Chase!, MC27 p. 15): one permanent side scheme with two faces
 * (`otherFaceId` on both, docs/phase7-wave4.md §1.7's precedent). "Permanent" (RRG 1.8 p. 32) is why its text answers
 * "the last threat is removed from this scheme" rather than a defeat: a permanent card "cannot be defeated, leave
 * play, ... except by card abilities in the same set", and reaching no threat is the game's rule, so the scheme is
 * never defeated and stays in play with no threat (owner ruling 2026-10-05, docs/phase7-wave7.md §4.1). Both faces
 * hear the removal itself (`on.lastThreatRemoved("self")`, docs/phase7-wave7.md §3.34).
 *
 * Timing: both are printed "Forced Interrupt: When the last threat is removed", and are scripted as forced responses.
 * Whether a removal is the last one is that removal's own result, which the engine knows once the threat is gone; an
 * interrupt that flipped the card first would have the removal take its threat from the new face. Nothing resolves
 * between the removal and this answer, so the outcome is the printed one.
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
  "27102a.light-at-the-end-forced-interrupt": forcedResponse(
    on.lastThreatRemoved("self"),
    resolveSpecialsOf(theMainScheme),
    flipCard(self),
  ),

  // Chase! (27102b) — "The players cannot win unless they escape." (same config as the Trap! face).
  "27102b.light-at-the-end-constant": coveredByEngineRule(),
  // Chase! (27102b) — Forced Interrupt: When the last threat is removed from this scheme, the players escape and win
  // the game.
  "27102b.light-at-the-end-forced-interrupt": forcedResponse(on.lastThreatRemoved("self"), endGame("win")),
});
