import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  basicPowerStatIs,
  chooseCards,
  chosen,
  cards,
  defineAbilities,
  exhaustCardsCost,
  ifThen,
  interrupt,
  modifyBasicPower,
  moveCards,
  on,
  query,
  response,
  shuffleDeck,
  statOf,
  you,
  zone,
} from "../../../dsl/index.js";
import { ANT_PACK_CARDS } from "../../../wave2/ant/pack-cards.js";

const AVENGER = trait("AVENGER");

/**
 * Wave 10 scripting module `cw/aspect-basic/basic` (docs/phase7-wave10.md section 8.4, docs/phase7-wave10-box-heroes.md B8.4).
 *
 * Cards (6):
 * - 56019 Yellowjacket (ally)
 * - 56020 Energy (resource, reprint of 01088: no ability)
 * - 56021 Genius (resource, reprint of 01089: no ability)
 * - 56022 Strength (resource, reprint of 01090: no ability)
 * - 56052 Iron Lad (ally)
 * - 56053 Assess the Situation (event, reprint of 12033: aliased)
 *
 * **56019.yellowjacket-response**: "Response: After Yellowjacket enters play, search the top 5 cards of your deck for
 * an upgrade and add it to your hand." The title is the RRG 1.8 erratum (p. 70; the print reads "Yellow Jacket"). The
 * "Play only if you have the Avenger trait" half is card data (`playRestrictions.requiresIdentityTrait`). The search is
 * compulsory when an upgrade is among the five, and the deck is shuffled afterwards, found or not (RRG 1.8 "Search",
 * p. 39), as for Brother Voodoo 09012.
 *
 * **56052.iron-lad-interrupt**: "Interrupt: When Iron Lad uses a basic power, exhaust another Avenger ally you control
 * -> add that ally's matching power to Iron Lad's power for this use." An ally has only ATK and THW, so the power is
 * the one powering this use (an attack adds the exhausted ally's ATK, a thwart its THW; the Thor Teamwork 06032 and
 * Magneto 49019 shape). The exhaust is the cost, so nothing is offered without a ready Avenger ally other than Iron Lad
 * himself ("another": `self: false`, so a ready Iron Lad cannot pay with himself either), and a stunned or
 * confused Iron Lad has not used a basic power (RRG FAQ "Quicksilver", p. 61).
 *
 * **56053.assess-the-situation-action** aliases 12033's script.
 */
export const ASPECT_BASIC_BASIC: AbilityRegistry = defineAbilities({
  "56019.yellowjacket-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone("deck", you, { top: 5, filter: query("upgrade") }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  "56052.iron-lad-interrupt": interrupt(
    on.basicPowerUsing("self", { power: ["attack", "thwart"] }),
    { cost: exhaustCardsCost(query("ally", { controller: "you", trait: AVENGER, self: false }), { slot: "ally" }) },
    ifThen(
      basicPowerStatIs("atk"),
      modifyBasicPower(statOf(chosen("ally"), "atk")),
      modifyBasicPower(statOf(chosen("ally"), "thw")),
    ),
  ),

  "56053.assess-the-situation-action": ANT_PACK_CARDS["12033.assess-the-situation-action"]!,
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ASPECT_BASIC_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
