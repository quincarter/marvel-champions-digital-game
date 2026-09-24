import {
  addCounters,
  defineAbilities,
  enemyAttack,
  enemyScheme,
  ifThen,
  named,
  theVillain,
  varAtLeast,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";

/**
 * Ruthless (16102, treachery, Nebula's own encounter set): "When Revealed (Alter-Ego): Nebula schemes. If threat
 * is placed by this activation, place 1 evasion counter on Nebula's Ship. When Revealed (Hero): Nebula attacks
 * you. If damage is dealt by this activation, place 1 evasion counter on Nebula's Ship."
 *
 * A verbatim instance of the same shape `gmw/nebula.ts`'s own villain schemes/attacks and `wave1/twc/bulldozer.ts`'s
 * Bull Rush (07055) already use: `enemyScheme`/`enemyAttack` report their own activation's results under the
 * `bind` prefix (`<bind>.threatPlaced`, `<bind>.damage` — `packages/engine/src/resolve/enemy-activation.ts`'s
 * `applyPlaceThreat`/`applyDamage` both write straight onto the initiating effect's own frame vars, per
 * `docs/card-scripting-process.md`'s note that a card's own printed conditional reads the very activation it just
 * caused, not a separate listened-to event). `varAtLeast(bind, 1)` is "if threat is placed"/"if damage is dealt"
 * — any amount, not a specific one — matching Bulldozer's own "for each" cards using the exact count instead; here
 * the printed text asks only whether the activation did anything, so the boolean reading is exact.
 *
 * This module was left in `KNOWN_SKIPPED` with no recorded reason in the first `gmw` scripting pass — a bare
 * oversight, not a primitive gap (docs/phase7-wave3-scripting.md never lists 16102 among its gap tables). No new
 * DSL or engine work was needed.
 */
export const RUTHLESS = defineAbilities({
  "16102.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyScheme(theVillain, { against: you, bind: "ruthless" }),
    ifThen(varAtLeast("ruthless.threatPlaced", 1), addCounters("evasion", 1, named("Nebula's Ship"))),
  ),
  "16102.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, bind: "ruthless" }),
    ifThen(varAtLeast("ruthless.damage", 1), addCounters("evasion", 1, named("Nebula's Ship"))),
  ),
});
