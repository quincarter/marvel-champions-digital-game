import { trait } from "@mc/content";
import type { EffectSpec } from "@mc/engine";
import {
  anyOfCards,
  cards,
  chosen,
  constant,
  defineAbilities,
  each,
  encounterCards,
  endGame,
  enemyActivates,
  exists,
  forcedResponse,
  ifThen,
  moveCards,
  named,
  on,
  oneCopyOf,
  partOf,
  placeThreat,
  query,
  removeCountersFrom,
  revealCard,
  schemeThreatOn,
  selectCards,
  self,
  setAside,
  shuffleEncounterDeck,
  surge,
  threatOn,
  valueAtLeast,
  valueAtMost,
  whenRevealed,
  you,
  youHaveTrait,
  losesIcon,
} from "../../../dsl/index.js";

const UNLEASHED = trait("UNLEASHED");
const RESTRAINED = trait("RESTRAINED");
const DARK_PHOENIX = query("minion", { name: "Dark Phoenix" });
const CONSUME_THE_WORLD = named("Consume the World");

/**
 * "Search the encounter deck, discard pile, and set-aside area for X and reveal it." The set-aside area is the
 * revealing player's own nemesis-set pile (`PlayerState.setAside`), where the nemesis set starts; the deck is shuffled
 * after the search. "It" is one card (`oneCopyOf`).
 */
const searchAllAndReveal = (found: ReturnType<typeof query>): EffectSpec[] => [
  selectCards("found", oneCopyOf(anyOfCards(encounterCards(["deck", "discard"], found), setAside(you, found)))),
  revealCard(chosen("found"), you),
  shuffleEncounterDeck(),
];

/**
 * Burning Hunger (34028), Phoenix's obligation, and her Dark Phoenix nemesis set: Dark Phoenix (34029, nemesis
 * minion), Consume the World (34030, permanent side scheme) and Fiery Rage x3 (34031, treachery). docs/phase7-wave6.md
 * §6.1, §3.37, §3.38.
 *
 * - **Burning Hunger** is not the shared `obligation()` shape: one When Revealed with two branches on Phoenix Force's
 *   granted trait (text transcribed from its scan). UNLEASHED: search for Dark Phoenix and reveal her, then remove this
 *   card from the game (no discard). RESTRAINED: remove 1 power counter from Phoenix Force and this card gains surge,
 *   then discard it. Removing the last counter flips Phoenix Force to Unleashed through its own forced response.
 *   The card data's `-constant` ref is the printed "Give to the Jean Grey player." line, which is data.
 * - **Dark Phoenix**: Steady, Toughness, Villainous are data. Her scheme threat goes on Consume the World while it is
 *   in play, else on the main scheme ("if able"; §3.37).
 * - **Consume the World**: loses its amplify icon while it holds no threat (§3.38); the players lose once at least 12
 *   threat is on it after threat is placed there.
 * - **Fiery Rage**: Peril is data; if Dark Phoenix is in play she activates against you, otherwise 1 threat goes on
 *   Consume the World and this card gains surge.
 */
export const PHOENIX_OBLIGATION_NEMESIS = defineAbilities({
  "34028.burning-hunger-constant": partOf("34028.when-revealed"),
  "34028.when-revealed": whenRevealed(
    ifThen(
      youHaveTrait(UNLEASHED),
      [...searchAllAndReveal(DARK_PHOENIX), moveCards(cards(self), "removedFromGame")],
      [
        ifThen(youHaveTrait(RESTRAINED), [removeCountersFrom(named("Phoenix Force"), "power", 1), surge()]),
        moveCards(cards(self), "discard"),
      ],
    ),
  ),

  "34029.dark-phoenix-constant": constant(schemeThreatOn({ self: true }, CONSUME_THE_WORLD)),
  "34029.when-revealed": whenRevealed(...searchAllAndReveal(query("sideScheme", { name: "Consume the World" }))),

  "34030.consume-the-world-constant": constant(
    losesIcon("amplify", { self: true }, { while: valueAtMost(threatOn(self), 0) }),
  ),
  "34030.consume-the-world-forced-response": forcedResponse(
    on.threatPlaced("self"),
    ifThen(valueAtLeast(threatOn(self), 12), endGame("loss")),
  ),

  "34031.when-revealed": whenRevealed(
    ifThen(exists(DARK_PHOENIX), enemyActivates(each(DARK_PHOENIX), { against: you }), [
      placeThreat(1, CONSUME_THE_WORLD),
      surge(),
    ]),
  ),
});
