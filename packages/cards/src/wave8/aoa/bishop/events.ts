import type { AbilityRegistry } from "@mc/engine";
import {
  applyRuleUntil,
  attackAnEnemy,
  defineAbilities,
  draw,
  heroAction,
  heroInterrupt,
  ifThen,
  moveCards,
  on,
  paidWithResourceCard,
  query,
  ready,
  thwartAScheme,
  yourIdentity,
  YOUR_IDENTITY,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * Bishop signature events (docs/phase7-wave8.md section 7.1, 3.51, 3.52). Every ref is registered; nothing is skipped.
 *
 * Concussive Blast and Command Authority read the payment: "if you paid for this event with a resource card" is
 * `paidWithResourceCard()` (section 3.51, owner decision Q28 = A): true only when a resource card's resource actually
 * went toward a cost of at least 1, so never at cost 0 and never for a resource a card in play generates. Concussive
 * Blast is one attack (Q47 = A) and then readies Bishop; Command Authority removes the threat, then draws.
 *
 * Energy Conversion is a (defense) interrupt to any enemy attack: the label makes Bishop the defender when there is
 * none, with no DEF applied (no basic defense was made). Each resource card in his discard pile is shuffled into his
 * deck (with none, nothing moves and the deck is not shuffled), and "you cannot take more than 3 damage from this
 * attack" is a lasting `maxDamageTakenPerAttack` on his identity until the attack ends (the excess is neither taken nor
 * prevented, wave 6 Q9). An ally of his that defends is not "you".
 *
 * Cards (3):
 * - 45007 Concussive Blast (event)
 * - 45008 Command Authority (event)
 * - 45009 Energy Conversion (event)
 */
export const BISHOP_EVENTS: AbilityRegistry = defineAbilities({
  "45007.concussive-blast-action": heroAction(
    { label: "attack" },
    ...attackAnEnemy(6),
    ifThen(paidWithResourceCard(), ready(yourIdentity)),
  ),

  "45008.command-authority-action": heroAction(
    { label: "thwart" },
    ...thwartAScheme(3),
    ifThen(paidWithResourceCard(), draw(1)),
  ),

  "45009.energy-conversion-interrupt": heroInterrupt(
    on.enemyAttacks(query("enemy")),
    { label: "defense" },
    moveCards(zone("discard", you, { filter: query("resource") }), "deckShuffle"),
    applyRuleUntil({ kind: "maxDamageTakenPerAttack", target: YOUR_IDENTITY, amount: 3 }, "endOfAttack"),
  ),
});
