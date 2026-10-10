import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  alterEgoAction,
  andThen,
  anEnemy,
  chooseCards,
  chosen,
  confuse,
  constant,
  defineAbilities,
  discardThis,
  draw,
  encounterCards,
  exhaustThis,
  gainsKeyword,
  gainsTrait,
  gets,
  heroInterrupt,
  heroResponse,
  modifyAttack,
  modifyCardEffect,
  modifyStat,
  moveCards,
  cards,
  on,
  putIntoPlay,
  query,
  ready,
  resource,
  shuffleEncounterDeck,
  yourIdentity,
  YOUR_HERO,
  YOUR_IDENTITY,
  you,
  zone,
} from "../../../dsl/index.js";

const ATTACK = trait("ATTACK");
const SPY = trait("SPY");

/**
 * The note Cybernetic Arm writes on the play of the Attack event it paid for. An event that reads "If you exhausted
 * Cybernetic Arm to pay for this event" is `ifThen(playNote(CYBERNETIC_ARM_NOTE), ...)`; the note lasts while that card
 * resolves (`modifyCardEffect.note`, docs/phase7-wave6.md section 3.52).
 */
export const CYBERNETIC_ARM_NOTE = "cyberneticArm";

/**
 * Wave 9 scripting module `winter/winter-soldier/support-upgrades-allies` (docs/phase7-wave9.md section 8.4, 3.52).
 * `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * **54002.cybernetic-arm-resource**: "Resource: Exhaust Cybernetic Arm -> generate a [wild] resource for an Attack
 * event. That event deals 1 additional damage." `generatesFor` an Attack event (FAQ "Finesse (#33)", RRG 1.8 p. 60:
 * only while paying for such a card). The 1 damage is `modifyCardEffect` on the event paid for (slot `paidFor`), added
 * to each instance of damage the event deals (RRG 1.8 "Event", p. 19; owner ruling Q53: not to damage that is itself
 * "additional", and not to damage the player takes). It also writes the note `CYBERNETIC_ARM_NOTE` on the event's
 * play, which is how Arm Block 54004, Metal Punch 54005 and Electrical Discharge 54006 read "If you exhausted Cybernetic
 * Arm to pay for this event" (`playNote`). Overpaying is legal as for any generator (RRG p. 13), so the Arm may be used
 * for an event it is not needed for; the damage and the note follow the Arm, not the need.
 *
 * **54003.black-widow-response**: "Response: After you play Black Widow from your hand, return an Attack event from
 * your discard pile to your hand." Mandatory text in the response ("return", no "may"): the player picks the event; the
 * response is optional to trigger (it is a response, not forced) but returns an event when it resolves. With no Attack
 * event in the discard pile there is nothing to choose. `cardPlayed` does not record the zone the card was played from,
 * and every ordinary play is from the hand; a play from elsewhere (an effect that plays an ally from the discard pile)
 * would still be answered here (see the module's hand-off note).
 *
 * **54007.safe-house-30-action**: "Alter-Ego Action: Exhaust Safe House #30 -> search the encounter deck for a minion
 * and put it into play engaged with you. (Shuffle.) Then, draw 1 card." The search is compulsory when a minion is in the
 * deck (no "may", owner ruling), the deck alone (not the discard pile), the encounter deck of the active villain. The
 * minion enters play engaged with the player (not revealed: no When Revealed, no surge, no boost). The deck is shuffled
 * when the search completes. "Then" (RRG 1.8 p. 44): the card is drawn only if the search found a minion.
 *
 * **54008.silent-infiltration-response**: "Hero Response: After you attack and defeat an enemy, discard this card ->
 * ready your hero and confuse an enemy." Your attack (basic, an attack event or an ability), only when it defeated its
 * target (Lethal Protector's shape). The confused enemy is any enemy, chosen on resolution; the hero is readied first.
 *
 * **54009.winter-armor-constant**: "You get +3 hit points and gain steady." Your identity gets +3 hit points and gains
 * steady (a second stunned and confused status card), in either form like Thor's Helmet 06010 and Unshakable 31024.
 *
 * **54010.winter-mask-constant / 54010.winter-mask-response**: "You gain the Spy trait." and "Hero Response: After you
 * attack and defeat an enemy, exhaust Winter Mask -> draw 1 card."
 *
 * **54011.winter-rifle-interrupt**: "Restricted (data). Hero Interrupt: When Winter Soldier makes a basic attack,
 * exhaust Winter Rifle -> Winter Soldier gets +2 ATK for this attack. This attack gains piercing and ranged." Basic
 * attacks only (not an attack event or an ability), and only the hero.
 *
 * Cards (7):
 * - 54002 Cybernetic Arm (upgrade)
 * - 54003 Black Widow (ally)
 * - 54007 Safe House #30 (support)
 * - 54008 Silent Infiltration (upgrade)
 * - 54009 Winter Armor (upgrade)
 * - 54010 Winter Mask (upgrade)
 * - 54011 Winter Rifle (upgrade)
 */
export const WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "54002.cybernetic-arm-resource": resource(
    { wild: 1 },
    { cost: exhaustThis, generatesFor: query("event", { trait: ATTACK }) },
    modifyCardEffect(chosen("paidFor"), { damage: 1, note: { name: CYBERNETIC_ARM_NOTE, value: 1 } }),
  ),

  "54003.black-widow-response": heroResponse(
    on.youPlayThis(),
    chooseCards("returned", zone("discard", you, { filter: query("event", { trait: ATTACK }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("returned")), "hand"),
  ),

  "54007.safe-house-30-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("found", encounterCards(["deck"], query("minion")), { min: 1, max: 1 }),
    shuffleEncounterDeck(),
    putIntoPlay(chosen("found")),
    andThen(draw(1)),
  ),

  "54008.silent-infiltration-response": heroResponse(
    after.attacks(YOUR_IDENTITY, { defeats: true }),
    { cost: discardThis },
    ready(yourIdentity),
    anEnemy(),
    confuse(chosen("enemy")),
  ),

  "54009.winter-armor-constant": constant(
    gets("hp", 3, YOUR_IDENTITY),
    gainsKeyword({ name: "steady" }, YOUR_IDENTITY),
  ),

  "54010.winter-mask-constant": constant(gainsTrait(SPY, YOUR_IDENTITY)),
  "54010.winter-mask-response": heroResponse(
    after.attacks(YOUR_IDENTITY, { defeats: true }),
    { cost: exhaustThis },
    draw(1),
  ),

  "54011.winter-rifle-interrupt": heroInterrupt(
    on.attacks(YOUR_HERO, { basic: true }),
    { cost: exhaustThis },
    modifyStat("atk", 2, yourIdentity, "endOfAttack"),
    modifyAttack({ keywords: ["piercing", "ranged"] }),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
