import {
  allOf,
  atEndOfAttack,
  boost,
  chosen,
  countOf,
  damageOn,
  defineAbilities,
  encounterCards,
  eventDealt,
  eventSource,
  eventTarget,
  forcedInterrupt,
  heal,
  ifThen,
  instead,
  moveCards,
  placeThreat,
  query,
  refMatches,
  self,
  stun,
  theMainScheme,
  topOfDeck,
  when,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { ASGARD, distinctCardTypesOf } from "./local.js";

/**
 * Thor's nemesis set: Family Feud (06027, side scheme), Loki (06028, nemesis minion), Frost Giant ×2 (06029,
 * minion), Trickster (06030, treachery).
 */
export const THOR_NEMESIS = defineAbilities({
  // Family Feud — When Revealed: Place 1 additional threat here for each Asgard card in play. (The printed 2
  // starting threat is handled generically by side-scheme setup, `startingThreat` card data — this is only the
  // "additional" part.)
  "06027.when-revealed": whenRevealed(placeThreat(countOf({ trait: ASGARD }), self)),

  // Loki — Forced Interrupt: When Loki would be defeated, discard the top card of the encounter deck. If that card
  // is a treachery, heal all damage from Loki instead.
  "06028.loki-forced-interrupt": forcedInterrupt(
    when.defeated("self"),
    moveCards(encounterCards(["deck"], undefined, 1), "discard", "flipped"),
    ifThen(refMatches(chosen("flipped"), query("treachery")), instead(heal(damageOn(self), self))),
  ),

  // Frost Giant — [star] Boost: If the villain is attacking and this attack deals damage to a character, stun that
  // character. Deferred to the end of the current activation (`atEndOfAttack`, which the engine reads generically
  // for "the current attack/thwart/scheme activation" — see Spider-Man's boost, `core/heroes/spider-man.ts`
  // 01168), where `eventSource`/`eventTarget`/`eventDealt` read the underlying attack's own results.
  "06029.boost": boost(
    atEndOfAttack(
      ifThen(allOf(refMatches(eventSource, query("villain")), eventDealt("damage"), refMatches(eventTarget, query("character"))), stun(eventTarget)),
    ),
  ),

  // Trickster — When Revealed: Discard the top 3 cards of your deck. Place 1 threat on the main scheme for each
  // different card type discarded this way.
  "06030.when-revealed": whenRevealed(moveCards(topOfDeck(3, you), "discard", "milled"), placeThreat(distinctCardTypesOf(chosen("milled")), theMainScheme)),
});
