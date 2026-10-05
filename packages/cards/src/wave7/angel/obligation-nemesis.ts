import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  FRIENDLY_CHARACTER,
  after,
  alterEgoAction,
  attachCard,
  attackInProgress,
  boost,
  cannotAttach,
  changeToHeroFormNamed,
  chosen,
  constant,
  coveredByEngineRule,
  dealEncounterCard,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardDeckUntil,
  encounterCards,
  eventTarget,
  exhaust,
  firstPlayer,
  forcedResponse,
  gets,
  ifThen,
  inPlay,
  named,
  placeThreat,
  printedCostOf,
  query,
  refMatches,
  revealCard,
  rule,
  selectCards,
  self,
  shuffleEncounterDeck,
  surge,
  theMainScheme,
  whenRevealed,
  you,
  youAreNamed,
} from "../../dsl/index.js";

const AERIAL = trait("AERIAL");
const BRUTE = trait("BRUTE");
const EVENT = query("event");

/**
 * "Discard cards from the top of your deck until you discard an event. Take indirect damage equal to that event's
 * printed cost." (Harpoon 42025 and Spear Shot 42028.) The event stays in the discard pile; with no event in the deck
 * the whole deck is discarded and nothing is bound, so there is no damage (RRG "Player Deck", p. 33).
 */
const DISCARD_UNTIL_EVENT = [
  discardDeckUntil(EVENT, "event"),
  ifThen(refMatches(chosen("event"), {}, { anywhere: true }), dealIndirectDamage(you, printedCostOf(chosen("event")))),
];

/**
 * Angel's obligation and nemesis set (42024-42028), docs/phase7-wave7.md §7.2, §3.62, §3.63, §3.70.
 *
 * - **Apocalyptic Influence (42024)**: "Give to the Warren Worthington III player" is engine data. When Revealed: in
 *   Archangel form 2 threat on the main scheme, otherwise a change to Archangel form (from either other face). It
 *   stays in the player's play area (its printed hazard icon is data). The Alter-Ego Action deals the first player 1
 *   facedown encounter card and discards it. FFG: the deal is printed as a cost ("→"); the engine's
 *   `AbilityCost.dealEncounterCards` can only deal the paying player, so it is the first effect, which differs only
 *   in that the deal cannot fail to be paid.
 * - **Harpoon (42025)**: +1 ATK while attacking an AERIAL character; When Revealed as Spear Shot.
 * - **Hook, Line, and Sinker (42026)**: BRUTE attacks deal indirect damage. Forced Response: each friendly character
 *   that takes at least 1 of its assigned share of any indirect damage (RRG "Indirect Damage", p. 24: a BRUTE's attack,
 *   Harpoon's own, a boost) is exhausted, any player's; a share a tough status card absorbs was not taken.
 * - **Harpoon's Harpoon (42027)**: attaches to Harpoon (data; +1 ATK is data). With no Harpoon in play: search the
 *   encounter deck and discard pile, reveal him, attach to him; if that cannot be done the card gains surge.
 * - **Spear Shot (42028)**: as Harpoon's When Revealed, and gains surge if the event was AERIAL. Boost: 2 indirect damage.
 */
export const ANGEL_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "42024.obligation": coveredByEngineRule(),
  "42024.when-revealed": whenRevealed(
    ifThen(youAreNamed("Archangel"), placeThreat(2, theMainScheme), changeToHeroFormNamed("Archangel")),
  ),
  "42024.apocalyptic-influence-action": alterEgoAction(dealEncounterCard(firstPlayer), discard(self)),

  "42025.harpoon-constant": constant(
    gets("atk", 1, query("minion", { self: true }), {
      while: attackInProgress({ attacker: { self: true }, target: { trait: AERIAL } }),
    }),
  ),
  "42025.when-revealed": whenRevealed(...DISCARD_UNTIL_EVENT),

  "42026.hook-line-and-sinker-constant": constant(
    rule({ kind: "attacksDealIndirectDamage", attacker: query("enemy", { trait: BRUTE }) }),
  ),
  "42026.hook-line-and-sinker-forced-response": forcedResponse(
    after.damage(FRIENDLY_CHARACTER, { indirect: true, taken: true }),
    exhaust(eventTarget),
  ),

  "42027.harpoons-harpoon-constant": cannotAttach(
    selectCards("found", encounterCards(["deck", "discard"], query("minion", { name: "Harpoon" }))),
    ifThen(refMatches(chosen("found"), {}, { anywhere: true }), revealCard(chosen("found"), you)),
    shuffleEncounterDeck(),
    ifThen(inPlay("Harpoon"), attachCard(self, named("Harpoon")), surge()),
  ),
  "42027.harpoons-harpoon-forced-response": forcedResponse(
    after.enemyAttacks("host", { againstYou: true }),
    dealIndirectDamage(you, 2),
  ),

  "42028.when-revealed": whenRevealed(
    ...DISCARD_UNTIL_EVENT,
    ifThen(refMatches(chosen("event"), { trait: AERIAL }, { anywhere: true }), surge()),
  ),
  "42028.boost": boost(dealIndirectDamage(you, 2)),
});
