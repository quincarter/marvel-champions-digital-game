import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  alterEgoAction,
  chooseTarget,
  chosen,
  defineAbilities,
  exhaustYourHero,
  oncePerRound,
  playFromDeckReducingCost,
  query,
  resolveSpecialsOf,
  response,
  TRAIT,
  you,
} from "../../../dsl/index.js";

/** The Black Panther upgrades this player controls: the cards "the 'Special' ability on 1 Black Panther upgrade you control" names. */
export const YOUR_BLACK_PANTHER_UPGRADES = query("upgrade", { controller: "you", trait: TRAIT.BLACK_PANTHER });

/**
 * The shared body of 51001a and T'Challa 51002: choose 1 Black Panther upgrade you control, resolve its "Special".
 * With no such upgrade nothing is asked and nothing resolves. Resolving a Special is not a basic power, so no response
 * chains off it (RRG 1.8 "Special", p. 40).
 */
export const RESOLVE_ONE_SPECIAL = [
  chooseTarget("upgrade", YOUR_BLACK_PANTHER_UPGRADES),
  resolveSpecialsOf(chosen("upgrade")),
] as const;

/**
 * Wave 9 scripting module `bp/black-panther/identity` (docs/phase7-wave9.md section 8.4, 3.36, 3.37).
 *
 * Cards (1):
 * - 51001a Black Panther (hero_identity) / 51001b Shuri
 *
 * **51001a (hero face)**: "Response: After Black Panther uses a basic power, resolve the 'Special' ability on 1
 * Black Panther upgrade you control." An optional response to his own basic attack, thwart or defense (hero form only:
 * the ability is printed on the hero face). Alter-ego Shuri has no basic power response.
 *
 * **51001b (alter-ego face)**: "Inventor — Action: Exhaust Shuri → search your deck for a Black Panther or Tech
 * upgrade and play it, reducing its resource cost by 2. (Limit once per round.)" The whole deck is searched and only an
 * upgrade with either trait (of any aspect) that she may play now and can pay for after the reduction is offered; the
 * rest of its cost is paid as for any play, and it is played, so "after you play" responses answer. The deck is
 * shuffled once the upgrade has entered play, or at once when none was played (RRG 1.8 "Search", p. 39). With nothing
 * to find the action can still be used (RRG 1.8 "Target", p. 43: "An ability with a search effect requires only a
 * searchable game area in order to initiate"): Shuri exhausts and the deck is shuffled.
 */
export const BLACK_PANTHER_IDENTITY: AbilityRegistry = defineAbilities({
  "51001a.black-panther-response": response(after.basicPowerUsed("self"), ...RESOLVE_ONE_SPECIAL),

  "51001b.inventor": alterEgoAction(
    { cost: exhaustYourHero, limit: oncePerRound },
    playFromDeckReducingCost(2, you, { filter: query("upgrade", { anyTrait: [TRAIT.BLACK_PANTHER, TRAIT.TECH] }) }),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BLACK_PANTHER_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
