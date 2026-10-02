import { trait } from "@mc/content";
import {
  aScheme,
  anAttackableEnemy,
  attackAnEnemy,
  changeAdditionalForm,
  chooseTarget,
  chosen,
  defineAbilities,
  discard,
  divide,
  draw,
  exhaustCardsCost,
  enemyAttack,
  heroAction,
  heroInterrupt,
  ifElse,
  ifThen,
  inAdditionalForm,
  on,
  query,
  ready,
  statOf,
  sum,
  totalStatOf,
  attack,
  thwart,
  yourIdentity,
} from "../../../dsl/index.js";

/** "When an enemy attacks" with no "you": any enemy's attack as it is initiated (the precon's Powerful Punch shape). */
const AN_ENEMY_ATTACKS = on.enemyAttacks(query("enemy"));
const X_MEN = trait("X-MEN");
const PHASED = inAdditionalForm("mass", "Phased");

/**
 * Shadowcat's own signature events (`mut_gen` 32037-32040, MC32 p. 22) and her precon's Toe to Toe (32046;
 * docs/phase7-wave6.md §3.22). The form checks read the mass form upgrade (Solid / Phased); the card text never
 * changes the form except Quick Shift.
 *
 * - **Shadowcat Surprise (32037)**: an attack for 3, then "Ready your hero" (so a hero who exhausted to attack acts again).
 * - **Phase Strike (32038)**: an attack for 6; only while Phased, the attacker may discard an attachment with a
 *   Hero Action or Hero Response from that enemy (Phase Disruption's query, `abilityTiming`). "May": optional.
 * - **Airwalk (32039)**: a thwart for 2, or 4 while Phased.
 * - **Quick Shift (32040)**: Hero Interrupt (defense) to an enemy attack: Solid changes to Phased (a mass form
 *   change, `changeAdditionalForm`), Phased draws 2 cards. The card checks the form once when it resolves.
 * - **Team Strike (32045)**: "Exhaust your hero and any number of X-MEN allies": the hero is `exhaustIdentity`, the allies
 *   `exhaustCardsCost` (one or more, RRG 1.8 "Cost" p. 14: "any number" needs at least one card) bound to `exhausted`.
 *   X is the hero's ATK plus the allies' total ATK, divided among enemies in play (Wasp Sting's `divide`). With Aggressive
 *   Energy the ruling of Jun 25, 2026 (2) gives +1 to each enemy damaged.
 * - **Toe to Toe (32046)**: "Choose an enemy. That enemy attacks you. Deal 5 damage to that enemy." The attack
 *   label makes the 5 damage an attack; the chosen enemy attacks first and Shadowcat defends or not as usual (Phased
 *   defending cannot take damage). The enemy is chosen among those she could attack (guard applies to the 5 damage).
 */
export const SHADOWCAT_EVENTS = defineAbilities({
  "32037.shadowcat-surprise-action": heroAction({ label: "attack" }, attackAnEnemy(3), ready(yourIdentity)),

  "32038.phase-strike-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    // The form is read and the attachment chosen before the attack: Phased's own Forced Response ("After you attack
    // ... flip this card") would otherwise flip her to Solid before the printed "if you are in Phased mass form" is
    // read (docs/phase7-wave6.md §4.1, open question raised with this card). The discard itself follows the damage.
    ifThen(
      PHASED,
      chooseTarget(
        "attachment",
        query("attachment", { host: chosen("enemy"), abilityTiming: ["heroAction", "heroResponse"] }),
        { optional: true },
      ),
    ),
    attack(6, chosen("enemy")),
    discard(chosen("attachment")),
  ),

  "32039.airwalk-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(ifElse(PHASED, 4, 2), chosen("scheme")),
  ),

  "32040.quick-shift-interrupt": heroInterrupt(
    AN_ENEMY_ATTACKS,
    { label: "defense" },
    ifThen(PHASED, draw(2), changeAdditionalForm("mass", { toName: "Phased" })),
  ),

  "32045.team-strike-action": heroAction(
    {
      label: "attack",
      cost: { exhaustIdentity: true, ...exhaustCardsCost(query("ally", { trait: X_MEN }), { max: "any" }) },
    },
    divide("damage", sum(statOf(yourIdentity, "atk"), totalStatOf(chosen("exhausted"), "atk")), query("enemy")),
  ),

  "32046.toe-to-toe-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    enemyAttack(chosen("enemy")),
    attack(5, chosen("enemy")),
  ),
});
