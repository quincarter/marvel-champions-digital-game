import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  boost,
  coveredByEngineRule,
  dealAsEncounterCard,
  defineAbilities,
  discardEncounterCards,
  encounterCards,
  eventTarget,
  firstPlayer,
  forcedResponse,
  modifyAttack,
  moveCards,
  on,
  query,
  removeCountersFrom,
  self,
  spend,
  whenRevealed,
} from "../../../dsl/index.js";

const SERPENT_SOCIETY = trait("SERPENT SOCIETY");
const SERPENT_MINION = query("minion", { trait: SERPENT_SOCIETY });

/**
 * Wave 9 scripting module `falcon/falcon/obligation-nemesis` (docs/phase7-wave9.md section 8.4, 3.43 (b)).
 *
 * Cards (5):
 * - 53029 Harlem's Protector (obligation)
 * - 53030 Viper (minion)
 * - 53031 Serpent Solutions (side_scheme)
 * - 53032 Serpent Soldier (minion)
 * - 53033 Adder-tisement (treachery)
 *
 * **Harlem's Protector (53029)**: "Give to the Sam Wilson player", Uses (3 emergency counters) and Victory 0 are data
 * and engine rule (the obligation enters its holder's play area when revealed and stays there), so the constant is
 * covered by the engine. It has no When Revealed and nothing printed happens at 0 counters. Alter-Ego Action: spend
 * 1 resource of any type (a required cost, paid in full) to remove 1 emergency counter from it.
 *
 * **Viper (53030)**: Quickstrike is data. Forced Response after Viper activates (attack or scheme): discard the top 5
 * cards of the encounter deck (an effect, one at a time with the deck reset if it empties, so Serpent Solutions
 * hears each Serpent Society minion among them).
 *
 * **Serpent Solutions (53031)**: Forced Response: after a Serpent Society minion is discarded from the top of the
 * encounter deck by a cost or an effect (not a boost card discarded after an activation, not a revealed card), deal
 * that minion to the first player as a facedown encounter card. The minion is taken from where it is: the new deck
 * when its discard emptied the deck and reset it. The side scheme's 6 flat threat is data.
 *
 * **Serpent Soldier (53032)**: Quickstrike is data. Boost: the activating enemy gets an additional boost card for
 * this activation (`modifyAttack.extraBoostCards`, the convention of Hydra Exo-Soldier 04131).
 *
 * **Adder-tisement (53033)**: Surge is data. When Revealed: every Serpent Society minion in the encounter discard
 * pile is shuffled into the encounter deck (the deck is shuffled once, also when there are none).
 */
export const FALCON_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "53029.harlems-protector-constant": coveredByEngineRule(),
  "53029.harlems-protector-action": alterEgoAction({ cost: spend(1) }, removeCountersFrom(self, "emergency", 1)),

  "53030.viper-forced-response": forcedResponse(on.enemyActivates("self"), discardEncounterCards(5)),

  "53031.serpent-solutions-forced-response": forcedResponse(
    on.discardedFromEncounterDeck(SERPENT_MINION),
    dealAsEncounterCard(eventTarget, firstPlayer),
  ),

  "53032.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  "53033.when-revealed": whenRevealed(moveCards(encounterCards(["discard"], SERPENT_MINION), "encounterDeckShuffle")),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FALCON_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
