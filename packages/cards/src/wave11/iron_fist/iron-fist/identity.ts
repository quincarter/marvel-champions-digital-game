import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  alterEgoAction,
  chooseCards,
  constant,
  countersOn,
  defineAbilities,
  forcedResponse,
  heal,
  ifThen,
  losesKeyword,
  max,
  oncePerPhase,
  putIntoPlay,
  query,
  removeCountersAmong,
  response,
  scaled,
  self,
  shuffleDeck,
  valueAtLeast,
  varOf,
  zone,
  chosen,
} from "../../../dsl/index.js";
import { CHI, YOUR_IDENTITY_QUERY, placeChi } from "./chi.js";

const TECHNIQUE = trait("TECHNIQUE");
const YOUR_TECHNIQUES = query([], { controller: "you", trait: TECHNIQUE });

/**
 * Wave 11 scripting module `iron_fist/iron-fist/identity` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (1):
 * - 64001a Iron Fist (hero_identity); 64001b is the alter-ego face (Danny Rand).
 *
 * **64001a.martial-arts-master**: "Response: After you play a card, place 1 chi counter here." A card is played, not
 * put into play (RRG 1.8 "Play, Put into Play", p. 32): Meditation and Book of the Iron Fist give no chi, and
 * resources spent are not played. A hero-face ability, so nothing is gained in alter-ego form; counters stay on the
 * identity through a flip (RRG 1.8 "Change Form", p. 21). The placement is the shared `placeChi` effect so Lack of
 * Chi's interrupt can redirect it.
 *
 * **64001a.iron-fist-forced-response**: "After the player phase ends, remove all but 4 chi counters from here and heal
 * 1 damage for each removed this way." Heals only Iron Fist himself (ruling Sep 1, 2026, R1,
 * docs/rulings/marvel-champions-rulings-post-rrg-1-7.md). With 4 or fewer nothing is removed or healed.
 *
 * **64001b.danny-rand-constant**: "Your Technique cards lose temporary." RRG 1.8 "Temporary", p. 44. Face-gated: it
 * applies while Danny Rand is the face up, so a Technique put into play as Danny is discarded at the end of the
 * round once he has flipped to Iron Fist.
 *
 * **64001b.meditation**: "Search your deck and discard pile for a Technique card. Put that card into play. (Limit
 * once per phase.)" The pick is mandatory when a Technique exists, as the other search-and-put cards (Agent Coulson,
 * Mystical Studies); the deck is shuffled afterwards (RRG 1.8 "Search", p. 39). Put into play, so it is not played and gives no chi.
 */
export const IRON_FIST_IRON_FIST_IDENTITY: AbilityRegistry = defineAbilities({
  "64001a.martial-arts-master": response(after.youPlayedCard(query([])), placeChi(1)),

  "64001a.iron-fist-forced-response": forcedResponse(
    after.phaseEnding("player"),
    ifThen(valueAtLeast(countersOn(self, CHI), 5), [
      removeCountersAmong(CHI, max(0, scaled(countersOn(self, CHI), { plus: -4 })), YOUR_IDENTITY_QUERY, {
        bind: "removed",
      }),
      heal(varOf("removed.amount"), self),
    ]),
  ),

  "64001b.danny-rand-constant": constant(losesKeyword({ name: "temporary" }, YOUR_TECHNIQUES)),

  "64001b.meditation": alterEgoAction(
    { limit: oncePerPhase },
    chooseCards("found", zone(["deck", "discard"], undefined, { filter: query([], { trait: TECHNIQUE }) }), {
      min: 1,
      max: 1,
    }),
    putIntoPlay(chosen("found")),
    shuffleDeck(),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const IRON_FIST_IRON_FIST_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
