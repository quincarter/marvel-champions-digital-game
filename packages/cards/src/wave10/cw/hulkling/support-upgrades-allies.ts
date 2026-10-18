import type { AbilityRegistry } from "@mc/engine";
import {
  TRAIT,
  YOUR_HERO,
  after,
  alterEgoAction,
  chooseCards,
  chosen,
  constant,
  cards,
  damageAnEnemy,
  defineAbilities,
  draw,
  enemyScheme,
  eventSource,
  exhaustThis,
  forcedInterrupt,
  gainsKeyword,
  gainsTrait,
  generatesAmount,
  gets,
  heal,
  heroResponse,
  ifElse,
  instead,
  moveCards,
  ofClassification,
  ofIdentitySetTitled,
  on,
  payingFor,
  query,
  removeThreatFromAScheme,
  resource,
  response,
  shuffleDeck,
  yourIdentity,
  zone,
  you,
} from "../../../dsl/index.js";

/** "After you play an event" for a Shapeshift upgrade's Hero Response: an event of any kind, played at any time. */
const AFTER_YOU_PLAY_AN_EVENT = after.youPlayedCard(query("event"));
const SHAPE_RESPONSE = { cost: exhaustThis };

/**
 * Wave 10 scripting module `cw/hulkling/support-upgrades-allies` (docs/phase7-wave10.md section 8.4, docs/phase7-wave10-box-heroes.md B8.4).
 *
 * Cards (7):
 * - 56030 Wiccan (ally)
 * - 56031 Altman Residence (support)
 * - 56032 Winged Shape (upgrade)
 * - 56033 Hulk Shape (upgrade)
 * - 56034 Armored Shape (upgrade)
 * - 56035 Imitation Shape (upgrade)
 * - 56036 Alien Physiology (upgrade)
 *
 * **56030.wiccan-response**: "After you play Wiccan from your hand, search your deck and discard pile for an
 * identity-specific event and add it to your hand. (Shuffle.)" `youPlayThis` hears the play from hand only, not a
 * put into play. The deck is shuffled whether or not an event was found (RRG 1.8 "Search", p. 39).
 *
 * **56031.altman-residence-action**: heals Teddy Altman (the alter-ego, as it is an Alter-Ego Action) and shuffles one
 * card of Hulkling's set from the discard pile into the deck; the heal does not wait on there being a card.
 *
 * **56032 to 56035, the constants**: "Hulkling gets +N ..." names the hero face, so the bonus applies in hero form only
 * (`YOUR_HERO`). The Shapeshift upgrades' discarding of one another is Hulkling's Chosen Shape (56029a), not these
 * cards'. **56032 to 56035, the responses**: "Hero Response: After you play an event, exhaust this" is heard for an
 * event of any classification, once it has resolved (`cardPlayed`).
 *
 * **56035.imitation-shape-forced-interrupt**: "When an enemy would attack you, it schemes instead." A forced
 * replacement that stays in play. Status cards come first (RRG 1.8 "Status Cards", p. 41), so a stunned enemy
 * discards its stunned card and does not scheme.
 *
 * **56036.alien-physiology-resource**: "Resource: Exhaust Alien Physiology -> generate a [wild] resource ([wild]
 * [wild] resources instead if paying for a Hulkling card)." The amount reads the card the payment is for
 * (`payingFor`): a card of Hulkling's identity-specific set being played, or one whose ability's cost is being paid
 * (FAQ "Finesse (#33)", RRG 1.8 p. 60). For any other card, and for a payment for no card, it is 1.
 */
export const HULKLING_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "56030.wiccan-response": response(
    after.youPlayThisFromHand(),
    chooseCards(
      "found",
      zone(["deck", "discard"], you, { filter: query("event", ofClassification("identitySpecific")) }),
      {
        min: 1,
        max: 1,
      },
    ),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  "56031.altman-residence-action": alterEgoAction(
    { cost: exhaustThis },
    heal(2, yourIdentity),
    chooseCards("shuffled", zone("discard", you, { filter: ofIdentitySetTitled("Hulkling") }), { min: 1, max: 1 }),
    moveCards(cards(chosen("shuffled")), "deckShuffle"),
  ),

  "56032.winged-shape-constant": constant(
    gets("thw", 1, YOUR_HERO),
    gets("atk", 1, YOUR_HERO),
    gets("def", 1, YOUR_HERO),
    gainsTrait(TRAIT.AERIAL, YOUR_HERO),
  ),
  "56032.winged-shape-response": heroResponse(AFTER_YOU_PLAY_AN_EVENT, SHAPE_RESPONSE, ...removeThreatFromAScheme(2)),

  "56033.hulk-shape-constant": constant(gets("atk", 2, YOUR_HERO), gets("def", 1, YOUR_HERO)),
  "56033.hulk-shape-response": heroResponse(AFTER_YOU_PLAY_AN_EVENT, SHAPE_RESPONSE, ...damageAnEnemy(2)),

  "56034.armored-shape-constant": constant(
    gets("atk", 1, YOUR_HERO),
    gets("def", 2, YOUR_HERO),
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_HERO),
  ),
  "56034.armored-shape-response": heroResponse(AFTER_YOU_PLAY_AN_EVENT, SHAPE_RESPONSE, heal(2, yourIdentity)),

  "56035.imitation-shape-constant": constant(gets("thw", 2, YOUR_HERO)),
  "56035.imitation-shape-forced-interrupt": forcedInterrupt(
    on.enemyAttacks(query("enemy"), { againstYou: true }),
    { would: true },
    instead(enemyScheme(eventSource)),
  ),
  "56035.imitation-shape-response": heroResponse(AFTER_YOU_PLAY_AN_EVENT, SHAPE_RESPONSE, draw(1)),

  "56036.alien-physiology-resource": resource(
    generatesAmount("wild", ifElse(payingFor(ofIdentitySetTitled("Hulkling")), 2, 1)),
    { cost: exhaustThis },
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const HULKLING_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
