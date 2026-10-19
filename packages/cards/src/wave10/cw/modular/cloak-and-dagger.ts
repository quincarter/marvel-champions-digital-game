import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  boost,
  chooseTarget,
  chosen,
  competitiveOnly,
  dealDamage,
  dealIndirectDamage,
  defineAbilities,
  discard,
  enemyLeader,
  exists,
  firstPlayer,
  forcedResponse,
  giveTough,
  heal,
  host,
  ifThen,
  inCompetitiveMode,
  placeThreat,
  query,
  revealCard,
  self,
  whenDefeated,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const CLOAK = "Cloak";
const DAGGER = "Dagger";
// No "choose": an encounter card targeting one of several eligible cards; the first player selects
// (RRG 1.8 "First Player", p. 19).
const A_SCHEME = chooseTarget("scheme", query("scheme"), { chooser: firstPlayer });
const A_CHARACTER_YOU_CONTROL = chooseTarget("victim", query("character", { controller: "you" }), {
  chooser: firstPlayer,
});

/**
 * Modular encounter set `cloak_and_dagger_modular` (Civil War, Resistance side; docs/phase7-wave10.md sections 3.4,
 * 3.6 and 3.23). Hinder 1[per_hero] on Cloak and Dagger and Darkforce's +1 SCH and attach rule are data.
 *
 * **Cloak (56194)**: When Revealed: you choose a scheme and 2 threat is placed on it. The competitive sentence ("In
 * competitive mode, remove 2 threat from your leader's main scheme.") is written out as a competitive-only marker; a
 * cooperative game has no "your leader's main scheme" and plays on. Boost: if Dagger is in play, this card is revealed
 * (the revealing player is the activated one, as for any boost reveal); otherwise 1 threat on a scheme you choose.
 *
 * **Dagger (56195)**: When Revealed: the enemy leader (the villain, outside Civil War; FFG ruling July 9, 2026) heals
 * 2 damage and you deal 2 damage to a character you control. Boost: if Cloak is in play, this card is revealed;
 * otherwise 1 damage to a character you control.
 *
 * **Darkforce (56196)**: attaches to the enemy leader and gives them a tough status card. Forced Response: after the
 * attached leader schemes and places threat on the main scheme, an equal amount would be removed from your leader's
 * main scheme, then Darkforce is discarded. Owner's answer to question 11 = A (2026-10-11, provisional): in a
 * cooperative game the response triggers, removes nothing (there is no "your leader's main scheme") and discards it.
 * Only a scheme that places at least 1 threat answers it.
 *
 * **Lightforce (56197)**: the enemy leader heals 3 damage and you take 3 indirect damage.
 *
 * **Cloak and Dagger (56198)**: When Defeated: the enemy leader heals 3 damage and is given a tough status card.
 *
 * Cards (5):
 * - 56194 Cloak (minion)
 * - 56195 Dagger (minion)
 * - 56196 Darkforce (attachment)
 * - 56197 Lightforce (treachery)
 * - 56198 Cloak and Dagger (side_scheme)
 */
export const MODULAR_CLOAK_AND_DAGGER: AbilityRegistry = defineAbilities({
  "56194.when-revealed": whenRevealed(
    A_SCHEME,
    placeThreat(2, chosen("scheme")),
    ifThen(inCompetitiveMode(), [
      competitiveOnly("In competitive mode, remove 2 threat from your leader's main scheme."),
    ]),
  ),
  "56194.boost": boost(
    ifThen(exists(query("minion", { name: DAGGER })), revealCard(self), [A_SCHEME, placeThreat(1, chosen("scheme"))]),
  ),

  "56195.when-revealed": whenRevealed(heal(2, enemyLeader), A_CHARACTER_YOU_CONTROL, dealDamage(2, chosen("victim"))),
  "56195.boost": boost(
    ifThen(exists(query("minion", { name: CLOAK })), revealCard(self), [
      A_CHARACTER_YOU_CONTROL,
      dealDamage(1, chosen("victim")),
    ]),
  ),

  "56196.darkforce-constant": whenRevealed(giveTough(host)),
  "56196.darkforce-forced-response": forcedResponse(
    {
      ...after.threatPlaced(query("mainScheme")),
      sourceIs: { hostOfSelf: true },
      eventAtLeast: { amount: 1 },
    },
    ifThen(inCompetitiveMode(), [competitiveOnly("remove an equal amount of threat from your leader's main scheme.")]),
    discard(self),
  ),

  "56197.when-revealed": whenRevealed(heal(3, enemyLeader), dealIndirectDamage(you, 3)),

  "56198.when-defeated": whenDefeated(heal(3, enemyLeader), giveTough(enemyLeader)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const MODULAR_CLOAK_AND_DAGGER_SKIPPED: Readonly<Record<string, string>> = {};
