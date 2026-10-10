import type { AbilityRegistry } from "@mc/engine";
import {
  activatingEnemy,
  addCounters,
  boost,
  constant,
  countersOn,
  dealIndirectDamage,
  defineAbilities,
  endGame,
  enemyActivates,
  find,
  forcedResponse,
  gets,
  giveTough,
  ifThen,
  inPlay,
  named,
  not,
  on,
  product,
  query,
  revealCard,
  stateCheckFromEntering,
  surge,
  valueAtLeast,
  varAtLeast,
  whenRevealed,
  placeThreat,
  self,
  you,
} from "../../dsl/index.js";

const ATLAS = "Atlas";
/** The growth counters on Atlas; zero while he is not in play. */
const ATLAS_GROWTH = countersOn(named(ATLAS), "growth");

/**
 * Wave 9 scripting module `silk/growing-strong` (docs/phase7-wave9.md sections 7.10, 3.35, 3.52, 8.4): the Growing
 * Strong encounter set, an Elite Thunderbolt set whose minion joins the Thunderbolts pool. Villainous and Victory 1 on
 * Atlas, Grow Invulnerable's printed starting threat (5, not per player) and the boost icons are data.
 *
 * **Atlas (52035)**: a constant of +2 hit points for each growth counter on him; Forced Response after the villain
 * phase ends: 1 growth counter on him.
 *
 * **Grow Invulnerable (52036)**: When Revealed: 1 additional threat for each growth counter on Atlas (none when he is
 * not in play). The loss is a state check that also runs as the scheme enters play, so a scheme revealed while Atlas
 * already holds 10 counters loses at once; a scheme in play loses the game the moment he reaches 10.
 *
 * **Growing Strong (52037)**: finds and reveals Atlas (engaging the revealing player when already in play), who
 * activates against that player; surge when nobody activated. Boost: the activating enemy gets a tough status card.
 *
 * **Titanic Proportions (52038)**: the players as a group take X indirect damage, X the growth counters on Atlas; surge
 * when X is under 3. Boost: if Atlas is in play, 1 growth counter on him.
 *
 * Cards (4):
 * - 52035 Atlas (minion)
 * - 52036 Grow Invulnerable (side_scheme)
 * - 52037 Growing Strong (treachery)
 * - 52038 Titanic Proportions (treachery)
 */
export const GROWING_STRONG: AbilityRegistry = defineAbilities({
  "52035.atlas-constant": constant(gets("hp", product(2, countersOn(self, "growth")), { self: true })),
  "52035.atlas-forced-response": forcedResponse(on.phaseEnding("villain"), addCounters("growth", 1, self)),

  "52036.when-revealed": whenRevealed(placeThreat(ATLAS_GROWTH, self)),
  "52036.grow-invulnerable-constant": stateCheckFromEntering(valueAtLeast(ATLAS_GROWTH, 10), endGame("loss")),

  "52037.when-revealed": whenRevealed(
    revealCard(find(query("minion", { name: ATLAS })), you),
    enemyActivates(named(ATLAS), { against: you, bind: "activated" }),
    ifThen(not(varAtLeast("activated.made")), surge()),
  ),
  "52037.boost": boost(giveTough(activatingEnemy)),

  "52038.when-revealed": whenRevealed(
    dealIndirectDamage("group", ATLAS_GROWTH),
    ifThen(not(valueAtLeast(ATLAS_GROWTH, 3)), surge()),
  ),
  "52038.boost": boost(ifThen(inPlay(ATLAS), addCounters("growth", 1, named(ATLAS)))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const GROWING_STRONG_SKIPPED: Readonly<Record<string, string>> = {};
