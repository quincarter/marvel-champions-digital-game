import type { AbilityRegistry } from "@mc/engine";
import {
  anAttackableEnemy,
  attack,
  chosen,
  defineAbilities,
  eventSource,
  heroAction,
  heroInterrupt,
  ifThen,
  modifyAttack,
  on,
  paidWith,
  playNote,
  query,
  stun,
} from "../../../dsl/index.js";
import { CYBERNETIC_ARM_NOTE } from "./support-upgrades-allies.js";

/**
 * Wave 9 scripting module `winter/winter-soldier/events` (docs/phase7-wave9.md section 8.4, 3.52). `card-groups.ts` maps
 * this module to the ids below; keep the two in step.
 *
 * Cards (3):
 * - 54004 Arm Block (event)
 * - 54005 Metal Punch (event)
 * - 54006 Electrical Discharge (event)
 *
 * **54006.electrical-discharge-action** (Hero Action, attack): deal 4 damage to an enemy; if the event was paid for using
 * at least one [energy] resource (a paid wild counts as any type, `paidWith`; an overpaid resource was not paid), stun
 * that enemy. The attack is the labeled attack (guard applies); the stun follows the damage and does nothing to an
 * enemy the attack defeated.
 *
 * **54004.arm-block-constant** (Hero Interrupt, attack/defense; Arm Block carries both traits, so Cybernetic Arm may pay
 * for it): when an enemy attacks, deal 3 damage to it; if you exhausted Cybernetic Arm to pay for this event
 * (`playNote(CYBERNETIC_ARM_NOTE)`, written by the Arm on the event it pays for), prevent all damage from that attack.
 * Shaped like Brazen Defense 32178 / Shadow and Steel 32021: the (defense) label makes the hero the defender, the
 * (attack) label makes the 3 damage an attack (guard does not apply: the target is the attacking enemy). The prevention
 * is `modifyAttack` on the enemy attack in progress, applied after the 3 damage as printed. Ruling January 17, 2026 -
 * Ruling 2: against Black Widow the Grunt her interrupt reveals takes the 3 damage, and the prevention still refers to
 * her initial attack. The ref is `-constant` (a parse artifact of the data); the trigger is the interrupt.
 *
 * **54005.metal-punch-action** (Hero Action, attack): deal 7 damage to an enemy; if the Arm paid for it, this attack
 * gains overkill (`attack`'s `overkill` option, the keyword for this attack only).
 */
export const WINTER_SOLDIER_EVENTS: AbilityRegistry = defineAbilities({
  "54004.arm-block-constant": heroInterrupt(
    on.enemyAttacks(query("enemy")),
    { label: ["attack", "defense"] },
    attack(3, eventSource),
    ifThen(playNote(CYBERNETIC_ARM_NOTE), modifyAttack({ preventAllDamage: true })),
  ),

  "54005.metal-punch-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    ifThen(playNote(CYBERNETIC_ARM_NOTE), attack(7, chosen("enemy"), { overkill: true }), attack(7, chosen("enemy"))),
  ),

  "54006.electrical-discharge-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(4, chosen("enemy")),
    ifThen(paidWith("energy"), stun(chosen("enemy"))),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const WINTER_SOLDIER_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
