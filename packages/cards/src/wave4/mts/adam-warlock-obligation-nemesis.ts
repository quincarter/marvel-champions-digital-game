import {
  anyOfCards,
  boost,
  cards,
  chosen,
  constant,
  defineAbilities,
  distinctAspectsOf,
  encounterCards,
  encounterSetAside,
  engage,
  eventPlayer,
  exhaust,
  exists,
  firstPlayer,
  forcedResponse,
  identityOf,
  ifThen,
  moveCards,
  on,
  oneCopyOf,
  placeThreat,
  putIntoPlay,
  query,
  revealCard,
  rule,
  selectCards,
  self,
  shuffleEncounterDeck,
  stun,
  theMainScheme,
  topOfDeck,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

const UNIVERSAL_CHURCH_OF_TRUTH = query("sideScheme", { name: "Universal Church of Truth" });

/**
 * Adam Warlock's obligation (Regeneration Cycle, 21066) and nemesis set: The Magus (21067, minion), Universal
 * Church of Truth (21068, side scheme), Zealot of Truth (21069, minion), Cosmic Inquisition (21070, treachery).
 */
export const ADAM_WARLOCK_OBLIGATION_NEMESIS = defineAbilities({
  // Regeneration Cycle (21066) — the shared obligation shape (`core/obligations.ts`): "Discard the top 5 cards of
  // your deck. Place 1 threat on the main scheme for each different aspect cards discarded this way."
  "21066.obligation": obligation("Adam Warlock", {
    label:
      "Discard the top 5 cards of your deck. Place 1 threat on the main scheme for each different aspect cards discarded this way",
    effects: [
      selectCards("discarded", topOfDeck(5)),
      moveCards(cards(chosen("discarded")), "discard"),
      placeThreat(distinctAspectsOf(chosen("discarded")), theMainScheme),
    ],
  }),

  // The Magus (21067) — Elite, Mystic; Quickstrike, Toughness (data). [star] Forced Response: After The Magus
  // activates against you, discard the top 5 cards of your deck.
  "21067.the-magus-forced-response": forcedResponse(
    on.enemyAttacks("self", { againstYou: true }),
    moveCards(topOfDeck(5), "discard"),
  ),

  // Universal Church of Truth (21068) — side scheme, acceleration icon (data). Forced Response: After a player
  // resets their deck, exhaust that player identity and stun it. [star] Boost: Reveal this card.
  "21068.universal-church-of-truth-forced-response": forcedResponse(
    on.aPlayerResetsTheirDeck(),
    exhaust(identityOf(eventPlayer)),
    stun(identityOf(eventPlayer)),
  ),
  "21068.boost": boost(revealCard(self, firstPlayer)),

  // Zealot of Truth (21069) — Mystic (data). Threat cannot be removed from the Universal Church of Truth side
  // scheme. [star] Boost: Put Zealot of Truth into play engaged with you.
  "21069.zealot-of-truth-constant": constant(
    rule({ kind: "threatCannotBeRemoved", target: UNIVERSAL_CHURCH_OF_TRUTH }),
  ),
  "21069.boost": boost(putIntoPlay(self, you), engage(self, you)),

  // Cosmic Inquisition (21070) — Incite 2 (data). When Revealed: If the Universal Church of Truth side scheme is in
  // play, discard the top 10 cards of your deck. Otherwise, search the encounter deck, discard pile, and set-aside
  // area for Universal Church of Truth and reveal it. Shuffle the encounter deck.
  "21070.when-revealed": whenRevealed(
    ifThen(exists(UNIVERSAL_CHURCH_OF_TRUTH), moveCards(topOfDeck(10), "discard"), [
      selectCards(
        "found",
        oneCopyOf(
          anyOfCards(
            encounterCards(["deck", "discard"], { name: "Universal Church of Truth" }),
            encounterSetAside({ name: "Universal Church of Truth" }),
          ),
        ),
      ),
      revealCard(chosen("found")),
      shuffleEncounterDeck(),
    ]),
  ),
});
