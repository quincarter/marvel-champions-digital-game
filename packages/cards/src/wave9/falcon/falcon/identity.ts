import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  alterEgoAction,
  chooseCards,
  chosen,
  constant,
  cards,
  defineAbilities,
  discardEncounterCards,
  discardFromHandCost,
  duringPlayerPhase,
  moveCards,
  oncePerRound,
  playWithTopOfEncounterDeckFaceup,
  query,
  response,
  shuffleDeck,
  you,
  zone,
} from "../../../dsl/index.js";

const AERIAL = trait("AERIAL");
const BIRD = trait("BIRD");

/**
 * Wave 9 scripting module `falcon/falcon/identity` (docs/phase7-wave9.md section 8.4, 3.42, 3.43).
 *
 * Cards (1):
 * - 53001a Falcon (hero_identity)
 *
 * The card's other face is 53001b Sam Wilson (alter ego).
 *
 * **53001a.falcon-constant** (hero face): "During the player phase, play with the top card of the encounter deck
 * faceup." On the hero face only, so it is off in alter-ego form; it holds in the player phase only, so the card is
 * facedown again when the villain phase begins. Nothing is written on the card and nothing triggers (the encounter
 * deck's order is unchanged); each new top card is logged (`encounterTopShown`).
 *
 * **53001a.eagle-eyed** (hero face): "Response: After you play an Aerial card, discard the top card of the encounter
 * deck." An optional response (RRG 1.8 "Response", p. 37) to a card the identity's controller plays (an Aerial card of
 * any type; putting one into play without playing it does not answer). The discard is an effect, not a cost, with no
 * limit; a discard that empties the encounter deck is fulfilled and the deck is reset (RRG p. 17). The discarded card
 * is bound to slot `discarded` for Talon Line 53012 ("After you resolve Falcon's 'Eagle-Eyed' ability").
 *
 * **53001b.birds-of-a-feather** (alter-ego face): "Action: Discard 1 card from your hand -> search your deck and
 * discard pile for a Bird card and add it to your hand. (Limit once per round.)" The discard is the cost. The limit
 * belongs to the card and survives flipping (ruling January 26, 2026 - Ruling 6 (2)). The search is compulsory when a
 * Bird card is there (no "may"); the deck is shuffled afterwards, also when nothing is found (RRG 1.8 "Search", p. 39).
 */
export const FALCON_IDENTITY: AbilityRegistry = defineAbilities({
  "53001a.falcon-constant": constant(playWithTopOfEncounterDeckFaceup({ while: duringPlayerPhase })),

  "53001a.eagle-eyed": response(
    after.youPlayedCard(query([], { trait: AERIAL })),
    discardEncounterCards(1, { bind: "discarded" }),
  ),

  "53001b.birds-of-a-feather": alterEgoAction(
    { cost: discardFromHandCost(1, 1), limit: oncePerRound },
    chooseCards("found", zone(["deck", "discard"], you, { filter: query([], { trait: BIRD }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FALCON_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
