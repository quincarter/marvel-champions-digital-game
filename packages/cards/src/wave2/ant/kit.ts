import { trait } from "@mc/content";
import {
  anAttackableEnemy,
  attack,
  changeToOtherHeroForm,
  chooseTarget,
  chosen,
  confuse,
  countOf,
  dealDamage,
  defineAbilities,
  draw,
  each,
  exhaustThis,
  heal,
  heroAction,
  heroResponse,
  ifThen,
  modifyStat,
  on,
  query,
  removeThreat,
  response,
  spend,
  stun,
  sum,
  youHaveTrait,
  yourIdentity,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

const GIANT = trait("GIANT");
const TINY = trait("TINY");

/**
 * Ant-Man / Scott Lang (12001a/b/c, a three-sided identity — Tiny hero, alter-ego, Giant hero) and his hero kit
 * (12002–12010, 12020). "If you are in [Giant/Tiny] hero form" reads as "your identity currently has the
 * [Giant/Tiny] trait" (`youHaveTrait`) — a three-sided identity's traits are its *current face's* printed traits
 * (`traitsOf`, docs/phase7-wave2.md §3.2), so no new predicate is needed beyond what already exists.
 *
 * **Previously skipped, now landed (docs/phase7-wave2-scripting.md):** `12006.pym-particles-response` needed a
 * trigger event for "a card was spent as a resource" (`resourcesSpent`, DSL `on.youSpendThis()`) and
 * `12009.giant-strength-response` needed `LastingUntil.endOfTurn` — both landed in `packages/engine` (commits
 * `1036be7`, `c53ad0b`) and are scripted below.
 */
export const ANT_MAN_KIT = defineAbilities({
  // Puny Pest — Response: After you change to this form (Tiny hero), remove 1 threat from a scheme.
  "12001a.puny-pest": response(
    on.youChangeForm(),
    chooseTarget("scheme", query("scheme")),
    removeThreat(1, chosen("scheme")),
  ),
  // Time to Unwind — Response: After you change to this form (alter-ego), heal 1 damage from Scott Lang.
  "12001b.time-to-unwind": response(on.youChangeForm(), heal(1, yourIdentity)),
  // Giant Nuisance — Response: After you change to this form (Giant hero), deal 1 damage to an enemy.
  "12001c.giant-nuisance": response(
    on.youChangeForm(),
    chooseTarget("enemy", query("enemy")),
    dealDamage(1, chosen("enemy")),
  ),

  // Wasp (12002, ally) — Hero Response: after Wasp enters play, deal 2 damage to an enemy if you are in Giant hero
  // form, or remove 2 threat from a scheme if you are in Tiny hero form.
  "12002.wasp-response": heroResponse(
    on.entersPlay("self"),
    ifThen(
      youHaveTrait(GIANT),
      [chooseTarget("enemy", query("enemy")), dealDamage(2, chosen("enemy"))],
      [chooseTarget("scheme", query("scheme")), removeThreat(2, chosen("scheme"))],
    ),
  ),

  // Giant Stomp — Play only if you are in Giant hero form (data: `playRestrictions`, form "hero" plus the GIANT
  // identity trait, which only the Giant face prints). Hero Action (attack): deal 1 damage to each minion. Deal 8
  // damage to an enemy.
  "12003.giant-stomp-action": heroAction(
    { label: "attack" },
    dealDamage(1, each(query("minion"))),
    anAttackableEnemy(),
    attack(8, chosen("enemy")),
  ),

  // Hive Mind — Play only if you are in Tiny hero form (data, as Giant Stomp above). Hero Action
  // (thwart): remove 2 threat from a scheme, +1 for each Army of Ants support you control.
  "12004.hive-mind-action": heroAction(
    { label: "thwart" },
    chooseTarget("scheme", query("scheme")),
    removeThreat(sum(2, countOf(query("support", { name: cardName("12007"), controller: "you" }))), chosen("scheme")),
  ),

  // Resize — Hero Action: change to your other hero form. Draw 1 card.
  "12005.resize-action": heroAction(changeToOtherHeroForm(), draw(1)),

  // Pym Particles (resource) — Hero Response: after you spend this card, heal 2 damage from your hero if in Giant
  // hero form, or draw 1 card if in Tiny hero form. "Hero Response" already gates this to hero form, so the else
  // branch (not Giant) is exactly Tiny.
  "12006.pym-particles-response": heroResponse(
    on.youSpendThis(),
    ifThen(youHaveTrait(GIANT), heal(2, yourIdentity), draw(1)),
  ),

  // Army of Ants — Hero Action: If you are in Tiny hero form, exhaust Army of Ants → deal 1 damage to an enemy.
  // The form check comes before the cost, so outside Tiny hero form the action cannot be triggered at all rather
  // than letting the player pay for nothing.
  "12007.army-of-ants-action": heroAction(
    { cost: exhaustThis, while: youHaveTrait(TINY) },
    chooseTarget("enemy", query("enemy")),
    dealDamage(1, chosen("enemy")),
  ),

  // Ant-Man's Helmet — Hero Response: after you change to Giant hero form, heal 2 damage from your hero. Hero
  // Response: after you change to Tiny hero form, draw 1 card.
  "12008.ant-mans-helmet-response": heroResponse(
    on.youChangeForm(),
    ifThen(youHaveTrait(GIANT), heal(2, yourIdentity)),
  ),
  "12008.ant-mans-helmet-hero-response": heroResponse(on.youChangeForm(), ifThen(youHaveTrait(TINY), draw(1))),

  // Giant Strength — Hero Response: after you change to Giant hero form, you get +1 ATK until the end of this
  // turn. `on.youChangeForm()` fires on any form change (as Ant-Man's Helmet above does too); the printed "to
  // Giant hero form" is the `ifThen` guard.
  "12009.giant-strength-response": heroResponse(
    on.youChangeForm(),
    ifThen(youHaveTrait(GIANT), modifyStat("atk", 1, yourIdentity, "endOfTurn")),
  ),

  // Wrist Gauntlets — Hero Action: If you are in Giant hero form, exhaust and spend [P][P] → stun an enemy. Hero
  // Action: If you are in Tiny hero form, exhaust and spend [E][E] → confuse an enemy. Each form check precedes its
  // cost, so each action is blocked outright in the other form (same as Army of Ants).
  "12010.wrist-gauntlets-action": heroAction(
    { cost: [exhaustThis, spend({ physical: 2 })], while: youHaveTrait(GIANT) },
    chooseTarget("enemy", query("enemy")),
    stun(chosen("enemy")),
  ),
  "12010.wrist-gauntlets-hero-action": heroAction(
    { cost: [exhaustThis, spend({ energy: 2 })], while: youHaveTrait(TINY) },
    chooseTarget("enemy2", query("enemy")),
    confuse(chosen("enemy2")),
  ),

  // Swarm Tactics — Team-Up (Ant-Man and Wasp), Max 1 per deck (data). Hero Action: change to your other hero
  // form. Ready your hero.
  "12020.swarm-tactics-action": heroAction(changeToOtherHeroForm(), { kind: "ready", target: yourIdentity }),
});
