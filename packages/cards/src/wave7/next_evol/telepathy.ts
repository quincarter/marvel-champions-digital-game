import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  attackInProgress,
  boost,
  constant,
  countOf,
  defineAbilities,
  discardAtRandom,
  discardTopOfDeckCost,
  each,
  exhaust,
  exhaustYourHero,
  gainsKeyword,
  gainsTrait,
  hasTrait,
  ifElse,
  ifThen,
  modifyAttack,
  query,
  rule,
  spend,
  surge,
  theVillain,
  valueEquals,
  whenRevealed,
} from "../../dsl/index.js";
import { discardThisObligation } from "../../core/obligations.js";

/**
 * The Telepathy set (40159-40162); see flight.ts for how it comes into play. Manufactured Drama and Sowing Discord are
 * scenario obligations (not an identity's own): a revealed obligation enters the revealing player's play area, where
 * "you" is that player (RRG 1.8 "Obligation", p. 30).
 */
const AERIAL = trait("AERIAL");
const PSIONIC = trait("PSIONIC");
const ATTACHED_VILLAIN = query("villain", { hostOfSelf: true });
const YOUR_SUPPORTS = query("support", { controller: "you" });
const YOUR_ALLIES = query("ally", { controller: "you" });

export const TELEPATHY: AbilityRegistry = defineAbilities({
  // Telepathy — Attached villain gains the PSIONIC trait and retaliate 1. (+1 SCH is the stat box.)
  "40159.telepathy-constant": constant(
    gainsTrait(PSIONIC, ATTACHED_VILLAIN),
    gainsKeyword({ name: "retaliate", value: 1 }, ATTACHED_VILLAIN),
  ),

  // Manufactured Drama — Supports you control cannot ready. (The data names that first paragraph "obligation".)
  "40160.obligation": constant(rule({ kind: "cannotReady", target: YOUR_SUPPORTS })),
  // When Revealed: Exhaust each support you control. If no supports were exhausted this way, this card gains surge.
  "40160.when-revealed": whenRevealed(
    ifThen(valueEquals(countOf(query("support", { controller: "you", exhausted: false })), 0), surge()),
    exhaust(each(YOUR_SUPPORTS)),
  ),
  // Alter-Ego Action: Exhaust your identity and discard 1 card from the top of your deck for each support you control
  // -> discard this card.
  "40160.manufactured-drama-action": alterEgoAction(
    { cost: [exhaustYourHero, discardTopOfDeckCost(countOf(YOUR_SUPPORTS))] },
    discardThisObligation,
  ),

  // Sowing Discord — Allies you control cannot ready.
  "40161.obligation": constant(rule({ kind: "cannotReady", target: YOUR_ALLIES })),
  // When Revealed: Exhaust each ally you control. If no allies were exhausted this way, this card gains surge.
  "40161.when-revealed": whenRevealed(
    ifThen(valueEquals(countOf(query("ally", { controller: "you", exhausted: false })), 0), surge()),
    exhaust(each(YOUR_ALLIES)),
  ),
  // Alter-Ego Action: Spend [mental][mental] resources -> discard this card.
  "40161.sowing-discord-action": alterEgoAction({ cost: spend({ mental: 2 }) }, discardThisObligation),

  // One Step Ahead — When Revealed: Discard 1 random card from your hand (2 instead if the villain has the AERIAL
  // trait). [star] Boost: If the villain is attacking, this attack gains overkill.
  "40162.when-revealed": whenRevealed(discardAtRandom(ifElse(hasTrait(theVillain, AERIAL), 2, 1))),
  "40162.boost": boost(
    ifThen(attackInProgress({ attacker: { categories: ["villain"] } }), modifyAttack({ overkill: true })),
  ),
});
