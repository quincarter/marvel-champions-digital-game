import { trait } from "@mc/content";
import type { AbilityRegistry, TargetRef } from "@mc/engine";
import {
  anAttackableEnemy,
  after,
  attack,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  eventSource,
  exhaustThis,
  heroAction,
  heroResponse,
  playOnlyIf,
  response,
  spend,
  stun,
  swapCards,
  topOfDeck,
  you,
  youHaveTrait,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";

/**
 * The psylocke pack's cards that belong to no hero kit and no aspect set (41030-41033), docs/phase7-wave7.md §7.2,
 * §3.57, §3.72.
 *
 * - **Psi-Bow Attack (41030)**: "Play only if your hero has the PSIONIC trait" is a `playOnlyIf` constant on the
 *   hero's current face (the scan says "hero"; `parse-text.ts` has no rule for the sentence, so there is no data
 *   restriction). Hero Action (attack): 4 damage, this attack gains ranged.
 * - **Domino (41031)**: after one of her own basic powers (any of the three an ally has), swap a hand card with the top
 *   card of the deck (RRG "'Swap'", p. 42: refused without a card in both places, and not a draw).
 * - **Psi-Flail Strike (41032)**: "your identity has PSIONIC" is data (`requiresIdentityTrait`). Hero Response (attack)
 *   after her defense: 3 damage to the attacker, then stun it (the damage is an attack: retaliate and the like apply).
 * - **Telekinesis (41033)**: the same data restriction plus Max 1 per player. Hero Action (attack): exhaust it and
 *   spend [mental][mental] to deal 3 damage to an enemy.
 */
const PSIONIC = trait("PSIONIC");

export const PSYLOCKE_PACK_CARDS: AbilityRegistry = defineAbilities({
  "41030.psi-bow-attack-constant": constant(playOnlyIf(youHaveTrait(PSIONIC))),
  "41030.psi-bow-attack-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(4, chosen("enemy"), { keywords: ["ranged"] }),
  ),

  "41031.domino-response": response(
    after.basicPowerUsed("self"),
    chooseCards("handCard", zone("hand", you), { min: 1, max: 1 }),
    chooseCards("top", topOfDeck(1), { min: 1, max: 1 }),
    swapCards(chosen("handCard") as TargetRef, chosen("top")),
  ),

  "41032.psi-flail-strike-response": heroResponse(
    after.defends(YOUR_IDENTITY),
    { label: "attack" },
    attack(3, eventSource),
    stun(eventSource),
  ),

  "41033.telekinesis-action": heroAction(
    { label: "attack", cost: [exhaustThis, spend({ mental: 2 })] },
    anAttackableEnemy("enemy"),
    attack(3, chosen("enemy")),
  ),
});
