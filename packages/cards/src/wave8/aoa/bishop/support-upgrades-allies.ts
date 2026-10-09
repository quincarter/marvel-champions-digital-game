import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  anAttackableEnemy,
  attack,
  chosen,
  defineAbilities,
  discardFromHandCost,
  discardThis,
  exhaustThis,
  handCountOf,
  heal,
  heroAction,
  heroInterrupt,
  ifThen,
  modifyStat,
  on,
  oncePerPhase,
  query,
  ready,
  response,
  scaled,
  self,
  totalPrintedResources,
  valueAtLeast,
  varOf,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../../dsl/index.js";
import { ENERGY_ABSORPTION_MOMENT } from "./identity.js";

const A_RESOURCE_CARD = query("resource");
const RESOURCE_CARDS_IN_HAND = handCountOf(undefined, A_RESOURCE_CARD);

/**
 * Bishop signature allies, upgrades and the resource Stored Energy (docs/phase7-wave8.md section 7.1, 3.52, 3.39).
 * Every ref is registered; nothing is skipped.
 *
 * Malcolm and Randall: the cost is one resource card of the hand (discarded, bound to slot "discard"); the ally readies
 * (an effect, so a ready ally is simply unchanged) and heals 1 only if the discarded card prints the named icon. The
 * printed icon is read alone, so a wild icon heals nobody (Stored Energy prints energy and physical, so it heals
 * either). Once per phase each.
 *
 * Bishop's Rifle: the attack deals 1 damage per resource card in hand as the attack resolves (0 in hand: an attack for
 * 0), with ranged for this attack only. The enemy is chosen as the effect starts, as Deadpool's Katana does.
 *
 * Bishop's Uniform answers the moment "energyAbsorption", which Bishop raises after the resource cards are in his hand
 * (so they are counted), for the player who used it only.
 *
 * Super-Charged: the Action puts 1 charge counter per printed icon of the discarded resource card (a wild counts 1).
 * The Hero Interrupt on the player's own basic attack discards the card for +2 ATK per counter, at most +8, each copy
 * on its own (RRG p. 28). The counters are read as the card is discarded as the cost (`self.counters.charge`, the
 * snapshot every discard-this cost takes): read live afterward it would find the card out of play and give +0.
 *
 * Stored Energy (45010) has no text and no ability ref: it is data (a resource card, energy and physical, TEMPORAL).
 *
 * Cards (6):
 * - 45002 Malcolm (ally)
 * - 45003 Randall (ally)
 * - 45004 Bishop's Rifle (upgrade)
 * - 45005 Bishop's Uniform (upgrade)
 * - 45006 Super-Charged (upgrade)
 * - 45010 Stored Energy (resource)
 */
export const BISHOP_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "45002.malcolm-action": action(
    { cost: discardFromHandCost(1, 1, undefined, A_RESOURCE_CARD), limit: oncePerPhase },
    ready(self),
    ifThen(valueAtLeast(totalPrintedResources(chosen("discard"), ["physical"]), 1), heal(1, self)),
  ),

  "45003.randall-action": action(
    { cost: discardFromHandCost(1, 1, undefined, A_RESOURCE_CARD), limit: oncePerPhase },
    ready(self),
    ifThen(valueAtLeast(totalPrintedResources(chosen("discard"), ["energy"]), 1), heal(1, self)),
  ),

  "45004.bishops-rifle-action": heroAction(
    { label: "attack", cost: exhaustThis },
    anAttackableEnemy(),
    attack(RESOURCE_CARDS_IN_HAND, chosen("enemy"), { keywords: ["ranged"] }),
  ),

  "45005.bishops-uniform-response": response(
    on.moment(ENERGY_ABSORPTION_MOMENT),
    { cost: exhaustThis },
    heal(RESOURCE_CARDS_IN_HAND, yourIdentity),
  ),

  "45006.super-charged-action": action(
    { cost: discardFromHandCost(1, 1, undefined, A_RESOURCE_CARD) },
    addCounters("charge", totalPrintedResources(chosen("discard"))),
  ),

  "45006.super-charged-interrupt": heroInterrupt(
    on.attacks(YOUR_IDENTITY, { basic: true }),
    { cost: discardThis },
    modifyStat("atk", scaled(varOf("self.counters.charge"), { times: 2, max: 8 }), yourIdentity, "endOfAttack"),
  ),
});
