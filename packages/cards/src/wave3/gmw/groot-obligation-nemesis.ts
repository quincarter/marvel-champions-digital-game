import {
  countersOn,
  dealIndirectDamage,
  defineAbilities,
  eachPlayer,
  forcedResponse,
  forEachPlayer,
  ifThen,
  inPlay,
  on,
  removeCountersFrom,
  surge,
  thatPlayer,
  valueEquals,
  whenRevealed,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

/**
 * Wilt (16025), Groot's obligation, and his nemesis set: Blazing Inferno (16026), Furnax (16027), Fan the Flames
 * ×3 (16028).
 */
export const GROOT_OBLIGATION_NEMESIS = defineAbilities({
  // Wilt — Give to the Groot player. You may flip to alter-ego form. Choose:
  // • Exhaust your alter-ego → remove Wilt from the game.
  // • Remove 3 growth counters from Groot. If no growth counters were removed this way, this card gains surge.
  //   Discard this obligation.
  // "If no growth counters were removed this way" is read before the removal (which can only remove what's
  // there): true exactly when Groot held 0 growth counters already.
  "16025.obligation": obligation("Groot", {
    label: "Remove 3 growth counters from Groot. If no growth counters were removed this way, this card gains surge",
    effects: [
      ifThen(valueEquals(countersOn(yourIdentity, "growth"), 0), surge()),
      removeCountersFrom(yourIdentity, "growth", 3),
    ],
  }),

  // Blazing Inferno — Forced Response: After the villain phase begins, deal 2 indirect damage to each player.
  "16026.blazing-inferno-forced-response": forcedResponse(
    on.phaseBeginning("villain"),
    forEachPlayer(eachPlayer, dealIndirectDamage(thatPlayer, 2)),
  ),

  // Furnax — [star] Forced Response: After Furnax activates, deal 2 indirect damage to each player.
  "16027.furnax-forced-response": forcedResponse(
    on.enemySchemesOrAttacks("self"),
    forEachPlayer(eachPlayer, dealIndirectDamage(thatPlayer, 2)),
  ),

  // Fan the Flames — When Revealed: Take 2 indirect damage. If Blazing Inferno is in play, take 1 additional
  // indirect damage. If Furnax is in play, take 1 additional indirect damage.
  "16028.when-revealed": whenRevealed(
    dealIndirectDamage(you, 2),
    ifThen(inPlay("Blazing Inferno"), dealIndirectDamage(you, 1)),
    ifThen(inPlay("Furnax"), dealIndirectDamage(you, 1)),
  ),
});
