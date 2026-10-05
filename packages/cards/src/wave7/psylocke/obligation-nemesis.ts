import { trait } from "@mc/content";
import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  alterEgoAction,
  boost,
  CAN_TAKE_THIS_ATTACK,
  cannotFlip,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  countOf,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardFromHandCost,
  each,
  exhaust,
  flipCard,
  forcedInterrupt,
  hasNamedResource,
  ifThen,
  made,
  modifyAttack,
  moveCards,
  not,
  on,
  option,
  query,
  refMatches,
  retargetPlayerAttack,
  selectCards,
  self,
  spendResources,
  sum,
  surge,
  totalPrintedResources,
  valueAtLeast,
  whenRevealed,
  placeThreat,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

const PSIONIC = trait("PSIONIC");
const PSI_ENERGY = trait("PSI-ENERGY");

/**
 * "The number of [mental] resources on cards you control" (docs/phase7-wave7.md §3.65, §4.1 Q39 = C): RRG p. 31 as
 * written, so cards in play under your control, in your hand, in your deck and in your discard pile, printed icons
 * counted (a blade shows the icons of its face). A wild icon is not a [mental] resource.
 */
const SELECT_YOUR_CARDS = [
  selectCards("inPlay", cards(each(query([], { controlledBy: you })))),
  selectCards("inHand", zone("hand", you)),
  selectCards("inDeck", zone("deck", you)),
  selectCards("inDiscard", zone("discard", you)),
];
const MENTAL_ON_YOUR_CARDS = sum(
  totalPrintedResources(chosen("inPlay"), ["mental"]),
  totalPrintedResources(chosen("inHand"), ["mental"]),
  totalPrintedResources(chosen("inDeck"), ["mental"]),
  totalPrintedResources(chosen("inDiscard"), ["mental"]),
);

/** "When you attack an enemy": the attached identity's own attack (an ally's attack is the ally's, not yours). */
const YOU_ATTACK_AN_ENEMY: EventPattern = {
  on: "attack",
  playerIs: "controller",
  sourceIs: { categories: ["identity"] },
  targetIs: query("enemy"),
};

/** Naming `type`, discarding the top card of the deck, and redirecting the attack if that card has no such resource. */
const naming = (type: "physical" | "mental" | "energy" | "wild") =>
  option(
    `Name ${type}`,
    selectCards("top", zone("deck", you, { top: 1 })),
    moveCards(cards(chosen("top")), "discard"),
    // An empty deck discards nothing, so there is no card that lacks the resource: the attack stands (flagged to the
    // owner; the card is silent). A printed wild icon counts as any named type (Q40 = B).
    ifThen(
      refMatches(chosen("top"), {}, { anywhere: true }),
      ifThen(not(refMatches(chosen("top"), hasNamedResource(type, "anyType"), { anywhere: true })), [
        chooseTarget("newTarget", CAN_TAKE_THIS_ATTACK),
        retargetPlayerAttack(chosen("newTarget")),
        discard(self),
      ]),
    ),
  );

/**
 * Psylocke's obligation and nemesis set (41025-41029), docs/phase7-wave7.md §7.2, §3.64-§3.66, §3.70.
 *
 * - **Body Swapped (41025)**: "Give to the Betsy Braddock player" is engine data (`obligationCardId`). It stays in
 *   the player's play area. While it is, her Psi-Katana-side upgrades cannot be flipped. When Revealed: every
 *   PSI-ENERGY upgrade she controls is flipped to its Psi-Katana side and exhausted, one already on that side
 *   included (Q43 = A). The Alter-Ego Action discards 1 PSIONIC card from hand to discard it.
 * - **Chimera (41026)**: +X SCH and ATK for an activation against you; X per `MENTAL_ON_YOUR_CARDS` (Q39 = C).
 * - **Interdimensional Plunder (41027)**: 1 threat per upgrade in play, whoever controls it.
 * - **Psionic Illusion (41028)**: attaches to the identity (data). The player names a resource type (the four icon
 *   types; naming wild is allowed and matches wild icons alone), discards the top card of the deck, and if it has no
 *   printed icon of that type (a wild icon matches any named type, Q40 = B) the attack goes to a friendly character
 *   of the player's choice and this card is discarded.
 * - **Telekinetic Dragon (41029)**: X indirect damage, surge at 0; Boost: spend a [mental] resource (a payment, a wild
 *   resource pays it) or, when none is paid, confuse your identity.
 */
export const PSYLOCKE_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  // "You cannot flip your Psi-Katana upgrades." `name` reads the face showing.
  "41025.obligation": constant(cannotFlip(query("upgrade", { name: "Psi-Katana", controlledBy: you }))),

  "41025.when-revealed": whenRevealed(
    flipCard(each(query("upgrade", { trait: PSI_ENERGY, name: "Psi-Knife", controlledBy: you }))),
    exhaust(each(query("upgrade", { trait: PSI_ENERGY, controlledBy: you }))),
  ),

  "41025.body-swapped-action": alterEgoAction(
    { cost: discardFromHandCost(1, 1, undefined, { trait: PSIONIC }) },
    discard(self),
  ),

  "41026.chimera-forced-interrupt": forcedInterrupt(
    on.enemyActivates("self", { againstYou: true }),
    SELECT_YOUR_CARDS,
    modifyAttack({ atkBonus: MENTAL_ON_YOUR_CARDS, threatBonus: MENTAL_ON_YOUR_CARDS }),
  ),

  "41027.when-revealed": whenRevealed(placeThreat(countOf(query("upgrade")), self)),

  "41028.psionic-illusion-forced-interrupt": forcedInterrupt(
    YOU_ATTACK_AN_ENEMY,
    chooseOne(naming("physical"), naming("mental"), naming("energy"), naming("wild")),
  ),

  "41029.when-revealed": whenRevealed(
    SELECT_YOUR_CARDS,
    ifThen(valueAtLeast(MENTAL_ON_YOUR_CARDS, 1), dealIndirectDamage(you, MENTAL_ON_YOUR_CARDS)),
    ifThen(not(valueAtLeast(MENTAL_ON_YOUR_CARDS, 1)), surge()),
  ),
  "41029.boost": boost(
    // "Choose to either spend … or …": the payment prompt, and confusion when nothing (or too little) is paid (the
    // `spendResources` doc; Energy Drain 31028, `spdr`, is the same shape).
    spendResources({ mental: 1 }, "paid"),
    ifThen(not(made("paid")), confuse(yourIdentity)),
  ),
});
