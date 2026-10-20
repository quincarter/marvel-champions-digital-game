/**
 * A second encounter-side deck a scenario declares, gathered by trait (the trap deck, Shadowland MC65 pp. 12-13, FAQ
 * p. 18; docs/phase7-shadowland.md §6 M3). The engine's `ScenarioSeparateDeck` with `discardByTrait`: these builders
 * spell the declaration and the reveal; the rules live in the engine (`discardZoneFor`, `resetScenarioDeckIfEmpty`).
 */

import type { CardId, EncounterSetId, ScenarioSeparateDeck, Trait } from "@mc/content";
import type { EffectSpec, PlayerRef } from "@mc/engine";
import { scenarioDeck, selectCards } from "./effects.js";
import { you } from "./values.js";

/**
 * A scenario's setup option (`Scenario.separateDecks`, or `GameSetupConfig.scenarioDecks`): a deck built during setup
 * right after the encounter deck from every card in it printing `trait`, every card of `wholeEncounterSetIds` and each
 * of `cardIds`. "During setup, in addition to creating the encounter deck, find each TRAP! treachery from the encounter
 * deck and shuffle them together with the Deadly Contraptions set and [...] Whisper in the Dark" (MC65 p. 12).
 *
 * Its rules: a card printing `trait` that would be discarded goes to this deck's discard pile wherever it is, any other
 * card to its encounter discard pile even when drawn from this deck (p. 13); once empty, its discard pile is shuffled
 * into a new deck at once, with no acceleration token and no encounter deck reset (p. 12).
 */
export const traitEncounterDeck = (
  name: string,
  trait: Trait,
  opts: { readonly wholeEncounterSetIds?: readonly EncounterSetId[]; readonly cardIds?: readonly CardId[] } = {},
): ScenarioSeparateDeck => ({
  name,
  contents: {
    trait,
    ...(opts.wholeEncounterSetIds ? { wholeEncounterSetIds: opts.wholeEncounterSetIds } : {}),
    ...(opts.cardIds ? { cardIds: opts.cardIds } : {}),
  },
  discardPile: "own",
  whenEmpty: "reshuffleDiscardWithoutPenalty",
  discardByTrait: trait,
  buildAtSetup: true,
});

/**
 * "Reveal a card from the trap deck" (MC65 p. 12: "that player reveals the top card of that deck and resolves the card
 * as normal"): two effects to spread into an ability's list. The top card of the scenario deck `name` is bound to
 * `slot` and revealed by `player` through the whole reveal procedure (RRG 1.8 "Reveal", p. 38). A surge on it deals the
 * next card from the encounter deck (FAQ p. 18), as every surge does. With the deck and its discard pile both empty
 * nothing is revealed and nothing else happens (an engine reading; the insert does not say).
 */
export const revealTopOfScenarioDeck = (
  name: string,
  player: PlayerRef = you,
  slot = `top-of-${name}`,
): readonly EffectSpec[] => [
  selectCards(slot, scenarioDeck(name, { top: 1 })),
  { kind: "revealCard", cards: { kind: "slot", slot }, player },
];
