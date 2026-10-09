import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  cards,
  chooseCards,
  chosen,
  defineAbilities,
  eventResult,
  moveCards,
  on,
  query,
  raiseMoment,
  response,
  topOfDeck,
  YOUR_IDENTITY,
  you,
  zone,
} from "../../../dsl/index.js";

/** The name Bishop's "Energy Absorption" raises once it resolves (docs/phase7-wave8.md section 3.39, 3.52). */
export const ENERGY_ABSORPTION_MOMENT = "energyAbsorption";

const TEMPORAL = trait("TEMPORAL");

/**
 * Bishop / Lucas Bishop identity (45001a hero face, 45001b alter-ego face): docs/phase7-wave8.md section 7.1, 3.52, 3.39.
 *
 * **Energy Absorption (45001a)** is a Response to damage Bishop takes from an attack: any attack of an enemy (a basic
 * attack, an attack ability, overkill damage that reaches him), read after defense, prevention and a tough status card,
 * so a fully stopped attack takes nothing and offers nothing (`taken`: at least 1 placed). Not retaliate, indirect
 * damage, a treachery's damage or a cost, and not damage to an ally of his. The number of cards is the damage he took
 * (the event's `amount` result, never the amount dealt). That many cards leave the top of his deck for his discard pile
 * (a deck of fewer resets at the card that empties it, RRG p. 33), then each resource card among those discarded goes
 * to his hand; the rest stay in the discard pile. It is a Response with no forced label, so the player may decline.
 * The moment "energyAbsorption" is then raised once for Bishop's Uniform (45005). MC45 p. 22 drops "from an attack":
 * the card (scan 45001a) has it and wins. Hero form only: the ability is printed on the hero face.
 *
 * **Temporally Displaced (45001b)**, Response: after he changes to this form, a TEMPORAL card of his discard pile goes
 * to his hand (his choice; nothing happens with none there).
 *
 * Cards (1):
 * - 45001a Bishop (hero_identity)
 */
export const BISHOP_IDENTITY: AbilityRegistry = defineAbilities({
  "45001a.energy-absorption": response(on.damage(YOUR_IDENTITY, { fromAttack: true, taken: true }), [
    moveCards(topOfDeck(eventResult("amount")), "discard", "absorbed"),
    moveCards(cards(chosen("absorbed"), query("resource")), "hand"),
    raiseMoment(ENERGY_ABSORPTION_MOMENT),
  ]),

  "45001b.temporally-displaced": response(on.youChangeForm(), [
    chooseCards("temporal", zone("discard", you, { filter: { trait: TEMPORAL } }), { min: 1, max: 1 }),
    moveCards(cards(chosen("temporal")), "hand"),
  ]),
});
