import {
  alterEgoInterrupt,
  attackAnEnemy,
  changeForm,
  chooseOne,
  chosen,
  defineAbilities,
  discardStatusCost,
  giveTough,
  heroAction,
  heroInterrupt,
  hasStatus,
  modifyAttack,
  modifyStat,
  on,
  option,
  query,
  ready,
  removeStatus,
  stun,
  confuse,
  ifThen,
  varAtLeast,
  when,
  you,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";

/**
 * Colossus's own signature events (`mut_gen` 32007-32010, MC32 p. 22; docs/phase7-wave6.md §3.6, errata RRG 1.8
 * p. 68 for Steel Fist and Armor Up, the label and the erratum in `curation/mut_gen.ts`). The "hero" they discard from or give to is his
 * own identity (`yourIdentity`); a hero holds up to 2 tough cards (`statusLimit`, identity.ts).
 *
 * - **Made of Rage (32007)**: the discard is a paid cost (`discardStatusCost`, offered only while he holds a tough
 *   card), so the interrupt is simply not offered without one. +6 ATK for that attack and overkill: Knife Leap's shape.
 * - **Steel Fist (32008)**: "Hero Action (attack): Deal 5 damage to an enemy" (print and erratum p. 68; MarvelCDB
 *   drops the label, restored by a curation correction) is a labeled attack: a stunned Colossus has it cancelled (cost
 *   paid, stun card removed, RRG "Labeled Ability" p. 26), and guard, Retaliate and "after you attack" apply. The
 *   5 is flat (`attackAnEnemy(5)`), not his ATK. "You may discard a tough status card ... to stun and confuse that enemy"
 *   is an effect, not a cost (erratum p. 68): a `chooseOne` whose first option is offered only while he holds a tough
 *   card, and which stuns and confuses only if a card was actually discarded.
 * - **Bulletproof Protector (32009)**: the discard is a cost; the two bullets are options of the
 *   `-action` ref's `chooseOne`. Giving 2
 *   when he holds 2 (after paying one he holds 1) fills to the limit of 2 and the extra card is not given.
 * - **Armor Up (32010)**: "When the villain would activate" is `on.enemyActivating(query("villain"))` (wave 5 §3.2);
 *   it changes him to hero form and the activation then continues (not cancelled).
 */
export const COLOSSUS_EVENTS = defineAbilities({
  "32007.made-of-rage-interrupt": heroInterrupt(
    when.attacks(YOUR_IDENTITY, { basic: true }),
    { cost: discardStatusCost("tough", yourIdentity) },
    modifyStat("atk", 6, yourIdentity, "endOfAttack"),
    modifyAttack({ overkill: true }),
  ),

  "32008.steel-fist-action": heroAction(
    { label: "attack" },
    attackAnEnemy(5),
    chooseOne(
      option(
        "Discard a tough status card from your hero to stun and confuse that enemy",
        { when: hasStatus(yourIdentity, "tough") },
        removeStatus(yourIdentity, "tough", { count: 1, bind: "discarded" }),
        ifThen(varAtLeast("discarded.amount"), [stun(chosen("enemy")), confuse(chosen("enemy"))]),
      ),
      option("Do not discard a tough status card"),
    ),
  ),

  "32009.bulletproof-protector-action": heroAction(
    { cost: discardStatusCost("tough", yourIdentity) },
    chooseOne(
      option("Give your hero 2 tough status cards", giveTough(yourIdentity), giveTough(yourIdentity)),
      option("Ready your hero", ready(yourIdentity)),
    ),
  ),

  "32010.armor-up-interrupt": alterEgoInterrupt(on.enemyActivating(query("villain")), changeForm(you, "hero")),
});
