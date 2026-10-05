import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  action,
  andThen,
  anAttackableEnemy,
  attack,
  cancelRevealedCard,
  cards,
  chooseCards,
  chosen,
  countOf,
  dealDamage,
  damageThisCardCost,
  defineAbilities,
  discardThis,
  discardTopOfDeckCost,
  each,
  exhaustThis,
  heroAction,
  heroInterrupt,
  interrupt,
  modifyAttack,
  modifyBasicPower,
  modifyStat,
  moveCards,
  attachCard,
  eventTarget,
  on,
  query,
  response,
  revealEncounterCard,
  self,
  totalPrintedResources,
  valueAtMost,
  when,
  you,
  YOUR_IDENTITY,
  zone,
} from "../../../dsl/index.js";

const POSSE = trait("POSSE");
/** The cards a "discard the top card of your deck →" cost discarded: "each resource icon discarded this way". */
const PAID = { kind: "slot", slot: "paid" } as const;
const ICONS_DISCARDED = totalPrintedResources(PAID);
const FACEDOWN_HERE = { host: self, facedown: true } as const;

/**
 * Domino's allies, supports and upgrades (40038, 40039, 40044-40049), docs/phase7-wave7.md §7.1, §3.55-§3.58, §3.61.
 *
 * Every "for each resource icon discarded this way" reads the slot of a `discardTopOfDeckCost`: the discard is a
 * cost (the "→" follows it, RRG "Cost", p. 14), so it is paid in full before the effect and a deck that cannot pay
 * leaves the ability unoffered. `totalPrintedResources` over the slot is where Domino's hero-face rule (a printed
 * wild counts twice, §3.56, MC40 p. 21) is applied.
 *
 * - **Diamondback (40038)**: exhaust, 1 damage to her and the discard are one cost; the damage to each enemy is not an
 *   attack. She resolves even when the cost defeats her (MC40 p. 21).
 * - **Outlaw (40039)**: Toughness is data. The Interrupt on her attack pays the discard and gives +1 ATK per icon until
 *   the attack ends. The star icon only marks the ability next to her ATK; the use is optional.
 * - **Pip the Pug (40044)**: a card of the Domino identity set, or any POSSE card, from the discard pile to the top
 *   of the deck.
 * - **The Painted Lady (40045)**: the Response is offered only while fewer than 3 cards are attached (a trigger
 *   `while`, so a full Painted Lady is not offered); the card, in the discard pile or in the reset deck, is attached
 *   facedown. A card another response already moved is not offered (§3.55). The alter-ego Action adds one attached
 *   card to hand.
 * - **Domino's Pistol (40046)**: Restricted is data. An attack labeled so Retaliate and Toughness apply; the damage is
 *   one per icon and the attack gains ranged.
 * - **Lucky and Good (40047)**: cancels the icons and the Boost ability of the boost card, then "another boost card
 *   for this attack" is one more card for the activation in progress (`extraBoostCards`, as Hydra Exo-Soldier
 *   04131), not a facedown boost card waiting for the next activation.
 * - **Lucky Break (40048)**: the Black Widow 01075 shape: the cost is discarding it, then the revealed card is
 *   cancelled and discarded and another is revealed. "When you reveal" is the revealing player's reveal.
 * - **Probability Field (40049)**: a plain Interrupt on the identity's basic power (alter-ego REC included).
 */
export const DOMINO_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "40038.diamondback-action": action(
    { cost: [exhaustThis, damageThisCardCost(1), discardTopOfDeckCost(1, "paid")] },
    dealDamage(ICONS_DISCARDED, each(query("enemy"))),
  ),

  "40039.outlaw-interrupt": interrupt(
    on.attacks("self"),
    { cost: discardTopOfDeckCost(1, "paid") },
    modifyStat("atk", ICONS_DISCARDED, self, "endOfAttack"),
  ),

  "40044.pip-the-pug-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards(
      "returned",
      zone("discard", you, { filter: { anyOf: [{ identitySetTitled: { names: ["Domino"] } }, { trait: POSSE }] } }),
      { min: 1, max: 1 },
    ),
    moveCards(cards(chosen("returned")), "deckTop"),
  ),

  "40045.the-painted-lady-response": response(
    on.youDiscardFromYourDeck(),
    { while: valueAtMost(countOf(FACEDOWN_HERE), 2) },
    attachCard(eventTarget, self, { facedown: true }),
  ),
  "40045.the-painted-lady-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("banked", { kind: "ref", ref: each(FACEDOWN_HERE) }, { min: 1, max: 1 }),
    moveCards(cards(chosen("banked")), "hand"),
  ),

  "40046.dominos-pistol-action": heroAction(
    { label: "attack", cost: [exhaustThis, discardTopOfDeckCost(1, "paid")] },
    anAttackableEnemy(),
    attack(ICONS_DISCARDED, chosen("enemy"), { keywords: ["ranged"] }),
  ),

  "40047.lucky-and-good-interrupt": heroInterrupt(
    { on: "boostCardTurnedFaceup", playerIs: "controller", activation: "attack" },
    { label: "defense", cost: exhaustThis },
    // No DSL wrapper for these two (Close Call 16158, Wraith 22012 pass the engine's own data).
    { kind: "cancelBoostIcons" },
    { kind: "cancelBoostAbility" },
    modifyAttack({ extraBoostCards: 1 }),
  ),

  "40048.lucky-break-interrupt": heroInterrupt(
    { ...when.encounterCardRevealed(), playerIs: "controller" },
    { cost: discardThis },
    cancelRevealedCard(),
    andThen(revealEncounterCard(you)),
  ),

  "40049.probability-field-interrupt": interrupt(
    on.basicPowerUsing(YOUR_IDENTITY),
    { cost: discardTopOfDeckCost(1, "paid") },
    modifyBasicPower(ICONS_DISCARDED),
  ),
});
